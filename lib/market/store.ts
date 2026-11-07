// Server routes and maintenance scripts only. UI imports history.ts instead.
import { neon, neonConfig } from '@neondatabase/serverless'
import type { FoilPrice } from '../splinterlands/card-prices'
import type { PriceHistory } from './history'
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`
export function priceDatabase(cachedRead = false) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  return neon(
    process.env.DATABASE_URL,
    cachedRead ? {} : { fetchOptions: { cache: 'no-store' } },
  )
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
  cachedRead = false,
): Promise<PriceHistory> {
  const sql = priceDatabase(cachedRead)
  const [rows, first] = await Promise.all([
    sql`SELECT t.day::text,t.completed_at::text AS "observedAt",
      coalesce(jsonb_agg(jsonb_build_array(h.foil,h.per_bcx::float,h.single_bcx::float,h.listings)
        ORDER BY h.foil) FILTER (WHERE h.foil IS NOT NULL),'[]'::jsonb) AS prices
      FROM card_price_targets t
      LEFT JOIN card_price_history h ON h.day=t.day AND h.card_id=t.card_id AND h.edition=t.edition
      WHERE t.card_id=${cardId} AND t.edition=${edition} AND t.completed_at IS NOT NULL
      AND t.day >= (now() AT TIME ZONE 'UTC')::date-364
      GROUP BY t.day,t.completed_at ORDER BY t.day`,
    sql`SELECT min(day)::text AS day FROM card_price_targets
      WHERE card_id=${cardId} AND edition=${edition} AND completed_at IS NOT NULL`,
  ])
  return {
    // Transfer each day's timestamp once and only populated foil values. Expand
    // completed empty markets here; uncollected days must still remain gaps.
    points: rows.flatMap((row) => {
      const prices = new Map<number, [number | null, number | null, number]>(
        row.prices.map(
          ([foil, ...values]: [
            number,
            number | null,
            number | null,
            number,
          ]) => [foil, values],
        ),
      )
      return Array.from({ length: 5 }, (_, foil) => {
        const [perBcx, singleBcx, listings] = prices.get(foil) ?? [
          null,
          null,
          0,
        ]
        return {
          day: row.day,
          observedAt: row.observedAt,
          foil,
          perBcx,
          singleBcx,
          listings,
        }
      })
    }),
    firstDay: first[0]?.day ?? null,
  }
}
