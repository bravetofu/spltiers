// Server and maintenance scripts only. Client components import types/engine instead.
import { neon, neonConfig } from '@neondatabase/serverless'
import { randomUUID } from 'node:crypto'
import type {
  AbilityRating,
  CardRating,
  CollectorStatus,
  Evidence,
  PublishedInfo,
  RatingProfile,
} from './types'
import { EMPTY_EVIDENCE, ENGINE_VERSION } from './types'
import type { CardBattleStats } from './battle-stats'

export async function readCardBattleStats(
  cachedRead = false,
): Promise<CardBattleStats[]> {
  const sql = ratingDatabase(cachedRead)
  const rows = await sql`
    SELECT card_id,league,format,uses::float AS uses,wins::float AS wins,
      losses::float AS losses,draws::float AS draws FROM rating_lifetime_usage
    ORDER BY card_id,league,format
  `
  return rows.map((r) => ({
    cardId: r.card_id,
    league: r.league,
    format: r.format,
    uses: r.uses,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
  }))
}

neonConfig.fetchEndpoint = (host) => `https://${host}/sql`
export function ratingDatabase(cachedRead = false) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  return neon(
    process.env.DATABASE_URL,
    cachedRead ? {} : { fetchOptions: { cache: 'no-store' } },
  )
}
export async function readWorkspace() {
  const sql = ratingDatabase()
  const [workspace, profiles, runs, counts] = await Promise.all([
    sql`SELECT draft, revision, active_profile_id::text, active_snapshot_id::text FROM rating_workspace WHERE singleton`,
    sql`SELECT id::text, label, notes, author, published_at::text FROM rating_profiles ORDER BY published_at DESC LIMIT 30`,
    sql`SELECT id::text, started_at::text, finished_at::text, status, message, collected, requests, players FROM rating_job_runs ORDER BY started_at DESC LIMIT 12`,
    sql`SELECT battles::float AS battles,battles::float AS eligible,latest::text AS latest FROM rating_totals WHERE singleton`,
  ])
  return {
    workspace: workspace[0] ?? null,
    profiles,
    runs,
    counts: counts[0],
  }
}
export async function saveDraft(config: RatingProfile, revision: number) {
  const sql = ratingDatabase()
  const rows =
    await sql`UPDATE rating_workspace SET draft = ${JSON.stringify(config)}::jsonb, revision = revision + 1, updated_at = now() WHERE singleton AND revision = ${revision} RETURNING revision`
  return rows[0]?.revision as number | undefined
}
export async function publicScores(
  kind: 'card' | 'ability',
  league: string,
  format: string,
  subject?: string,
  cachedRead = false,
) {
  const sql = ratingDatabase(cachedRead)
  const rows = await sql`
    SELECT s.data, p.id::text AS profile_id, p.label, p.notes, p.author, p.published_at::text, sn.created_at::text AS scored_at
    FROM rating_workspace w JOIN rating_profiles p ON p.id = w.active_profile_id
    JOIN rating_snapshots sn ON sn.id = w.active_snapshot_id JOIN rating_scores s ON s.snapshot_id = sn.id
    WHERE w.singleton AND s.kind = ${kind} AND s.league = ${league} AND s.format = ${format} AND (${subject ?? null}::text IS NULL OR s.subject = ${subject ?? null})
  `
  const first = rows[0]
  const publication: PublishedInfo | null = first
    ? {
        id: first.profile_id,
        label: first.label,
        notes: first.notes,
        author: first.author,
        publishedAt: first.published_at,
      }
    : null
  return {
    items: rows.map((r) => r.data) as (CardRating | AbilityRating)[],
    publication,
    scoredAt: first?.scored_at as string | undefined,
  }
}
export async function publishedConfig(cachedRead = false) {
  const sql = ratingDatabase(cachedRead)
  const rows =
    await sql`SELECT p.id::text, p.config FROM rating_workspace w JOIN rating_profiles p ON p.id = w.active_profile_id WHERE w.singleton`
  return rows[0] as { id: string; config: RatingProfile } | undefined
}
export async function collectorStatus(
  cachedRead = false,
): Promise<CollectorStatus> {
  const sql = ratingDatabase(cachedRead)
  const [counts, runs] = await Promise.all([
    sql`SELECT battles::float AS battles,battles::float AS ranked_battles,battles::float AS eligible_battles,latest::text AS last_battle FROM rating_totals WHERE singleton`,
    sql`SELECT status, message, collected, finished_at::text FROM rating_job_runs ORDER BY started_at DESC LIMIT 1`,
  ])
  return {
    battles: counts[0].battles,
    rankedBattles: counts[0].ranked_battles,
    eligibleBattles: counts[0].eligible_battles,
    lastBattle: counts[0].last_battle,
    lastRun: runs[0]
      ? {
          status: runs[0].status,
          message: runs[0].message,
          collected: runs[0].collected,
          finishedAt: runs[0].finished_at,
        }
      : null,
  }
}

