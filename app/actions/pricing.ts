'use server'

import { LEAGUE_LEVEL_CAPS } from '@/lib/editions'

export type CardInput = {
  card_id: number
  card_name: string
  edition: string
  cdn_slug: string
  rarity: number
  tier: string
}

export type BuyMethod = 'pre-combined' | 'buy & combine'

export type CardPrice = {
  card_id: number
  buy_usd: number | null
  buy_bcx: number | null
  buy_method: BuyMethod | null
  rent_day_usd: number | null
}

export type PricingResult = {
  prices: CardPrice[]
  dec_usd_rate: number
  fetched_at: string
}

type SLSaleListing = {
  level: number
  buy_price: string | number
  bcx: number
}

type SLRentListing = {
  level: number
  buy_price: string | number
}

async function fetchDecRate(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=dark-energy-crystals&vs_currencies=usd',
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return 0
    const data = await res.json()
    return data['dark-energy-crystals']?.usd ?? 0
  } catch {
    return 0
  }
}

// Market API calls are never cached — prices must always be live
async function fetchSaleListings(cardId: number): Promise<SLSaleListing[]> {
  try {
    const res = await fetch(
      `https://api2.splinterlands.com/market/for_sale_by_card?card_detail_id=${cardId}&gold=false`,
      { cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function fetchRentListings(cardId: number): Promise<SLRentListing[]> {
  try {
    const res = await fetch(
      `https://api2.splinterlands.com/market/for_rent_by_card?card_detail_id=${cardId}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/**
 * Compute the cheapest buy price in DEC for a card at targetLevel.
 *
 * Option A — pre-combined: cheapest listing where listing.level >= targetLevel.
 *
 * Option B — buy & combine: determine targetBcx from a listing at exactly
 * targetLevel (or nearest level above as upper bound), then find the lowest
 * price-per-BCX across ALL listings and multiply by targetBcx.
 * Using actual BCX values from listings avoids hardcoding combination tables
 * and handles Alpha/Beta correctly (different requirements than modern sets).
 *
 * Returns whichever option is cheaper, or null if neither is available.
 */
function computeBuyDec(
  listings: SLSaleListing[],
  targetLevel: number,
): { dec: number; bcx: number; method: BuyMethod } | null {
  const valid = listings.filter(
    (l) =>
      l.level > 0 &&
      l.bcx > 0 &&
      !isNaN(parseFloat(String(l.buy_price))),
  )
  if (valid.length === 0) return null

  // Option A: pre-combined at or above target level
  const atOrAbove = valid.filter((l) => l.level >= targetLevel)
  let bestA: { dec: number; bcx: number } | null = null
  if (atOrAbove.length > 0) {
    const cheapest = atOrAbove.reduce((best, l) =>
      parseFloat(String(l.buy_price)) < parseFloat(String(best.buy_price)) ? l : best,
    )
    bestA = { dec: parseFloat(String(cheapest.buy_price)), bcx: cheapest.bcx }
  }

  // Option B: buy individual cards and combine
  // Read targetBcx from a listing at exactly targetLevel; fall back to nearest above
  const exactAtTarget = valid.find((l) => l.level === targetLevel)
  let targetBcx: number | null = exactAtTarget?.bcx ?? null
  if (targetBcx === null && atOrAbove.length > 0) {
    const nearestAbove = atOrAbove.slice().sort((a, b) => a.level - b.level)[0]
    targetBcx = nearestAbove.bcx
  }

  let bestB: { dec: number; bcx: number } | null = null
  if (targetBcx !== null) {
    const lowestPerBcx = Math.min(
      ...valid.map((l) => parseFloat(String(l.buy_price)) / l.bcx),
    )
    bestB = { dec: lowestPerBcx * targetBcx, bcx: targetBcx }
  }

  if (!bestA && !bestB) return null
  if (!bestA) return { ...bestB!, method: 'buy & combine' }
  if (!bestB) return { ...bestA!, method: 'pre-combined' }
  return bestA.dec <= bestB.dec
    ? { ...bestA, method: 'pre-combined' }
    : { ...bestB, method: 'buy & combine' }
}

/**
 * Cheapest daily rent rate in DEC for listings at or above targetLevel.
 * BCX logic does not apply to rentals — rental listings are already levelled.
 */
function computeRentDec(listings: SLRentListing[], targetLevel: number): number | null {
  const valid = listings.filter(
    (l) => l.level >= targetLevel && !isNaN(parseFloat(String(l.buy_price))),
  )
  if (valid.length === 0) return null
  return Math.min(...valid.map((l) => parseFloat(String(l.buy_price))))
}

async function priceOneCard(
  card: CardInput,
  targetLevel: number,
  decRate: number,
): Promise<CardPrice> {
  const [buyListings, rentListings] = await Promise.all([
    fetchSaleListings(card.card_id),
    fetchRentListings(card.card_id),
  ])

  const buyResult = computeBuyDec(buyListings, targetLevel)
  const rentDec = computeRentDec(rentListings, targetLevel)

  return {
    card_id: card.card_id,
    buy_usd: buyResult !== null && decRate > 0 ? buyResult.dec * decRate : null,
    buy_bcx: buyResult?.bcx ?? null,
    buy_method: buyResult?.method ?? null,
    rent_day_usd: rentDec !== null && decRate > 0 ? rentDec * decRate : null,
  }
}

/**
 * Fetch live buy and rent prices for a list of cards at the given league.
 * Each card's target level is derived from LEAGUE_LEVEL_CAPS[league][card.rarity].
 * Runs up to 20 cards concurrently to avoid overwhelming the SL API.
 * Market calls are never cached; DEC rate revalidates every 60s.
 */
export async function fetchPrices(cards: CardInput[], league: string): Promise<PricingResult> {
  const decRate = await fetchDecRate()

  const CHUNK = 20
  const prices: CardPrice[] = []
  for (let i = 0; i < cards.length; i += CHUNK) {
    const chunk = cards.slice(i, i + CHUNK)
    const chunkPrices = await Promise.all(
      chunk.map((c) => {
        const targetLevel = LEAGUE_LEVEL_CAPS[league]?.[c.rarity] ?? 1
        return priceOneCard(c, targetLevel, decRate)
      }),
    )
    prices.push(...chunkPrices)
  }

  return {
    prices,
    dec_usd_rate: decRate,
    fetched_at: new Date().toISOString(),
  }
}
