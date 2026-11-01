import { randomUUID } from 'node:crypto'
import {
  ratingDatabase,
  publishedConfig,
  readEvidence,
  writeSnapshot,
} from './store'
import {
  parseBattle,
  validAccount,
  validQueueId,
  type ParsedBattle,
} from './battles'
import { allRatings } from './engine'
import type { CatalogueCard } from '../splinterlands/catalogue'

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

export async function saveCollectedBattle(
  battle: ParsedBattle,
  source: string,
) {
  const sql = ratingDatabase()
  const research = RESEARCH_SOURCES.has(source)
  const eligible = battle.eligible && !research
  const exclusion =
    research && battle.eligible
      ? 'Shared replay selection bias: research only'
      : battle.exclusion
  const processingToken = randomUUID()
  const raw = JSON.stringify(battle.raw)
  const observations = JSON.stringify(battle.observations)
  const [saved] = await sql.transaction([
    sql`
      INSERT INTO rating_battles (id, queue_ids, played_at, format, match_type, league, league_method, mana, rulesets, winner, eligible, exclusion, parser_version, source, raw, processing_token)
      VALUES (${battle.id}, ${battle.queueIds}, ${battle.playedAt}::timestamptz, ${battle.format}, ${battle.matchType}, ${battle.league}, ${battle.leagueMethod}, ${battle.mana}, ${battle.rulesets}, ${battle.winner}, ${eligible}, ${exclusion}, ${battle.parserVersion}, ${source}, ${raw}::jsonb, ${processingToken}::uuid)
      ON CONFLICT (id) DO UPDATE SET played_at = EXCLUDED.played_at, format = EXCLUDED.format, match_type = EXCLUDED.match_type,
        league = EXCLUDED.league, league_method = EXCLUDED.league_method, mana = EXCLUDED.mana, rulesets = EXCLUDED.rulesets,
        winner = EXCLUDED.winner, eligible = EXCLUDED.eligible, exclusion = EXCLUDED.exclusion, source = EXCLUDED.source,
        parser_version = EXCLUDED.parser_version, raw = EXCLUDED.raw, processing_token = EXCLUDED.processing_token
      WHERE rating_battles.parser_version <= EXCLUDED.parser_version
        AND ((NOT rating_battles.eligible AND EXCLUDED.eligible) OR rating_battles.parser_version < EXCLUDED.parser_version)
      RETURNING (xmax = 0) AS inserted, eligible
    `,
    sql`DELETE FROM rating_observations WHERE battle_id = ${battle.id} AND EXISTS (SELECT 1 FROM rating_battles WHERE id = ${battle.id} AND processing_token = ${processingToken}::uuid)`,
    sql`
      INSERT INTO rating_observations (battle_id, side, kind, subject, level, player, outcome, expected, mirrored)
      SELECT ${battle.id}, side, kind, subject, level, player, outcome, expected, mirrored
      FROM jsonb_to_recordset(${observations}::jsonb) AS o(side smallint, kind text, subject text, level smallint, player text, outcome real, expected real, mirrored boolean)
      WHERE EXISTS (SELECT 1 FROM rating_battles WHERE id = ${battle.id} AND processing_token = ${processingToken}::uuid)
      ON CONFLICT (battle_id, side, kind, subject) DO NOTHING
    `,
    sql`DELETE FROM rating_pending_battles WHERE queue_id = ANY(${battle.queueIds}::text[])`,
    sql`INSERT INTO rating_collection_accounts (player, discovered_from) SELECT player, 'opponent' FROM unnest(${battle.players}::text[]) AS player ON CONFLICT (player) DO NOTHING`,
  ])
  return {
    inserted: !!saved[0]?.inserted,
    changedEvidence: !!saved[0]?.eligible,
  }
}

