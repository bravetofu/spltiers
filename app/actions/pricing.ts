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

// BCX thresholds for Alpha/Beta GOLD FOIL cards (foil === 1, editions 0 or 1)
// Note: gold foil cards start at a higher base level — levels showing 0 BCX
// mean that level is achievable with a single 1-BCX gold foil card
const ALPHA_BETA_GOLD_BCX: Record<number, number[]> = {
  1: [0, 0, 0, 1, 2, 4, 8, 13, 23, 38],  // Common (levels 1-10)
  2: [0, 0, 1, 2, 4, 7, 12, 22],          // Rare (levels 1-8)
  3: [0, 0, 1, 3, 5, 10],                 // Epic (levels 1-6)
  4: [0, 1, 2, 4],                        // Legendary (levels 1-4)
}

// BCX thresholds for Standard (Untamed+) GOLD FOIL cards (foil === 1, editions 4+)
// Note: same as above — levels showing 0 BCX are achievable with 1 BCX
const STANDARD_GOLD_BCX: Record<number, number[]> = {
  1: [0, 0, 1, 2, 5, 9, 14, 20, 27, 38],  // Common (levels 1-10)
  2: [0, 1, 2, 4, 7, 11, 16, 22],          // Rare (levels 1-8)
  3: [0, 1, 2, 4, 7, 10],                  // Epic (levels 1-6)
  4: [0, 1, 2, 4],                         // Legendary (levels 1-4)
}

// A card is flagged as an outlier if its price_per_bcx exceeds the 75th percentile
// price_per_bcx for its rarity group by more than this multiplier.
// Byzantine Kitty (~8x 75th percentile) should NOT be flagged.
// Sira (~38x 75th percentile) SHOULD be flagged.
// Increase to be more lenient, decrease to flag more aggressively.
const OUTLIER_THRESHOLD = 10

export type CardInput = {
  card_id: number
  card_name: string
  edition: string
  cdn_slug: string
  rarity: number
  tier: string
}

export type BuyMethod = 'pre-combined' | 'buy & combine'

// Which foil type provided the cheapest buy price for a card
export type FoilType = 'regular' | 'gold' | 'arcane' | 'black'

export type CardPrice = {
  card_id: number
  buy_usd: number | null          // null if no listings exist at all
  buy_bcx: number | null          // BCX actually accumulated (< buy_target_bcx if insufficient supply)
  buy_target_bcx: number | null   // BCX required to reach target level
  buy_method: BuyMethod | null
  insufficient_supply: boolean    // true if buy_bcx < buy_target_bcx
  is_outlier: boolean             // true if price_per_bcx > p75 * OUTLIER_THRESHOLD for rarity group
  foil_type: FoilType | null      // which foil type gave the cheapest price; null if no listings
}

export type PricingResult = {
  prices: CardPrice[]
  fetched_at: string
}

type SLSaleListing = {
  level: number
  buy_price: string | number  // USD
  bcx: number
  foil?: number               // 0=regular, 1=gold, 2=arcane, 3/4=black foil; undefined treated as 0
}

/** Look up how many BCX are required to reach targetLevel for this card (regular foil). */
function getTargetBcx(card: CardInput, targetLevel: number): number {
  const table = card.edition === 'Alpha/Beta' ? ALPHA_BETA_BCX : STANDARD_BCX
  return table[card.rarity]?.[targetLevel - 1] ?? 1
}

/**
 * Look up how many BCX are required to reach targetLevel for gold foil.
 * Returns 0 if a single 1-BCX gold foil card already reaches that level.
 */
function getTargetBcxGold(card: CardInput, targetLevel: number): number {
  const table = card.edition === 'Alpha/Beta' ? ALPHA_BETA_GOLD_BCX : STANDARD_GOLD_BCX
  return table[card.rarity]?.[targetLevel - 1] ?? 0
}

