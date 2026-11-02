import { LEAGUES, type BattleFormat, type League } from './types'
export type TierKey = 'S' | 'A' | 'B' | 'C' | 'D'
export type ScopeScore = {
  cardId: number
  league: League
  format: BattleFormat
  score: number
}
export type TierRatingSummary = {
  average: number
  tier: TierKey
  scopes: ScopeScore[]
}
export type TierRatingIndex = Record<number, TierRatingSummary>
export function tierForScore(score: number): TierKey {
  return score >= 9
    ? 'S'
    : score >= 8
      ? 'A'
      : score >= 6.5
        ? 'B'
        : score >= 5
          ? 'C'
          : 'D'
}
export function summarizeTierRatings(rows: ScopeScore[]): TierRatingIndex {
  const cards = new Map<number, Map<string, ScopeScore>>()
  for (const row of rows) {
    if (
      !Number.isFinite(row.score) ||
      row.score < 0 ||
      row.score > 10 ||
      !LEAGUES.includes(row.league) ||
      !['modern', 'wild'].includes(row.format)
    )
      continue
    const scopes = cards.get(row.cardId) ?? new Map<string, ScopeScore>()
    scopes.set(`${row.league}:${row.format}`, row)
    cards.set(row.cardId, scopes)
  }
  return Object.fromEntries(
    Array.from(cards, ([id, values]) => {
      const scopes = Array.from(values.values())
      const average = Number(
        (scopes.reduce((sum, r) => sum + r.score, 0) / scopes.length).toFixed(
          12,
        ),
      )
      return [id, { average, tier: tierForScore(average), scopes }]
    }),
  )
}
export function tierMismatch(
  tier: TierKey | null,
  summary: TierRatingSummary | undefined,
) {
  return !!tier && !!summary && tier !== summary.tier
}
