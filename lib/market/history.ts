export type PricePoint = {
  day: string
  foil: number
  perBcx: number | null
  singleBcx: number | null
  listings: number | null
  observedAt: string | null
}
export type PriceHistory = { points: PricePoint[]; firstDay: string | null }
const DAY = 86400000
export function dailyPoints(
  points: PricePoint[],
  foil: number,
  days: number,
  today = new Date().toISOString().slice(0, 10),
): PricePoint[] {
  const selected = points
    .filter((p) => p.foil === foil)
    .sort((a, b) => a.day.localeCompare(b.day))
  if (!selected.length) return []
  const end = Date.parse(`${today}T00:00:00Z`)
  const start = Math.max(
    Date.parse(`${selected[0].day}T00:00:00Z`),
    end - (days - 1) * DAY,
  )
  const byDay = new Map(selected.map((p) => [p.day, p]))
  const result: PricePoint[] = []
  for (let at = start; at <= end; at += DAY) {
    const day = new Date(at).toISOString().slice(0, 10)
    result.push(
      byDay.get(day) ?? {
        day,
        foil,
        perBcx: null,
        singleBcx: null,
        listings: null,
        observedAt: null,
      },
    )
  }
  return result
}
// Each missing value breaks its own line. Never interpolate across a missing day.
export function lineSegments(
  points: PricePoint[],
  field: 'perBcx' | 'singleBcx',
  x: (i: number) => number,
  y: (value: number) => number,
) {
  const segments: string[] = []
  let segment = ''
  points.forEach((point, i) => {
    const value = point[field]
    if (value === null) {
      if (segment) segments.push(segment)
      segment = ''
    } else segment += `${segment ? ' L' : 'M'}${x(i)},${y(value)}`
  })
  if (segment) segments.push(segment)
  return segments
}
