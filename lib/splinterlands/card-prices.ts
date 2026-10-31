export type SaleListing = {
  foil?: number | string
  gold?: boolean
  edition: number | string
  buy_price: number | string
  bcx: number | string
  currency?: string
}
export type FoilPrice = {
  foil: number
  perBcx: number | null
  singleBcx: number | null
  listings: number
}
export function summarizePrices(
  listings: SaleListing[],
  edition: number
): FoilPrice[] {
  return [0, 1, 2, 3, 4].map((foil) => {
    const rows = listings.filter(
      (row) =>
        Number(row.edition) === edition &&
        Number(row.foil ?? (row.gold ? 1 : 0)) === foil &&
        (row.currency === undefined || row.currency === 'USD') &&
        Number.isFinite(Number(row.buy_price)) &&
        Number(row.buy_price) > 0 &&
        Number.isFinite(Number(row.bcx)) &&
        Number(row.bcx) > 0
    )
    const singles = rows.filter((row) => Number(row.bcx) === 1)
    return {
      foil,
      perBcx: rows.length
        ? Math.min(
            ...rows.map((row) => Number(row.buy_price) / Number(row.bcx))
          )
        : null,
      singleBcx: singles.length
        ? Math.min(...singles.map((row) => Number(row.buy_price)))
        : null,
      listings: rows.length,
    }
  })
}