export async function readEvidence(): Promise<Record<string, Evidence>> {
  const sql = ratingDatabase()
  const [rows, usageRows] = await Promise.all([
    sql`WITH weighted AS (
      SELECT *,power(0.5,greatest(0,(now() AT TIME ZONE 'UTC')::date-day)::float/30) AS weight
      FROM rating_daily_evidence WHERE day >= (now() AT TIME ZONE 'UTC')::date-89
    ) SELECT kind,subject,league,format,sum(battles)::int AS battles,count(*)::int AS days,
      sum(wins)::int AS wins,sum(draws)::int AS draws,sum(battles*weight)::float AS effective,
      greatest(0,least(1,0.5+sum(weight*(wins+draws*0.5-expected))/nullif(sum(battles*weight),0)))::float AS adjusted,
      (sum(wins+draws*0.5)/nullif(sum(battles),0))::float AS raw_rate,
      (max(day)::timestamp AT TIME ZONE 'UTC')::text AS latest,sum(standard_battles)::int AS standard_battles
      FROM weighted GROUP BY kind,subject,league,format`,
    sql`WITH totals AS (
      SELECT league,format,sum(battles)::int AS total,
        sum(battles*power(0.5,greatest(0,(now() AT TIME ZONE 'UTC')::date-day)::float/30))::float AS mass
      FROM rating_daily_totals WHERE day >= (now() AT TIME ZONE 'UTC')::date-89 GROUP BY league,format
    ), cards AS (
      SELECT card_id,league,format,sum(matches)::int AS battles,count(*)::int AS days,
        sum(matches*power(0.5,greatest(0,(now() AT TIME ZONE 'UTC')::date-day)::float/30))::float AS effective
      FROM rating_daily_usage WHERE day >= (now() AT TIME ZONE 'UTC')::date-89 GROUP BY card_id,league,format
    ) SELECT c.*,t.total,t.mass,c.battles::float/nullif(t.total,0) AS rate,
      c.effective/nullif(t.mass,0) AS weighted_rate FROM cards c JOIN totals t USING(league,format)`,
  ])
  const evidence: Record<string, Evidence> = Object.fromEntries(
    rows.map((r) => [
      `${r.kind}:${r.subject}:${r.league}:${r.format}`,
      {
        battles: r.battles,
        days: r.days,
        wins: r.wins,
        draws: r.draws,
        effective: r.effective,
        adjustedWinRate: r.adjusted,
        rawWinRate: r.raw_rate,
        lastPlayed: r.latest,
        standardBattles: r.standard_battles,
        nonStandardBattles: r.battles - r.standard_battles,
      },
    ]),
  )
  for (const r of usageRows) {
    const key = `card:${r.card_id}:${r.league}:${r.format}`
    evidence[key] = {
      ...(evidence[key] ?? EMPTY_EVIDENCE),
      usage: {
        battles: r.battles,
        totalBattles: r.total,
        days: r.days,
        effective: r.effective,
        totalEffective: r.mass,
        rate: r.rate,
        weightedRate: r.weighted_rate,
      },
    }
  }
  return evidence
}

