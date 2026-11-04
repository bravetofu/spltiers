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
  if (
    prices.some(
      (p) =>
        !Number.isSafeInteger(p.listings) ||
        p.listings < 0 ||
        (p.listings === 0
          ? p.perBcx !== null || p.singleBcx !== null
          : p.perBcx === null || !Number.isFinite(p.perBcx) || p.perBcx <= 0) ||
        (p.singleBcx !== null &&
          (!Number.isFinite(p.singleBcx) || p.singleBcx <= 0)),
    )
  )
    throw new Error('Invalid daily market snapshot')
  if (
    !Number.isFinite(Date.parse(observedAt)) ||
    new Date(observedAt).toISOString().slice(0, 10) !== day
  )
    throw new Error('Observation must belong to its UTC day')
  const sql = priceDatabase()
  // Publish all five foils atomically, and never rewrite the first daily sample.
  await sql.transaction([
    sql`SELECT day FROM card_price_targets WHERE day=${day}::date AND card_id=${cardId} AND edition=${edition} FOR UPDATE`,
    sql`INSERT INTO card_price_history (day, card_id, edition, foil, per_bcx, single_bcx, listings, observed_at)
      SELECT ${day}::date, ${cardId}, ${edition}, foil, "perBcx", "singleBcx", listings, ${observedAt}::timestamptz
      FROM jsonb_to_recordset(${JSON.stringify(prices)}::jsonb) AS p(foil smallint, "perBcx" numeric, "singleBcx" numeric, listings integer)
      WHERE listings>0 AND NOT EXISTS(SELECT 1 FROM card_price_targets
        WHERE day=${day}::date AND card_id=${cardId} AND edition=${edition} AND completed_at IS NOT NULL)
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
    sql`SELECT t.day::text,f.foil,h.per_bcx::float AS "perBcx",h.single_bcx::float AS "singleBcx",
      coalesce(h.listings,0) AS listings,t.completed_at::text AS "observedAt"
      FROM card_price_targets t CROSS JOIN generate_series(0,4) AS f(foil)
      LEFT JOIN card_price_history h ON h.day=t.day AND h.card_id=t.card_id AND h.edition=t.edition AND h.foil=f.foil
      WHERE t.card_id=${cardId} AND t.edition=${edition} AND t.completed_at IS NOT NULL
      AND t.day >= (now() AT TIME ZONE 'UTC')::date-364 ORDER BY t.day,f.foil`,
    sql`SELECT min(day)::text AS day FROM card_price_targets
      WHERE card_id=${cardId} AND edition=${edition} AND completed_at IS NOT NULL`,
  ])
  return {
    points: rows as PriceHistory['points'],
    firstDay: first[0]?.day ?? null,
  }
}
