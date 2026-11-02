// Server routes and maintenance scripts only. UI imports history.ts instead.
import { neon, neonConfig } from '@neondatabase/serverless'
import type { FoilPrice } from '../splinterlands/card-prices'
import type { PriceHistory } from './history'
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`
export function priceDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  return neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } })
}
export async function saveDailyPrices(
  day: string,
  cardId: number,
  edition: number,
  prices: FoilPrice[],
  observedAt: string,
) {
  if (
    prices.length !== 5 ||
    new Set(prices.map((p) => p.foil)).size !== 5 ||
    prices.some((p) => ![0, 1, 2, 3, 4].includes(p.foil))
  )
    throw new Error('A complete foil snapshot is required')
  const sql = priceDatabase()
  // Publish all five foils atomically, and never rewrite the first daily sample.
  await sql.transaction([
    sql`SELECT day FROM card_price_targets WHERE day=${day}::date AND card_id=${cardId} AND edition=${edition} FOR UPDATE`,
    sql`INSERT INTO card_price_history (day, card_id, edition, foil, per_bcx, single_bcx, listings, observed_at)
      SELECT ${day}::date, ${cardId}, ${edition}, foil, "perBcx", "singleBcx", listings, ${observedAt}::timestamptz
      FROM jsonb_to_recordset(${JSON.stringify(prices)}::jsonb) AS p(foil smallint, "perBcx" numeric, "singleBcx" numeric, listings integer)
      ON CONFLICT (day, card_id, edition, foil) DO NOTHING`,
    sql`UPDATE card_price_targets SET completed_at=coalesce(completed_at,${observedAt}::timestamptz), last_error=NULL
      WHERE day=${day}::date AND card_id=${cardId} AND edition=${edition}`,
  ])
}
export async function readPriceHistory(
  cardId: number,
  edition: number,
): Promise<PriceHistory> {
  const sql = priceDatabase()
  const [rows, first] = await Promise.all([
    sql`SELECT day::text, foil, per_bcx::float AS "perBcx", single_bcx::float AS "singleBcx", listings, observed_at::text AS "observedAt"
      FROM card_price_history WHERE card_id=${cardId} AND edition=${edition}
      AND day >= (now() AT TIME ZONE 'UTC')::date - 365 ORDER BY day, foil`,
    sql`SELECT min(day)::text AS day FROM card_price_history WHERE card_id=${cardId} AND edition=${edition}`,
  ])
  return {
    points: rows as PriceHistory['points'],
    firstDay: first[0]?.day ?? null,
  }
}