export async function writeSnapshot(
  profileId: string,
  scores: { cards: CardRating[]; abilities: AbilityRating[] },
  publication?: {
    config: RatingProfile
    revision: number
    label: string
    notes: string
    author: string
    draft?: RatingProfile
  },
) {
  const sql = ratingDatabase(),
    snapshotId = randomUUID()
  const records = [
    ...scores.cards.map((data) => ({
      kind: 'card',
      subject: String(data.cardId),
      league: data.league,
      format: data.format,
      data,
    })),
    ...scores.abilities.map((data) => ({
      kind: 'ability',
      subject: data.name,
      league: data.league,
      format: data.format,
      data,
    })),
  ]
  const queries = [
    sql`SELECT singleton FROM rating_workspace WHERE singleton FOR UPDATE`,
  ]
  if (publication)
    queries.push(sql`
    INSERT INTO rating_profiles (id, label, notes, config, author)
    SELECT ${profileId}::uuid, ${publication.label}, ${publication.notes}, ${JSON.stringify(publication.config)}::jsonb, ${publication.author}
    FROM rating_workspace WHERE singleton AND revision = ${publication.revision}
  `)
  queries.push(
    publication
      ? sql`
    INSERT INTO rating_snapshots (id, profile_id, engine_version, battle_count)
    SELECT ${snapshotId}::uuid, id, ${ENGINE_VERSION}, (SELECT battles FROM rating_totals WHERE singleton) FROM rating_profiles WHERE id = ${profileId}::uuid
  `
      : sql`
    INSERT INTO rating_snapshots (id, profile_id, engine_version, battle_count)
    SELECT ${snapshotId}::uuid, active_profile_id, ${ENGINE_VERSION}, (SELECT battles FROM rating_totals WHERE singleton)
    FROM rating_workspace WHERE singleton AND active_profile_id = ${profileId}::uuid
  `,
  )
  for (let i = 0; i < records.length; i += 400)
    queries.push(sql`
    INSERT INTO rating_scores (snapshot_id, kind, subject, league, format, data)
    SELECT sn.id, s.kind, s.subject, s.league, s.format, s.data FROM rating_snapshots sn
    CROSS JOIN jsonb_to_recordset(${JSON.stringify(records.slice(i, i + 400))}::jsonb) AS s(kind text, subject text, league text, format text, data jsonb)
    WHERE sn.id = ${snapshotId}::uuid
  `)
  queries.push(
    publication
      ? sql`
    UPDATE rating_workspace SET active_profile_id = ${profileId}::uuid, active_snapshot_id = ${snapshotId}::uuid, revision = revision + 1, updated_at = now(), draft = COALESCE(${publication.draft ? JSON.stringify(publication.draft) : null}::jsonb, draft)
    WHERE singleton AND EXISTS (SELECT 1 FROM rating_snapshots WHERE id = ${snapshotId}::uuid) RETURNING revision
  `
      : sql`
    UPDATE rating_workspace SET active_snapshot_id = ${snapshotId}::uuid, updated_at = now()
    WHERE singleton AND active_profile_id = ${profileId}::uuid AND EXISTS (SELECT 1 FROM rating_snapshots WHERE id = ${snapshotId}::uuid) RETURNING revision
  `,
  )
  // Keep only the active score snapshot. Profile configurations retain curation history.
  queries.push(sql`DELETE FROM rating_snapshots
    WHERE id <> (SELECT active_snapshot_id FROM rating_workspace WHERE singleton)
      AND EXISTS (SELECT 1 FROM rating_snapshots WHERE id=${snapshotId}::uuid)`)
  const results = await sql.transaction(queries)
  return results.at(-2)?.[0]?.revision as number | undefined
}
