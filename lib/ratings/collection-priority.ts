import { LEAGUES, type BattleFormat, type League } from './types'

export type Coverage = { format: BattleFormat; league: League; battles: number }
export type CollectionTarget = {
  player: string
  format: BattleFormat
  league: League | null
  lastChecked: string | null
}

export function prioritizeTargets(
  targets: CollectionTarget[],
  coverage: Coverage[],
  limit = 40,
): CollectionTarget[] {
  const counts = new Map(
    coverage.map((c) => [`${c.format}:${c.league}`, c.battles]),
  )
  const totals = (format: BattleFormat) =>
    LEAGUES.reduce(
      (sum, league) => sum + (counts.get(`${format}:${league}`) ?? 0),
      0,
    )
  const age = (target: CollectionTarget) =>
    target.lastChecked ? new Date(target.lastChecked).getTime() : 0
  const pool = [...targets]
  const result: CollectionTarget[] = []
  const allocated = new Map<string, number>()
  while (pool.length && result.length < limit) {
    // Every fifth request explores the longest-unchecked account/format, even
    // if its known cap already has abundant data. Unknown caps stay discoverable.
    const explore = result.length % 5 === 4
    const priority = (t: CollectionTarget) => {
      const key = `${t.format}:${t.league ?? 'unknown'}`
      const count = t.league
        ? (counts.get(key) ?? 0)
        : totals(t.format) / LEAGUES.length
      return count + (allocated.get(key) ?? 0) * 20
    }
    pool.sort(
      (a, b) =>
        (explore ? 0 : priority(a) - priority(b)) ||
        age(a) - age(b) ||
        totals(a.format) - totals(b.format) ||
        a.player.localeCompare(b.player) ||
        a.format.localeCompare(b.format),
    )
    const next = pool.shift()!
    result.push(next)
    const key = `${next.format}:${next.league ?? 'unknown'}`
    allocated.set(key, (allocated.get(key) ?? 0) + 1)
  }
  return result
}
