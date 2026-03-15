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

// Multiplier above rarity-group median price_per_bcx to flag a card as a price outlier
// Increase this value to be more lenient, decrease to be more aggressive
const OUTLIER_THRESHOLD = 5

export type CardInput = {
  card_id: number
  card_name: string
  edition: string
  cdn_slug: string
  rarity: number
  tier: string
}

export type BuyMethod = 'pre-combined' | 'buy & combine'

// 'ok'         — listing exists at exactly targetLevel (or cheaper one at targetLevel chosen)
// 'above_only' — no listing at targetLevel, cheapest is at a higher level (overpaying)
// 'below_only' — no listing at or above targetLevel, showing best available below (underlevelled)
export type RentStatus = 'ok' | 'above_only' | 'below_only'

export type CardPrice = {
  card_id: number
  buy_usd: number | null          // null if no listings exist at all
  buy_bcx: number | null          // BCX actually accumulated (< buy_target_bcx if insufficient supply)
  buy_target_bcx: number | null   // BCX required to reach target level
  buy_method: BuyMethod | null
  insufficient_supply: boolean    // true if buy_bcx < buy_target_bcx
  is_outlier: boolean             // true if price_per_bcx > median * OUTLIER_THRESHOLD for rarity group
  rent_day_usd: number | null
  rent_status: RentStatus | null  // null if no listings at all
  rent_actual_level: number | null
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

// Shape of a single entry in the for_rent_grouped response.
// low_price is the cheapest DEC/day rate for that card+level+gold combination.
type SLGroupedRentListing = {
  card_detail_id: number
  level: number
  gold: boolean
  low_price: string | number    // DEC per day — confirmed field name from API
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

/**
 * Fetch all non-gold rental listings from the grouped endpoint once.
 * Cached for 60 seconds — one call serves all cards in a pricing run.
 */
async function fetchGroupedRentListings(): Promise<SLGroupedRentListing[]> {
  try {
    const res = await fetch(
      'https://api2.splinterlands.com/market/for_rent_grouped',
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    // Only non-gold cards; low_price is DEC/day
    return (data as SLGroupedRentListing[]).filter((l) => l.gold === false)
  } catch {
    return []
  }
}

/** Return grouped rent listings for a single card (already gold-filtered). */
function rentListingsForCard(
  grouped: SLGroupedRentListing[],
  cardId: number,
): SLGroupedRentListing[] {
  return grouped.filter((l) => l.card_detail_id === cardId)
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
 * take the cheapest buy_price.
 *
 * Option B — buy & combine: sort all listings by price-per-BCX ascending,
 * greedily accumulate until total BCX >= targetBcx, sum the buy_prices.
 *
 * Returns min(A, B). If only Option B partially fills (insufficient supply),
 * returns the partial accumulation with insufficient_supply=true.
 * Returns null only if there are zero valid listings.
 */
function computeBuyUsd(
  listings: SLSaleListing[],
  targetLevel: number,
  targetBcx: number,
): { usd: number; bcx: number; method: BuyMethod; insufficient_supply: boolean } | null {
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

  // Option B: adaptive greedy accumulation.
  // At each step, pick the listing that minimises price / min(bcx, needed).
  // This prevents cheap-per-BCX multi-BCX listings from being preferred when
  // they would overshoot — e.g. a 36-BCX card at $5.11 is $0.14/BCX but costs
  // $5.11/needed when you only need a few more BCX, far more than a $0.15 single.
  const pool = valid.map((l) => ({ usd: parseFloat(String(l.buy_price)), bcx: l.bcx }))
  let totalUsd = 0
  let totalBcx = 0

  while (totalBcx < targetBcx && pool.length > 0) {
    const needed = targetBcx - totalBcx
    let bestIdx = 0
    let bestEff = pool[0].usd / Math.min(pool[0].bcx, needed)
    for (let i = 1; i < pool.length; i++) {
      const eff = pool[i].usd / Math.min(pool[i].bcx, needed)
      if (eff < bestEff) { bestEff = eff; bestIdx = i }
    }
    const [chosen] = pool.splice(bestIdx, 1)
    totalUsd += chosen.usd
    totalBcx += chosen.bcx
  }
  const bSucceeded = totalBcx >= targetBcx

  // A unavailable AND B couldn't reach targetBcx: insufficient supply
  if (bestA === null && !bSucceeded) {
    return { usd: totalUsd, bcx: totalBcx, method: 'buy & combine', insufficient_supply: true }
  }

  const bestBCost = bSucceeded ? totalUsd : null
  if (bestA === null) return { usd: bestBCost!, bcx: targetBcx, method: 'buy & combine', insufficient_supply: false }
  if (bestBCost === null) return { usd: bestA, bcx: targetBcx, method: 'pre-combined', insufficient_supply: false }
  return bestA <= bestBCost
    ? { usd: bestA, bcx: targetBcx, method: 'pre-combined', insufficient_supply: false }
    : { usd: bestBCost, bcx: targetBcx, method: 'buy & combine', insufficient_supply: false }
}

/** Extract the DEC/day price from a grouped rental listing. */
function rentListingDec(l: SLGroupedRentListing): number {
  return parseFloat(String(l.low_price ?? ''))
}

/**
 * Determine the cheapest rent price and status for a card at targetLevel.
 *
 * Case 1 — 'ok':         listing at exactly targetLevel exists; cheapest of all >= target.
 * Case 2 — 'above_only': no listing at targetLevel, but listings exist above it;
 *                         cheapest of all > target (may be overpaying).
 * Case 3 — 'below_only': no listing at or above targetLevel; cheapest at the highest
 *                         available level below target (card is underlevelled).
 * Case 4 — null:         no listings at all.
 *
 * Daily DEC price is converted to USD via decRate.
 * Returns null usd (but keeps status) if decRate is unavailable.
 */
function computeRentResult(
  listings: SLGroupedRentListing[],
  targetLevel: number,
  decRate: number,
): { usd: number | null; status: RentStatus; actual_level: number } | null {
  const valid = listings.filter((l) => l.level > 0 && !isNaN(rentListingDec(l)) && rentListingDec(l) > 0)
  if (valid.length === 0) return null

  const toUsd = (dec: number) => decRate > 0 ? dec * decRate : null

  // Cases 1 & 2: any listing at or above target
  const atOrAbove = valid.filter((l) => l.level >= targetLevel)
  if (atOrAbove.length > 0) {
    const cheapest = atOrAbove.reduce((best, l) => rentListingDec(l) < rentListingDec(best) ? l : best)
    const hasExact = atOrAbove.some((l) => l.level === targetLevel)
    return {
      usd: toUsd(rentListingDec(cheapest)),
      status: hasExact ? 'ok' : 'above_only',
      actual_level: cheapest.level,
    }
  }

  // Case 3: only listings below target — use highest available level, cheapest at that level
  const maxLevel = Math.max(...valid.map((l) => l.level))
  const atMax = valid.filter((l) => l.level === maxLevel)
  const cheapest = atMax.reduce((best, l) => rentListingDec(l) < rentListingDec(best) ? l : best)
  return {
    usd: toUsd(rentListingDec(cheapest)),
    status: 'below_only',
    actual_level: maxLevel,
  }
}

async function priceOneCard(
  card: CardInput,
  targetLevel: number,
  decRate: number,
  groupedRentListings: SLGroupedRentListing[],
): Promise<CardPrice> {
  const targetBcx = getTargetBcx(card, targetLevel)
  const buyListings = await fetchSaleListings(card.card_id)
  const rentListings = rentListingsForCard(groupedRentListings, card.card_id)

  const buyResult = computeBuyUsd(buyListings, targetLevel, targetBcx)
  const rentResult = computeRentResult(rentListings, targetLevel, decRate)

  return {
    card_id: card.card_id,
    buy_usd: buyResult?.usd ?? null,
    buy_bcx: buyResult?.bcx ?? null,
    buy_target_bcx: targetBcx,
    buy_method: buyResult?.method ?? null,
    insufficient_supply: buyResult?.insufficient_supply ?? false,
    is_outlier: false, // computed by flagOutliers() after all prices are known
    rent_day_usd: rentResult?.usd ?? null,
    rent_status: rentResult?.status ?? null,
    rent_actual_level: rentResult?.actual_level ?? null,
  }
}

/**
 * Group cards by rarity, compute median price_per_bcx within each group,
 * and flag cards whose price_per_bcx exceeds OUTLIER_THRESHOLD × median.
 *
 * Only cards with a valid buy_usd, known buy_target_bcx, and no insufficient
 * supply are included in the median calculation — partial prices would skew it.
 *
 * Mutates the is_outlier field on the CardPrice objects in-place.
 */
function flagOutliers(prices: CardPrice[], cards: CardInput[]): void {
  const rarityMap = new Map(cards.map((c) => [c.card_id, c.rarity]))

  type Candidate = { price: CardPrice; ppb: number }
  const byRarity = new Map<number, Candidate[]>()

  for (const p of prices) {
    if (p.buy_usd === null || p.buy_target_bcx === null || p.buy_target_bcx === 0) continue
    if (p.insufficient_supply) continue // partial data would skew the median
    const rarity = rarityMap.get(p.card_id)
    if (rarity === undefined) continue
    const ppb = p.buy_usd / p.buy_target_bcx
    const arr = byRarity.get(rarity) ?? []
    arr.push({ price: p, ppb })
    byRarity.set(rarity, arr)
  }

  for (const group of Array.from(byRarity.values())) {
    if (group.length < 2) continue // need at least 2 data points for a meaningful median
    const sorted = group.map((g) => g.ppb).sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const medianPpb =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    for (const { price, ppb } of group) {
      if (ppb > medianPpb * OUTLIER_THRESHOLD) {
        price.is_outlier = true
      }
    }
  }
}

/**
 * Fetch live buy and rent prices for a list of cards at the given league.
 * Each card's target level is derived from LEAGUE_LEVEL_CAPS[league][card.rarity].
 * Runs up to 20 cards concurrently to avoid overwhelming the SL API.
 * Market calls are never cached; DEC rate revalidates every 60s.
 * Outlier detection runs on the full result set after all prices are fetched.
 */
export async function fetchPrices(cards: CardInput[], league: string): Promise<PricingResult> {
  // Fetch DEC rate and grouped rent listings concurrently — both are shared across all cards
  const [decRate, groupedRentListings] = await Promise.all([
    fetchDecRate(),
    fetchGroupedRentListings(),
  ])

  const CHUNK = 20
  const prices: CardPrice[] = []
  for (let i = 0; i < cards.length; i += CHUNK) {
    const chunk = cards.slice(i, i + CHUNK)
    const chunkPrices = await Promise.all(
      chunk.map((c) => {
        const targetLevel = LEAGUE_LEVEL_CAPS[league]?.[c.rarity] ?? 1
        return priceOneCard(c, targetLevel, decRate, groupedRentListings)
      }),
    )
    prices.push(...chunkPrices)
  }

  // Run outlier detection on the complete set — never re-run after filtering
  flagOutliers(prices, cards)

  return {
    prices,
    dec_usd_rate: decRate,
    fetched_at: new Date().toISOString(),
  }
}
