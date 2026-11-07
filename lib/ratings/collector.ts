import { randomUUID } from 'node:crypto'
import { saveCollectedBattle, maintainRatingHistory } from './ingest'
import {
  ratingDatabase,
  publishedConfig,
  readEvidence,
  writeSnapshot,
} from './store'
import { parseBattle, validAccount, validQueueId } from './battles'
import { allRatings } from './engine'
import type { CatalogueCard } from '../splinterlands/catalogue'
import {
  prioritizeTargets,
  type Coverage,
  type CollectionTarget,
} from './collection-priority'
import type { BattleFormat } from './types'

const GAME = 'https://api.splinterlands.io'
const RESEARCH_SOURCES = new Set(['shared-replay', 'manual-replay'])
export function sharedReplayIds(posts: { body?: string }[]): string[] {
  const ids = new Set<string>()
  for (const post of posts)
    for (const text of post.body?.match(/https?:\/\/[^\s)<>"']+/g) ?? []) {
      try {
        const url = new URL(text.replace(/&amp;/g, '&'))
        if (
          ![
            'splinterlands.com',
            'www.splinterlands.com',
            'next.splinterlands.com',
            'play.splinterlands.com',
          ].includes(url.hostname)
        )
          continue
        const id =
          url.searchParams.get('id') ??
          url.pathname.match(/\/battle\/([a-zA-Z0-9_-]+)/)?.[1]
        if (validQueueId(id)) ids.add(id)
      } catch {
        /* User-authored post text is untrusted; only validated IDs leave this function. */
      }
    }
  return Array.from(ids).slice(0, 100)
}

export { saveCollectedBattle } from './ingest'

export type CollectionOptions = {
  maxRequests?: number
  durationMs?: number
  refreshRatings?: boolean
}
export async function runCollector(
  catalogue: CatalogueCard[],
  options: CollectionOptions = {},
) {
  const sql = ratingDatabase(),
    runId = randomUUID()
  const claimed =
    await sql`UPDATE rating_job_lease SET owner = ${runId}::uuid, expires_at = now() + interval '5 minutes' WHERE singleton AND (expires_at IS NULL OR expires_at < now()) RETURNING owner`
  if (!claimed.length)
    return {
      status: 'busy',
      message: 'Another collection run is in progress.',
      collected: 0,
    }
  await sql`INSERT INTO rating_job_runs (id, status) VALUES (${runId}::uuid, 'running')`
  const deadline = Date.now() + Math.min(210000, options.durationMs ?? 140000)
  const maxRequests = Math.min(180, options.maxRequests ?? 100)
  let requests = 0,
    players = 0,
    collected = 0,
    accessBlocked = false,
    historyAttempted = false,
    failures = 0
  const username = process.env.SPLINTERLANDS_API_USERNAME?.trim(),
    token = process.env.SPLINTERLANDS_ACCESS_TOKEN?.trim(),
    jwt = process.env.SPLINTERLANDS_JWT_TOKEN?.trim()
  const authenticatedHistory = !!(jwt || (username && token))
  const history = {
    configured: authenticatedHistory,
    attempted: false,
    rejected: false,
    responses: 0,
    requested: { modern: 0, wild: 0 },
    targetedScopes: {} as Record<string, number>,
    fetched: { modern: 0, wild: 0 },
    accepted: { modern: 0, wild: 0 },
    scopes: {} as Record<string, number>,
    missingFormat: 0,
    skippedNonRanked: 0,
  }
  let ratingsRefreshed = false
  let coverage: Coverage[] = []
  const available = () =>
    Date.now() < deadline - 1500 && requests < maxRequests && collected < 200
  async function request(
    url: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    if (!available()) throw new Error('Collection budget reached')
    requests++
    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        cache: 'no-store',
        signal: AbortSignal.timeout(
          Math.min(12000, Math.max(1000, deadline - Date.now())),
        ),
      })
    } catch {
      throw new Error('Splinterlands request unavailable')
    }
    if (response.status === 401 || response.status === 403)
      throw new Error('AUTH_REQUIRED')
    if (response.status === 429) throw new Error('RATE_LIMITED')
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`)
    if (!response.body) throw new Error('Empty upstream response')
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const next = await reader.read()
        if (next.done) break
        size += next.value.byteLength
        if (size > 8 * 1024 * 1024) {
          await reader.cancel()
          throw new Error('Replay response exceeded 8 MiB')
        }
        chunks.push(next.value)
      }
    } finally {
      reader.releaseLock()
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      throw new Error('Invalid upstream JSON')
    }
  }
  async function pending(ids: string[], source: string) {
    if (RESEARCH_SOURCES.has(source)) return
    const clean = ids.filter(validQueueId)
    if (!clean.length) return
    await sql`
      INSERT INTO rating_pending_battles (queue_id, source)
      SELECT id, ${source} FROM unnest(${clean}::text[]) AS id
      WHERE NOT EXISTS (SELECT 1 FROM rating_seen b WHERE b.queue_ids @> ARRAY[id])
      ON CONFLICT (queue_id) DO UPDATE SET source = CASE WHEN EXCLUDED.source = 'public-queue' THEN EXCLUDED.source ELSE rating_pending_battles.source END
    `
  }
  const historyPlayers = new Set<string>()
  async function collectHistory(player: string, formats: BattleFormat[]) {
    if (accessBlocked) return
    for (const format of formats) {
      if (!available()) break
      const key = `${player}:${format}`
      if (historyPlayers.has(key)) continue
      historyPlayers.add(key)
      historyAttempted = history.attempted = true
      history.requested[format]++
      const params = new URLSearchParams({
        player,
        format,
        limit: '20',
        ...(username ? { username } : {}),
        ...(username && token ? { token } : {}),
      })
      try {
        const data = (await request(`${GAME}/battle/history2?${params}`, {
          ...(jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : {}),
        })) as { battles?: unknown[] }
        if (!Array.isArray(data?.battles))
          throw new Error('Unexpected history response')
        history.responses++
        history.fetched[format] += data.battles.length
        for (const row of data.battles) {
          if (collected >= 200) break
          // History includes tournaments and brawls. They must not exhaust the
          // ranked ingestion cap before we reach other players and formats.
          if (
            !row ||
            typeof row !== 'object' ||
            !/^ranked$/i.test(
              String((row as { match_type?: unknown }).match_type ?? ''),
            )
          ) {
            history.skippedNonRanked++
            continue
          }
          if (
            row &&
            typeof row === 'object' &&
            !(row as { format?: unknown }).format
          )
            history.missingFormat++
          const battle = parseBattle(row, catalogue, Date.now(), format)
          if (!battle) continue
          const result = await saveCollectedBattle(battle, 'history')
          if (result.inserted) collected++
          if (battle.eligible) {
            history.accepted[format]++
            const scope = `${battle.format}:${battle.league}`
            history.scopes[scope] = (history.scopes[scope] ?? 0) + 1
          }
        }
      } catch (error) {
        if ((error as Error).message === 'AUTH_REQUIRED') {
          accessBlocked = history.rejected = true
          break
        }
        if ((error as Error).message === 'RATE_LIMITED') throw error
        failures++
      } finally {
        await sql`
          INSERT INTO rating_collection_targets (player, format, last_checked)
          VALUES (${player}, ${format}, now())
          ON CONFLICT (player, format) DO UPDATE SET last_checked = now()
        `
      }
    }
  }
  let researchProcessed = 0
  async function processPending() {
    const queued =
      await sql`SELECT queue_id, source FROM rating_pending_battles WHERE next_check <= now() AND attempts < 12 ORDER BY CASE WHEN source = 'public-queue' THEN 0 ELSE 1 END, attempts, discovered_at LIMIT 80`
    for (const item of queued) {
      if (!available()) break
      // Shared highlights must not consume the budget for ranked queue samples.
      if (RESEARCH_SOURCES.has(item.source as string)) {
        if (researchProcessed >= 6) continue
        researchProcessed++
      }
      try {
        const row = await request(
          `${GAME}/battle/result?id=${encodeURIComponent(item.queue_id as string)}`,
        )
        const explicitFormat =
          row && typeof row === 'object'
            ? (row as { format?: unknown }).format
            : undefined
        if (
          typeof explicitFormat === 'string' &&
          !['modern', 'wild'].includes(explicitFormat)
        ) {
          await sql`UPDATE rating_pending_battles SET attempts = 12 WHERE queue_id = ${item.queue_id}`
          continue
        }
        const battle = parseBattle(row, catalogue)
        if (!battle) {
          await sql`UPDATE rating_pending_battles SET attempts = attempts + 1, next_check = now() + interval '15 minutes' WHERE queue_id = ${item.queue_id}`
          continue
        }
        const result = await saveCollectedBattle(battle, item.source as string)
        if (result.inserted) collected++
      } catch (error) {
        if ((error as Error).message === 'RATE_LIMITED') throw error
        failures++
        await sql`UPDATE rating_pending_battles SET attempts = attempts + 1, next_check = now() + interval '1 hour' WHERE queue_id = ${item.queue_id}`
      }
    }
  }
  try {
    // Retention is gated to one pass per UTC day.
    await maintainRatingHistory()
    const admin = process.env.NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT ?? 'brave.sps'
    coverage = (await sql`
      SELECT format, league, sum(battles)::int AS battles FROM rating_daily_totals
      WHERE day >= (now() AT TIME ZONE 'UTC')::date - 89
      GROUP BY format, league
    `) as Coverage[]
    const formats = (['modern', 'wild'] as BattleFormat[]).sort(
      (a, b) =>
        coverage
          .filter((c) => c.format === a)
          .reduce((n, c) => n + c.battles, 0) -
        coverage
          .filter((c) => c.format === b)
          .reduce((n, c) => n + c.battles, 0),
    )
    // Test configured authentication before discovery/retry work can consume the budget.
    const login = username ?? admin
    if (authenticatedHistory && validAccount(login) && available()) {
      await sql`INSERT INTO rating_collection_accounts (player, discovered_from) VALUES (${login}, 'site account') ON CONFLICT (player) DO NOTHING`
      players++
      await collectHistory(login, formats)
    }
    if (validAccount(admin))
      await sql`INSERT INTO rating_collection_accounts (player, discovered_from) VALUES (${admin}, 'site account') ON CONFLICT (player) DO NOTHING`
    let previousSeason: number | undefined
    if (available())
      try {
        const settings = (await request(`${GAME}/settings`)) as {
          previous_season?: { id?: number }
        }
        previousSeason = settings.previous_season?.id
      } catch {
        failures++
      }
    // Previous-season boards keep a rollover from erasing the discovery roster.
    for (const format of formats)
      for (const board of [0, 1, 2, 3]) {
        if (!available()) break
        try {
          const url = `${GAME}/players/leaderboard?format=${format}&leaderboard=${board}`
          let data = await request(url)
          let list = Array.isArray(data)
            ? data
            : (data as { leaderboard?: unknown[] })?.leaderboard
          if (!Array.isArray(list))
            throw new Error('Unexpected leaderboard response')
          if (!list.length && Number.isInteger(previousSeason) && available()) {
            data = await request(`${url}&season=${previousSeason}`)
            list = Array.isArray(data)
              ? data
              : (data as { leaderboard?: unknown[] })?.leaderboard
            if (!Array.isArray(list))
              throw new Error('Unexpected previous leaderboard response')
          }
          const accounts = list
            .map((row) => (row as { player?: unknown }).player)
            .filter(validAccount)
            .slice(0, 40)
          if (accounts.length)
            await sql`INSERT INTO rating_collection_accounts (player, discovered_from) SELECT player, ${`${format} board ${board}`} FROM unnest(${accounts}::text[]) AS player ON CONFLICT (player) DO NOTHING`
        } catch (error) {
          if ((error as Error).message === 'RATE_LIMITED') throw error
          failures++
        }
      }
    // Working bulk history takes priority over repeatedly unresolved queue IDs.
    if (!authenticatedHistory || accessBlocked) await processPending()
    const candidates = (await sql`
      WITH roster AS (
        SELECT a.player, f.format,
          CASE WHEN t.last_seen >= now() - interval '30 days' THEN t.league END AS league,
          CASE WHEN ${accessBlocked} THEN a.last_checked ELSE t.last_checked END AS last_checked
        FROM rating_collection_accounts a CROSS JOIN (VALUES ('modern'), ('wild')) f(format)
        LEFT JOIN rating_collection_targets t ON t.player = a.player AND t.format = f.format
      ), ranked AS (
        SELECT *, row_number() OVER (PARTITION BY format, league ORDER BY last_checked ASC NULLS FIRST, player) AS scope_rank
        FROM roster
      )
      SELECT player, format, league, last_checked::text AS "lastChecked" FROM ranked WHERE scope_rank <= 20
    `) as CollectionTarget[]
    const targets = prioritizeTargets(candidates, coverage)
    const queuedPlayers = new Set<string>()
    for (const target of targets) {
      if (!available()) break
      const player = target.player
      const scope = `${target.format}:${target.league ?? 'unknown'}`
      history.targetedScopes[scope] = (history.targetedScopes[scope] ?? 0) + 1
      players++
      try {
        await collectHistory(player, [target.format])
        if (!available()) break
        if (queuedPlayers.has(player)) continue
        queuedPlayers.add(player)
        const queue = await request(
          `${GAME}/battle/battle_queue?username=${encodeURIComponent(player)}`,
        )
        if (Array.isArray(queue))
          await pending(
            queue
              .filter((row) => row && /^ranked$/i.test(row.match_type ?? ''))
              .flatMap((row) => [row.id, row.opponent].filter(validQueueId)),
            'public-queue',
          )
      } catch (error) {
        if ((error as Error).message === 'RATE_LIMITED') throw error
        failures++
      }
      await sql`UPDATE rating_collection_accounts SET last_checked = now() WHERE player = ${player}`
    }
    await processPending()
    // Refresh even without new matches: evidence must age out, and game stats or
    // format eligibility can change independently of collection activity.
    const latest =
      await sql`SELECT created_at FROM rating_snapshots WHERE id = (SELECT active_snapshot_id FROM rating_workspace WHERE singleton)`
    const due =
      !latest[0] ||
      Date.now() - new Date(latest[0].created_at).getTime() >= 86400000
    // Most hourly runs do not refresh daily scores. Do not transfer the full
    // scoring configuration until it is needed; optimistic retries stay fresh.
    let profile =
      options.refreshRatings || due ? await publishedConfig() : undefined
    if (profile) {
      ratingsRefreshed = true
      const evidence = await readEvidence()
      const revision = await writeSnapshot(
        profile.id,
        allRatings(catalogue, profile.config, evidence),
      )
      if (revision === undefined) {
        profile = await publishedConfig()
        if (profile)
          await writeSnapshot(
            profile.id,
            allRatings(catalogue, profile.config, await readEvidence()),
          )
      }
    }
    const mode = accessBlocked
      ? 'Public sampling; bulk ranked history returned HTTP 401/403'
      : historyAttempted
        ? 'History and public sampling'
        : 'Public sampling; bulk history not probed in this run'
    const status =
      accessBlocked && authenticatedHistory
        ? 'access-limited'
        : failures
          ? 'partial'
          : 'completed'
    const message = `${mode}. Summarized ${collected} new battle${collected === 1 ? '' : 's'}. Shared/manual replays are ignored; only qualifying ranked queue/history samples affect ratings.${accessBlocked && authenticatedHistory ? ' Configured history authentication was rejected.' : ''}${history.attempted ? ` History: ${history.responses} successful responses, ${history.fetched.modern} Modern and ${history.fetched.wild} Wild rows; ${history.accepted.modern + history.accepted.wild} passed eligibility checks.` : ''}${failures ? ` ${failures} upstream request(s) failed.` : ''}`
    await sql`UPDATE rating_job_runs SET status = ${status}, message = ${message}, collected = ${collected}, requests = ${requests}, players = ${players}, finished_at = now() WHERE id = ${runId}::uuid`
    return {
      status,
      message,
      collected,
      requests,
      players,
      ratingsRefreshed,
      history,
    }
  } catch (error) {
    // Never log request URLs: authenticated history queries contain a secret.
    const message =
      (error as Error).message === 'RATE_LIMITED'
        ? 'Splinterlands rate limit reached; the next scheduled run will resume.'
        : 'Collection stopped early. Completed ingestions are retained and pending IDs will be retried.'
    await sql`UPDATE rating_job_runs SET status = 'partial', message = ${message}, collected = ${collected}, requests = ${requests}, players = ${players}, finished_at = now() WHERE id = ${runId}::uuid`
    return { status: 'partial', message, collected, requests, players, history }
  } finally {
    await sql`UPDATE rating_job_lease SET owner = NULL, expires_at = NULL WHERE singleton AND owner = ${runId}::uuid`
  }
}
