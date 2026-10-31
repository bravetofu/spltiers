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
import { ENGINE_VERSION } from './types'

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
    sql`SELECT count(*)::int AS battles, count(*) FILTER (WHERE eligible)::int AS eligible, max(played_at)::text AS latest FROM rating_battles`,
  ])
  return { workspace: workspace[0] ?? null, profiles, runs, counts: counts[0] }
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
    sql`SELECT count(*)::int AS battles, count(*) FILTER (WHERE match_type = 'Ranked')::int AS ranked_battles, count(*) FILTER (WHERE eligible)::int AS eligible_battles, max(played_at)::text AS last_battle FROM rating_battles`,
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
  // Limit dominance by prolific accounts before time decay, and exclude mirrored
  // features. Two sides of one match are not independent card-strength evidence.
  const rows = await sql`
    WITH recent AS (
      SELECT o.*, b.format, b.league, b.played_at, b.rulesets,
        row_number() OVER (PARTITION BY o.kind, o.subject, b.format, b.league, o.player, (b.played_at AT TIME ZONE 'UTC')::date ORDER BY b.played_at DESC) AS daily_rank
      FROM rating_observations o JOIN rating_battles b ON b.id = o.battle_id
      WHERE b.eligible AND NOT o.mirrored AND b.league IS NOT NULL AND b.played_at >= now() - interval '90 days'
    ), weighted AS (
      SELECT *, power(0.5, greatest(0, extract(epoch FROM (now() - played_at)) / 86400) / 30) AS weight
      FROM recent WHERE daily_rank <= 10
    )
    SELECT kind, subject, league, format, count(*)::int AS battles, count(DISTINCT player)::int AS players,
      count(DISTINCT (played_at AT TIME ZONE 'UTC')::date)::int AS days,
      count(*) FILTER (WHERE outcome = 1)::int AS wins, count(*) FILTER (WHERE outcome = 0.5)::int AS draws,
      sum(weight)::float AS effective,
      greatest(0, least(1, 0.5 + sum(weight * (outcome - expected)) / nullif(sum(weight), 0)))::float AS adjusted,
      avg(outcome)::float AS raw_rate, max(played_at)::text AS latest,
      count(*) FILTER (WHERE cardinality(rulesets) = 0 OR rulesets = ARRAY['Standard'])::int AS standard_battles
    FROM weighted GROUP BY kind, subject, league, format
  `
  return Object.fromEntries(
    rows.map((r) => [
      `${r.kind}:${r.subject}:${r.league}:${r.format}`,
      {
        battles: r.battles,
        players: r.players,
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
    SELECT ${snapshotId}::uuid, id, ${ENGINE_VERSION}, (SELECT count(*) FROM rating_battles WHERE eligible) FROM rating_profiles WHERE id = ${profileId}::uuid
  `
      : sql`
    INSERT INTO rating_snapshots (id, profile_id, engine_version, battle_count)
    SELECT ${snapshotId}::uuid, active_profile_id, ${ENGINE_VERSION}, (SELECT count(*) FROM rating_battles WHERE eligible)
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
    UPDATE rating_workspace SET active_profile_id = ${profileId}::uuid, active_snapshot_id = ${snapshotId}::uuid, revision = revision + 1, updated_at = now()
    WHERE singleton AND EXISTS (SELECT 1 FROM rating_snapshots WHERE id = ${snapshotId}::uuid) RETURNING revision
  `
      : sql`
    UPDATE rating_workspace SET active_snapshot_id = ${snapshotId}::uuid, updated_at = now()
    WHERE singleton AND active_profile_id = ${profileId}::uuid AND EXISTS (SELECT 1 FROM rating_snapshots WHERE id = ${snapshotId}::uuid) RETURNING revision
  `,
  )
  const results = await sql.transaction(queries)
  return results.at(-1)?.[0]?.revision as number | undefined
}
