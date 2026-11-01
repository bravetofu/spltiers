import type { BattleFormat, League } from './types'

export type BattleStats = {
  uses: number
  wins: number
  losses: number
  draws: number
}
export type CardBattleStats = BattleStats & {
  cardId: number
  league: League
  format: BattleFormat
}
export const EMPTY_BATTLE_STATS: BattleStats = {
  uses: 0,
  wins: 0,
  losses: 0,
  draws: 0,
}
// A literal win rate. Draws stay in the denominator, without counting as wins.
export function cardWinRate(stats: BattleStats): number | null {
  return stats.uses ? stats.wins / stats.uses : null
}
export function formatWinRate(stats: BattleStats): string {
  const rate = cardWinRate(stats)
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`
}
