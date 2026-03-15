'use server'

import { LEAGUE_LEVEL_CAPS } from '@/lib/editions'

// BCX thresholds per rarity and level for Alpha/Beta editions
// (editions 0, 1, and reward/promo cards with card_detail_id <= 223)
// Update if Splinterlands changes these values
// Rarity: 1=Common, 2=Rare, 3=Epic, 4=Legendary
const ALPHA_BETA_BCX: Record<number, number[]> = {
  1: [1, 3, 5, 12, 25, 52, 105, 172, 305, 505],   // Common (levels 1-10)
  2: [1, 3, 5, 11, 21, 35, 61, 115],               // Rare (levels 1-8)
  3: [1, 3, 6, 11, 23, 46],                        // Epic (levels 1-6)
  4: [1, 3, 5, 11],                                // Legendary (levels 1-4)
}

// BCX thresholds per rarity and level for Untamed and all subsequent editions
// (Untamed, Dice, Chaos Legion, Riftwatchers, Rebellion, Conclave Arcana, Escalation)
// Named STANDARD_BCX to distinguish from Alpha/Beta thresholds and from Modern league format
// Update if Splinterlands changes these values
const STANDARD_BCX: Record<number, number[]> = {
  1: [1, 5, 14, 30, 60, 100, 150, 220, 300, 400],  // Common (levels 1-10)
  2: [1, 5, 14, 25, 40, 60, 85, 115],              // Rare (levels 1-8)
  3: [1, 4, 10, 20, 32, 46],                       // Epic (levels 1-6)
  4: [1, 3, 6, 11],                                // Legendary (levels 1-4)
}

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
  buy_price: string | number  // USD
  bcx: number
}

type SLRentListing = {
  level: number
  buy_price: string | number  // DEC per day
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

/** Look up how many BCX are required to reach targetLevel for this card. */
function getTargetBcx(card: CardInput, targetLevel: number): number {
  const table = card.edition === 'Alpha/Beta' ? ALPHA_BETA_BCX : STANDARD_BCX
  return table[card.rarity]?.[targetLevel - 1] ?? 1
}

/**
 * Compute the cheapest USD buy price for a card at targetLevel.
 *
 * buy_price in sale listings is USD.
 *
 * Option A — pre-combined: filter listings where listing.level >= targetLevel,
 * take the cheapest buy_price. No combining needed.
 *
 * Option B — buy & combine: sort all listings by price-per-BCX ascending,
 * then greedily accumulate listings until total BCX >= targetBcx, summing
 * their buy_price. This gives the cheapest way to acquire enough single cards
 * to combine up to targetLevel.
 *
 * Returns min(A, B), or null if neither is available.
 */
function computeBuyUsd(
  listings: SLSaleListing[],
  targetLevel: number,
  targetBcx: number,
): { usd: number; bcx: number; method: BuyMethod } | null {
  const valid = listings.filter(
    (l) => l.level > 0 && l.bcx > 0 && !isNaN(parseFloat(String(l.buy_price))),
  )
  if (valid.length === 0) return null

  // Option A: cheapest pre-combined listing at or above target level
  const atOrAbove = valid.filter((l) => l.level >= targetLevel)
  let bestA: number | null = null
  if (atOrAbove.length > 0) {
    bestA = Math.min(...atOrAbove.map((l) => parseFloat(String(l.buy_price))))
  }

  // Option B: greedily accumulate cheapest-per-BCX listings
  const sorted = valid
    .slice()
    .sort(
      (a, b) =>
        parseFloat(String(a.buy_price)) / a.bcx -
        parseFloat(String(b.buy_price)) / b.bcx,
    )
  let totalUsd = 0
  let totalBcx = 0
  for (const listing of sorted) {
    if (totalBcx >= targetBcx) break
    totalUsd += parseFloat(String(listing.buy_price))
    totalBcx += listing.bcx
  }
  const bestB = totalBcx >= targetBcx ? totalUsd : null

  if (bestA === null && bestB === null) return null
  if (bestA === null) return { usd: bestB!, bcx: targetBcx, method: 'buy & combine' }
  if (bestB === null) return { usd: bestA, bcx: targetBcx, method: 'pre-combined' }
  return bestA <= bestB
    ? { usd: bestA, bcx: targetBcx, method: 'pre-combined' }
    : { usd: bestB, bcx: targetBcx, method: 'buy & combine' }
}

/**
 * Cheapest daily rent rate in USD for listings at or above targetLevel.
 * Rental buy_price is in DEC per day; multiply by decRate to convert.
 */
function computeRentUsd(listings: SLRentListing[], targetLevel: number, decRate: number): number | null {
  const valid = listings.filter(
    (l) => l.level >= targetLevel && !isNaN(parseFloat(String(l.buy_price))),
  )
  if (valid.length === 0 || decRate === 0) return null
  const cheapestDec = Math.min(...valid.map((l) => parseFloat(String(l.buy_price))))
  return cheapestDec * decRate
}

async function priceOneCard(
  card: CardInput,
  targetLevel: number,
  decRate: number,
): Promise<CardPrice> {
  const targetBcx = getTargetBcx(card, targetLevel)
  const [buyListings, rentListings] = await Promise.all([
    fetchSaleListings(card.card_id),
    fetchRentListings(card.card_id),
  ])

  const buyResult = computeBuyUsd(buyListings, targetLevel, targetBcx)
  const rentUsd = computeRentUsd(rentListings, targetLevel, decRate)

  return {
    card_id: card.card_id,
    buy_usd: buyResult?.usd ?? null,
    buy_bcx: buyResult?.bcx ?? null,
    buy_method: buyResult?.method ?? null,
    rent_day_usd: rentUsd,
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