// Market API calls are never cached — prices must always be live
async function fetchSaleListings(cardId: number, gold: boolean): Promise<SLSaleListing[]> {
  try {
    const res = await fetch(
      `https://api2.splinterlands.com/market/for_sale_by_card?card_detail_id=${cardId}&gold=${gold}`,
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

/**
 * Find the cheapest pre-combined listing at or above targetLevel.
 * Used for arcane gold foil (foil === 2) and black foil (foil === 3/4), which are
 * already at max level and do not support BCX combining.
 */
function computePreCombinedOnly(listings: SLSaleListing[], targetLevel: number): number | null {
  const valid = listings.filter(
    (l) => l.level >= targetLevel && !isNaN(parseFloat(String(l.buy_price))),
  )
  if (valid.length === 0) return null
  return Math.min(...valid.map((l) => parseFloat(String(l.buy_price))))
}

async function priceOneCard(card: CardInput, targetLevel: number): Promise<CardPrice> {
  const [regularRaw, goldRaw] = await Promise.all([
    fetchSaleListings(card.card_id, false),
    fetchSaleListings(card.card_id, true),
  ])

  // Split by foil field value.
  // Use Number() to coerce in case the API returns foil as a string ("3", "4", etc.)
  const regularListings = regularRaw.filter((l) => Number(l.foil ?? 0) === 0)
  const goldListings    = goldRaw.filter((l) => Number(l.foil ?? 0) === 1)
  const arcaneListings  = goldRaw.filter((l) => Number(l.foil ?? 0) === 2)
  const blackListings   = regularRaw.filter((l) => { const f = Number(l.foil ?? 0); return f === 3 || f === 4 })

  // Diagnostic log for card 720 — remove once black foil is confirmed working
  if (card.card_id === 720) {
    console.log(`[card 720] &gold=false raw listings: ${regularRaw.length}`)
    console.log(`[card 720] black foil listings found (foil 3/4): ${blackListings.length}`)
    if (blackListings.length > 0) {
      blackListings.forEach((l, i) =>
        console.log(`  [${i}] foil=${l.foil} level=${l.level} buy_price=${l.buy_price}`),
      )
    } else {
      // Show foil value distribution so we can see what the API is actually returning
      const dist: Record<string, number> = {}
      for (const l of regularRaw) {
        const key = String(l.foil ?? 'undefined')
        dist[key] = (dist[key] ?? 0) + 1
      }
      console.log(`[card 720] foil distribution in &gold=false response:`, dist)
    }
  }

  // Regular foil (foil === 0): full Option A / B BCX logic
  const regularTargetBcx = getTargetBcx(card, targetLevel)
  const regularResult = computeBuyUsd(regularListings, targetLevel, regularTargetBcx)

  // Gold foil (foil === 1): full Option A / B BCX logic with gold BCX table
  const goldTargetBcx = getTargetBcxGold(card, targetLevel)
  let goldResult: { usd: number; bcx: number; method: BuyMethod; insufficient_supply: boolean } | null = null
  if (goldListings.length > 0) {
    if (goldTargetBcx === 0) {
      // A single 1-BCX gold foil card already reaches this level — find cheapest listing
      const prices = goldListings
        .map((l) => parseFloat(String(l.buy_price)))
        .filter((p) => !isNaN(p))
      if (prices.length > 0) {
        goldResult = { usd: Math.min(...prices), bcx: 1, method: 'pre-combined', insufficient_supply: false }
      }
    } else {
      goldResult = computeBuyUsd(goldListings, targetLevel, goldTargetBcx)
    }
  }

  // Arcane gold foil (foil === 2): pre-combined only — already at max level
  const arcaneUsd = computePreCombinedOnly(arcaneListings, targetLevel)

  // Black foil (foil === 3 or 4): pre-combined only — already at max level
  const blackUsd = computePreCombinedOnly(blackListings, targetLevel)

  // Collect all complete (non-insufficient-supply) options and pick the cheapest
  type CompleteOption = {
    usd: number
    foil: FoilType
    bcx: number | null
    target_bcx: number | null
    method: BuyMethod | null
  }
  const complete: CompleteOption[] = []

  if (regularResult && !regularResult.insufficient_supply) {
    complete.push({
      usd: regularResult.usd,
      foil: 'regular',
      bcx: regularResult.bcx,
      target_bcx: regularTargetBcx,
      method: regularResult.method,
    })
  }
  if (goldResult && !goldResult.insufficient_supply) {
    // When goldTargetBcx === 0, a single card reaches the level — no BCX count to show
    const showBcx = goldTargetBcx > 0
    complete.push({
      usd: goldResult.usd,
      foil: 'gold',
      bcx: showBcx ? goldResult.bcx : null,
      target_bcx: showBcx ? goldTargetBcx : null,
      method: showBcx ? goldResult.method : null,
    })
  }
  if (arcaneUsd !== null) {
    complete.push({ usd: arcaneUsd, foil: 'arcane', bcx: null, target_bcx: null, method: null })
  }
  if (blackUsd !== null) {
    complete.push({ usd: blackUsd, foil: 'black', bcx: null, target_bcx: null, method: null })
  }

  if (complete.length > 0) {
    const best = complete.reduce((a, b) => a.usd <= b.usd ? a : b)
    return {
      card_id: card.card_id,
      buy_usd: best.usd,
      buy_bcx: best.bcx,
      buy_target_bcx: best.target_bcx,
      buy_method: best.method,
      insufficient_supply: false,
      is_outlier: false, // computed by flagOutliers() after all prices are known
      foil_type: best.foil,
    }
  }

  // No complete options — fall back to regular foil insufficient supply result
  if (regularResult) {
    return {
      card_id: card.card_id,
      buy_usd: regularResult.usd,
      buy_bcx: regularResult.bcx,
      buy_target_bcx: regularTargetBcx,
      buy_method: regularResult.method,
      insufficient_supply: regularResult.insufficient_supply,
      is_outlier: false,
      foil_type: 'regular',
    }
  }

  // No listings at all
  return {
    card_id: card.card_id,
    buy_usd: null,
    buy_bcx: null,
    buy_target_bcx: regularTargetBcx,
    buy_method: null,
    insufficient_supply: false,
    is_outlier: false,
    foil_type: null,
  }
}

/**
 * Group cards by rarity, compute the 75th-percentile price_per_bcx within each
 * group, and flag cards whose price_per_bcx exceeds OUTLIER_THRESHOLD × p75.
 *
 * Using the 75th percentile (rather than the median) as the baseline ensures
 * the reference point reflects the upper range of normal pricing, so legitimately
 * expensive cards (e.g. Byzantine Kitty) are not caught by cheap cards dragging
 * the baseline down.
 *
 * Only cards with a valid buy_usd, known buy_target_bcx, and no insufficient
 * supply are included in the calculation — partial prices would skew it.
 *
 * Mutates the is_outlier field on the CardPrice objects in-place.
 */
function flagOutliers(prices: CardPrice[], cards: CardInput[]): void {
  const rarityMap = new Map(cards.map((c) => [c.card_id, c.rarity]))

  type Candidate = { price: CardPrice; ppb: number }
  const byRarity = new Map<number, Candidate[]>()

  for (const p of prices) {
    if (p.buy_usd === null || p.buy_target_bcx === null || p.buy_target_bcx === 0) continue
    if (p.insufficient_supply) continue // partial data would skew the baseline
    const rarity = rarityMap.get(p.card_id)
    if (rarity === undefined) continue
    const ppb = p.buy_usd / p.buy_target_bcx
    const arr = byRarity.get(rarity) ?? []
    arr.push({ price: p, ppb })
    byRarity.set(rarity, arr)
  }

  for (const group of Array.from(byRarity.values())) {
    if (group.length < 2) continue // need at least 2 data points for a meaningful baseline
    const sorted = group.map((g) => g.ppb).sort((a, b) => a - b)
    // 75th percentile: interpolate between the two surrounding values
    const pos = 0.75 * (sorted.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.ceil(pos)
    const p75 = lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
    for (const { price, ppb } of group) {
      if (ppb > p75 * OUTLIER_THRESHOLD) {
        price.is_outlier = true
      }
    }
  }
}

/**
 * Fetch live buy prices for a list of cards at the given league.
 * Each card's target level is derived from LEAGUE_LEVEL_CAPS[league][card.rarity].
 * Runs up to 20 cards concurrently to avoid overwhelming the SL API.
 * Market calls are never cached.
 * Outlier detection runs on the full result set after all prices are fetched.
 */
export async function fetchPrices(cards: CardInput[], league: string): Promise<PricingResult> {
  const CHUNK = 20
  const prices: CardPrice[] = []
  for (let i = 0; i < cards.length; i += CHUNK) {
    const chunk = cards.slice(i, i + CHUNK)
    const chunkPrices = await Promise.all(
      chunk.map((c) => {
        const targetLevel = LEAGUE_LEVEL_CAPS[league]?.[c.rarity] ?? 1
        return priceOneCard(c, targetLevel)
      }),
    )
    prices.push(...chunkPrices)
  }

  // Run outlier detection on the complete set — never re-run after filtering
  flagOutliers(prices, cards)

  return {
    prices,
    fetched_at: new Date().toISOString(),
  }
}
