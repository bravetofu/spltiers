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
  // Lifetime collected sample, without strength-model time/volume weighting.
  const rows = await sql`
    SELECT u.card_id, b.league, b.format, count(*)::int AS uses,
      count(*) FILTER (WHERE u.outcome = 1)::int AS wins,
      count(*) FILTER (WHERE u.outcome = 0)::int AS losses,
      count(*) FILTER (WHERE u.outcome = 0.5)::int AS draws
    FROM rating_card_usage u JOIN rating_battles b ON b.id = u.battle_id
    WHERE b.eligible AND b.league IS NOT NULL
    GROUP BY u.card_id, b.league, b.format
    ORDER BY u.card_id, b.league, b.format
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
    sql`SELECT count(*)::int AS battles, count(*) FILTER (WHERE eligible)::int AS eligible, max(played_at)::text AS latest FROM rating_battles`,
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
  const [rows, usageRows] = await Promise.all([
    sql`
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
  `,
    sql`
    WITH recent AS (
      SELECT id, league, format, played_at,
        raw->>'player_1' AS player1, raw->>'player_2' AS player2
      FROM rating_battles
      WHERE eligible AND league IS NOT NULL AND played_at >= now() - interval '90 days'
    ), sides AS (
      SELECT id, league, format, played_at, player1 AS player, 1 AS side FROM recent
      UNION ALL
      SELECT id, league, format, played_at, player2, 2 FROM recent
    ), volumes AS (
      SELECT *, count(*) OVER (PARTITION BY league, format, player, (played_at AT TIME ZONE 'UTC')::date) AS volume
      FROM sides
    ), weighted AS (
      SELECT id, league, format, played_at,
        power(0.5, greatest(0, extract(epoch FROM (now() - played_at)) / 86400) / 30)
          * least(1.0, 10.0 / max(volume)) AS weight
      FROM volumes GROUP BY id, league, format, played_at
    ), totals AS (
      SELECT league, format, count(*)::int AS total, sum(weight)::float AS mass
      FROM weighted GROUP BY league, format
    ), appearances AS (
      SELECT w.*, u.card_id, v.player
      FROM weighted w JOIN rating_card_usage u ON u.battle_id = w.id
      JOIN volumes v ON v.id = u.battle_id AND v.side = u.side
    ), card_matches AS (
      SELECT DISTINCT id, league, format, played_at, weight, card_id FROM appearances
    ), breadth AS (
      SELECT card_id, league, format, count(DISTINCT player)::int AS players
      FROM appearances GROUP BY card_id, league, format
    )
    SELECT c.card_id, c.league, c.format, count(*)::int AS battles, t.total,
      b.players, count(DISTINCT (c.played_at AT TIME ZONE 'UTC')::date)::int AS days,
      sum(c.weight)::float AS effective, t.mass,
      count(*)::float / t.total AS rate, sum(c.weight)::float / t.mass AS weighted_rate
    FROM card_matches c JOIN totals t USING (league, format)
    JOIN breadth b USING (card_id, league, format)
    GROUP BY c.card_id, c.league, c.format, t.total, t.mass, b.players
  `,
  ])
  const evidence: Record<string, Evidence> = Object.fromEntries(
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
  for (const r of usageRows) {
    const key = `card:${r.card_id}:${r.league}:${r.format}`
    evidence[key] = {
      ...(evidence[key] ?? EMPTY_EVIDENCE),
      usage: {
        battles: r.battles,
        totalBattles: r.total,
        players: r.players,
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
  // Preserve each publication's first snapshot and its two newest snapshots.
  // Raw battles and curated profile history are retained independently.
  queries.push(sql`DELETE FROM rating_snapshots WHERE id IN (
    SELECT id FROM (
      SELECT id, row_number() OVER (ORDER BY created_at, id) AS first_rank,
        row_number() OVER (ORDER BY created_at DESC, id DESC) AS newest_rank
      FROM rating_snapshots WHERE profile_id = ${profileId}::uuid
    ) ranked WHERE first_rank > 1 AND newest_rank > 2
  ) AND id <> (SELECT active_snapshot_id FROM rating_workspace WHERE singleton)
    AND EXISTS (SELECT 1 FROM rating_snapshots WHERE id = ${snapshotId}::uuid)`)
  const results = await sql.transaction(queries)
  return results.at(-2)?.[0]?.revision as number | undefined
}
