import 'server-only'
import { ENGINE_VERSION } from './types'
import { unstable_cache } from 'next/cache'
import {
  ratingDatabase,
  publicScores,
  collectorStatus,
  readCardBattleStats,
  readCardRatings,
} from './store'
import { EMPTY_BATTLE_STATS, type BattleStats } from './battle-stats'
import { summarizeTierRatings, type ScopeScore } from './tier-reference'
import type {
  AbilityRating,
  AbilitySummary,
  AbilityWeight,
  BattleFormat,
  Confidence,
  League,
  Synergy,
} from './types'

export type ScoreIndex = Record<
  string,
  [number, Confidence, number, BattleFormat, BattleStats | null]
>
export const getTierReferenceRatings = unstable_cache(
  async (cardIds: number[]) => {
    if (!cardIds.length) return {}
    const sql = ratingDatabase(true)
    const rows = await sql`
      SELECT s.subject::int AS "cardId", s.league, s.format, (s.data->>'score')::float AS score
      FROM rating_workspace w JOIN rating_scores s ON s.snapshot_id=w.active_snapshot_id
      WHERE w.singleton AND s.kind='card' AND s.subject=ANY(${cardIds.map(String)}::text[])
    `
    return summarizeTierRatings(rows as ScopeScore[])
  },
  ['tier-reference-ratings-v2', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 86400 },
)
// Daily score data and hourly lifetime statistics have independent cache tags.
// Compose them outside the caches so neither clock forces the other to refill.
const getScopeBattleStats = unstable_cache(
  (league: League, format: BattleFormat | 'auto') =>
    readCardBattleStats(true, { league, format }),
  ['scope-battle-usage-v2'],
  { tags: ['rating-collection'], revalidate: 3600 },
)
const getCardBattleStats = unstable_cache(
  (cardId: number) => readCardBattleStats(true, { cardId }),
  ['card-battle-usage-v2'],
  { tags: ['rating-collection'], revalidate: 3600 },
)
const getScoreIndexRows = unstable_cache(
  async (league: League, format: BattleFormat | 'auto') => {
    const sql = ratingDatabase(true)
    return await sql`
      SELECT DISTINCT ON (s.subject) s.subject, (s.data->>'score')::float AS score,
        s.data->>'confidence' AS confidence, (s.data->'evidence'->>'battles')::int AS battles, s.format
      FROM rating_workspace w JOIN rating_scores s ON s.snapshot_id=w.active_snapshot_id
      WHERE w.singleton AND s.kind='card' AND s.league=${league} AND (${format}='auto' OR s.format=${format})
      ORDER BY s.subject,s.format
    `
  },
  ['rating-index-rows-v3', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 86400 },
)
export async function getRatingIndex(
  league: League,
  format: BattleFormat | 'auto',
): Promise<ScoreIndex> {
  const [rows, stats] = await Promise.all([
    getScoreIndexRows(league, format),
    getScopeBattleStats(league, format).catch(() => null),
  ])
  const usage = new Map(
    stats?.map((s) => [`${s.cardId}:${s.league}:${s.format}`, s]),
  )
  return Object.fromEntries(
    rows.map((row) => [
      row.subject,
      [
        row.score,
        row.confidence,
        row.battles,
        row.format,
        stats === null
          ? null
          : (usage.get(`${row.subject}:${league}:${row.format}`) ??
            EMPTY_BATTLE_STATS),
      ],
    ]),
  )
}
const getCardScoreData = unstable_cache(
  (id: number) => readCardRatings(id, true),
  ['card-score-data-v3', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 86400 },
)
export async function getCardRatings(id: number) {
  const [scores, battleStats] = await Promise.all([
    getCardScoreData(id),
    getCardBattleStats(id).catch(() => null),
  ])
  return { ...scores, battleStats }
}
export const getAbilityRatings = unstable_cache(
  async (league: League, format: BattleFormat, name?: string) =>
    publicScores('ability', league, format, name, true),
  ['ability-ratings-v3', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 86400 },
)
// The directory does not display full evidence or breakdowns. Project in SQL
// so those fields never cross the Neon connection on a list cache miss.
export const getAbilitySummaries = unstable_cache(
  async (league: League, format: BattleFormat) => {
    const result = await publicScores(
      'ability',
      league,
      format,
      undefined,
      true,
      true,
    )
    return { ...result, items: result.items as AbilitySummary[] }
  },
  ['ability-summaries-v1', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 86400 },
)
export const getAbilityDetails = unstable_cache(
  async (name: string) => {
    const sql = ratingDatabase(true)
    const rows = await sql`
      SELECT p.config->'abilities'->${name} AS weight,
        (SELECT coalesce(jsonb_agg(s.value ORDER BY s.ordinality), '[]'::jsonb)
         FROM jsonb_array_elements(p.config->'synergies') WITH ORDINALITY AS s(value,ordinality)
         WHERE s.value->'abilities' ? ${name}) AS synergies,
        (p.config->>'standardWeight')::float AS standard_weight,
        coalesce((SELECT jsonb_agg(s.data) FROM rating_scores s
          WHERE s.snapshot_id = w.active_snapshot_id AND s.kind = 'ability' AND s.subject = ${name}), '[]'::jsonb) AS ratings
      FROM rating_workspace w JOIN rating_profiles p ON p.id = w.active_profile_id WHERE w.singleton
    `
    return {
      weight: rows[0]?.weight as AbilityWeight | undefined,
      standardWeight: (rows[0]?.standard_weight ?? 0.2) as number,
      synergies: (rows[0]?.synergies ?? []) as Synergy[],
      ratings: (rows[0]?.ratings ?? []) as AbilityRating[],
    }
  },
  ['ability-details-v3', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 86400 },
)
export const getPublicRatingSettings = unstable_cache(
  async () => {
    const sql = ratingDatabase(true)
    const rows = await sql`
      SELECT p.id::text, (p.config->>'standardWeight')::float AS "standardWeight",
        (SELECT coalesce(jsonb_object_agg(a.key, jsonb_build_object(
          'standard', a.value->'standard', 'nonStandard', a.value->'nonStandard',
          'multiplier', a.value->'multiplier', 'drawback', a.value->'drawback')), '{}'::jsonb)
         FROM jsonb_each(p.config->'abilities') a) AS abilities
      FROM rating_workspace w JOIN rating_profiles p ON p.id=w.active_profile_id WHERE w.singleton
    `
    return rows[0] as
      | {
          id: string
          standardWeight: number
          abilities: Record<
            string,
            Pick<
              AbilityWeight,
              'standard' | 'nonStandard' | 'multiplier' | 'drawback'
            >
          >
        }
      | undefined
  },
  ['public-rating-settings-v1', ENGINE_VERSION],
  { tags: ['ratings'], revalidate: 86400 },
)
export const getCollectorStatus = unstable_cache(
  () => collectorStatus(true),
  ['rating-collector-v2'],
  { tags: ['ratings', 'rating-collection'], revalidate: 3600 },
)