export type CollectionOptions = {
  maxRequests?: number
  durationMs?: number
  replayIds?: string[]
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
  let ratingsRefreshed = false
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
    const clean = ids.filter(validQueueId)
    if (!clean.length) return
    await sql`
      INSERT INTO rating_pending_battles (queue_id, source)
      SELECT id, ${source} FROM unnest(${clean}::text[]) AS id
      WHERE NOT EXISTS (SELECT 1 FROM rating_battles b WHERE b.queue_ids @> ARRAY[id] AND (b.eligible OR ${source} IN ('shared-replay', 'manual-replay')))
      ON CONFLICT (queue_id) DO UPDATE SET source = CASE WHEN EXCLUDED.source = 'public-queue' THEN EXCLUDED.source ELSE rating_pending_battles.source END
    `
  }
  let researchProcessed = 0
  async function processPending() {
    const queued =
      await sql`SELECT queue_id, source FROM rating_pending_battles WHERE next_check <= now() AND attempts < 12 ORDER BY CASE WHEN source = 'public-queue' THEN 0 ELSE 1 END, discovered_at LIMIT 80`
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
    if (options.replayIds?.length)
      await pending(options.replayIds, 'manual-replay')
    const admin = process.env.NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT ?? 'brave.sps'
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
    for (const format of ['modern', 'wild'])
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
    // Shared examples are retained for replay research, never as an unbiased
    // estimate of strength. Only IDs on official game URLs are accepted.
    for (const sort of ['created', 'trending', 'hot'])
      if (available())
        try {
          const data = (await request('https://api.hive.blog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'bridge.get_ranked_posts',
              params: { sort, tag: 'splinterlands', limit: 20 },
            }),
          })) as { result?: { body?: string }[]; error?: unknown }
          if (data.error || !Array.isArray(data.result))
            throw new Error('Invalid public replay feed response')
          await pending(sharedReplayIds(data.result), 'shared-replay')
        } catch {
          failures++
        }
    await processPending()
    const accounts =
      await sql`SELECT player FROM rating_collection_accounts ORDER BY last_checked ASC NULLS FIRST, created_at, player LIMIT 40`
    const username = process.env.SPLINTERLANDS_API_USERNAME,
      token = process.env.SPLINTERLANDS_ACCESS_TOKEN
    for (const account of accounts) {
      if (!available()) break
      const player = account.player as string
      players++
      try {
        if (!accessBlocked) {
          historyAttempted = true
          for (const format of ['modern', 'wild']) {
            if (!available()) break
            const params = new URLSearchParams({
              player,
              format,
              limit: '20',
              ...(username && token ? { username, token } : {}),
            })
            const headers = process.env.SPLINTERLANDS_JWT_TOKEN
              ? {
                  Authorization: `Bearer ${process.env.SPLINTERLANDS_JWT_TOKEN}`,
                }
              : undefined
            try {
              const data = (await request(`${GAME}/battle/history2?${params}`, {
                headers,
              })) as { battles?: unknown[] }
              if (!Array.isArray(data.battles))
                throw new Error('Unexpected history response')
              for (const row of data.battles) {
                if (collected >= 200) break
                const battle = parseBattle(row, catalogue)
                if (!battle) continue
                const result = await saveCollectedBattle(battle, 'history')
                if (result.inserted) collected++
              }
            } catch (error) {
              if ((error as Error).message === 'AUTH_REQUIRED') {
                accessBlocked = true
                break
              }
              throw error
            }
          }
        }
        if (!available()) break
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
    let profile = await publishedConfig()
    const latest =
      await sql`SELECT created_at FROM rating_snapshots WHERE id = (SELECT active_snapshot_id FROM rating_workspace WHERE singleton)`
    const due =
      !latest[0] ||
      Date.now() - new Date(latest[0].created_at).getTime() >= 86400000
    if (profile && (options.refreshRatings || due)) {
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
      accessBlocked && username && token
        ? 'access-limited'
        : failures
          ? 'partial'
          : 'completed'
    const message = `${mode}. Archived ${collected} new replay${collected === 1 ? '' : 's'}. Shared/manual replays are research-only; only qualifying ranked queue/history samples affect ratings.${accessBlocked && username && token ? ' Configured history authentication was rejected.' : ''}${failures ? ` ${failures} upstream request(s) failed.` : ''}`
    await sql`UPDATE rating_job_runs SET status = ${status}, message = ${message}, collected = ${collected}, requests = ${requests}, players = ${players}, finished_at = now() WHERE id = ${runId}::uuid`
    return { status, message, collected, requests, players, ratingsRefreshed }
  } catch (error) {
    // Never log request URLs: authenticated history queries contain a secret.
    const message =
      (error as Error).message === 'RATE_LIMITED'
        ? 'Splinterlands rate limit reached; the next scheduled run will resume.'
        : 'Collection stopped early. Completed ingestions are retained and pending IDs will be retried.'
    await sql`UPDATE rating_job_runs SET status = 'partial', message = ${message}, collected = ${collected}, requests = ${requests}, players = ${players}, finished_at = now() WHERE id = ${runId}::uuid`
    return { status: 'partial', message, collected, requests, players }
  } finally {
    await sql`UPDATE rating_job_lease SET owner = NULL, expires_at = NULL WHERE singleton AND owner = ${runId}::uuid`
  }
}
