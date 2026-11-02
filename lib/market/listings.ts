import { summarizePrices, type SaleListing } from '../splinterlands/card-prices'
export class MarketError extends Error {}
export async function fetchDailyPrices(
  cardId: number,
  edition: number,
  fetcher: typeof fetch = fetch,
) {
  const pages = await Promise.all(
    [false, true].map(async (gold) => {
      const response = await fetcher(
        `https://api2.splinterlands.com/market/for_sale_by_card?card_detail_id=${cardId}&gold=${gold}&edition=${edition}`,
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(20000),
        },
      )
      if (!response.ok)
        throw new MarketError(
          response.status === 429 ? 'rate_limited' : 'upstream_unavailable',
        )
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new MarketError('invalid_response')
      // Fail closed on malformed or cross-card data rather than recording a false empty market.
      if (
        data.some(
          (r) =>
            !r ||
            typeof r !== 'object' ||
            Number(r.card_detail_id) !== cardId ||
            Number(r.edition) !== edition ||
            !Number.isFinite(Number(r.buy_price)) ||
            Number(r.buy_price) <= 0 ||
            !Number.isFinite(Number(r.bcx)) ||
            Number(r.bcx) <= 0 ||
            ![0, 1, 2, 3, 4].includes(Number(r.foil ?? (r.gold ? 1 : 0))),
        )
      )
        throw new MarketError('invalid_response')
      return data as (SaleListing & { market_id?: string; uid?: string })[]
    }),
  )
  const seen = new Set<string>()
  const listings = pages.flat().filter((row) => {
    const key = row.uid ?? row.market_id
    if (!key) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return summarizePrices(listings, edition)
}
