import 'server-only'
import { ENGINE_VERSION } from './types'
import { unstable_cache } from 'next/cache'
import {
  ratingDatabase,
  publicScores,
  publishedConfig,
  collectorStatus,
} from './store'
import type {
  AbilityRating,
  AbilityWeight,
  BattleFormat,
  CardRating,
  Confidence,
  League,
  Synergy,
} from './types'

export type ScoreIndex = Record<
  string,
  [number, Confidence, number, BattleFormat]
>
export const getRatingIndex = unstable_cache(
  async (
    league: League,
    format: BattleFormat | 'auto',
  ): Promise<ScoreIndex> => {
    const sql = ratingDatabase(true)
    const rows = await sql`
    SELECT DISTINCT ON (s.subject) s.subject, (s.data->>'score')::float AS score,
      s.data->>'confidence' AS confidence, (s.data->'evidence'->>'battles')::int AS battles, s.format
    FROM rating_workspace w JOIN rating_scores s ON s.snapshot_id = w.active_snapshot_id
    WHERE w.singleton AND s.kind = 'card' AND s.league = ${league} AND (${format} = 'auto' OR s.format = ${format})
    ORDER BY s.subject, s.format
  `
    return Object.fromEntries(
      rows.map((row) => [
        row.subject,
        [row.score, row.confidence, row.battles, row.format],
      ]),
    )
  },
  ['rating-index-v1', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 300 },
)
export const getCardRatings = unstable_cache(
  async (id: number) => {
    const sql = ratingDatabase(true)
    const rows = await sql`
    SELECT s.data, p.label, p.id::text, p.published_at::text, sn.created_at::text AS scored_at
    FROM rating_workspace w JOIN rating_scores s ON s.snapshot_id = w.active_snapshot_id
    JOIN rating_profiles p ON p.id = w.active_profile_id JOIN rating_snapshots sn ON sn.id = w.active_snapshot_id
    WHERE w.singleton AND s.kind = 'card' AND s.subject = ${String(id)}
  `
    return {
      ratings: rows.map((row) => row.data) as CardRating[],
      version: rows[0]?.label as string | undefined,
      scoredAt: rows[0]?.scored_at as string | undefined,
    }
  },
  ['card-ratings-v1', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 300 },
)
export const getAbilityRatings = unstable_cache(
  async (league: League, format: BattleFormat, name?: string) =>
    publicScores('ability', league, format, name, true),
  ['ability-ratings-v1', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 300 },
)
export const getAbilityDetails = unstable_cache(
  async (name: string) => {
    const sql = ratingDatabase(true)
    const rows = await sql`
      SELECT p.config->'abilities'->${name} AS weight, p.config->'synergies' AS synergies,
        (p.config->>'standardWeight')::float AS standard_weight,
        coalesce((SELECT jsonb_agg(s.data) FROM rating_scores s
          WHERE s.snapshot_id = w.active_snapshot_id AND s.kind = 'ability' AND s.subject = ${name}), '[]'::jsonb) AS ratings
      FROM rating_workspace w JOIN rating_profiles p ON p.id = w.active_profile_id WHERE w.singleton
    `
    return {
      weight: rows[0]?.weight as AbilityWeight | undefined,
      standardWeight: (rows[0]?.standard_weight ?? 0.2) as number,
      synergies: ((rows[0]?.synergies ?? []) as Synergy[]).filter((s) =>
        s.abilities.includes(name),
      ),
      ratings: (rows[0]?.ratings ?? []) as AbilityRating[],
    }
  },
  ['ability-details-v1', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 300 },
)
export const getPublishedProfile = unstable_cache(
  () => publishedConfig(true),
  ['rating-profile-v1', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 300 },
)
export const getCollectorStatus = unstable_cache(
  () => collectorStatus(true),
  ['rating-collector-v1'],
  { tags: ['ratings', 'rating-collection'], revalidate: 60 },
)
