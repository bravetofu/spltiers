'use server'

import { rarityMaxLevel } from '@/lib/editions'

export type CardInput = {
  card_id: number
  card_name: string
  edition: string
  cdn_slug: string
  rarity: number
  tier: string
}

export type CardPrice = {
  card_id: number
  buy_usd: number | null
  rent_day_usd: number | null
}

export type PricingResult = {
  prices: CardPrice[]
  dec_usd_rate: number
  fetched_at: string
}

// Raw listing shape from the SL market API
type SLListing = {
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

async function fetchListings(cardId: number, type: 'sale' | 'rent'): Promise<SLListing[]> {
  const url =
    type === 'sale'
      ? `https://api2.splinterlands.com/market/for_sale_by_card?card_detail_id=${cardId}&gold=false`
      : `https://api2.splinterlands.com/market/for_rent_by_card?card_detail_id=${cardId}`
  try {
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function cheapestAtLevel(listings: SLListing[], level: number): number | null {
  const atLevel = listings.filter(
    (l) => l.level === level && !isNaN(parseFloat(String(l.buy_price))),
  )
  if (atLevel.length === 0) return null
  return Math.min(...atLevel.map((l) => parseFloat(String(l.buy_price))))
}

async function priceOneCard(
  card: CardInput,
  level: number,
  decRate: number,
): Promise<CardPrice> {
  const effectiveLevel = Math.min(level, rarityMaxLevel(card.rarity))
  const [buyListings, rentListings] = await Promise.all([
    fetchListings(card.card_id, 'sale'),
    fetchListings(card.card_id, 'rent'),
  ])
  const buyDec = cheapestAtLevel(buyListings, effectiveLevel)
  const rentDec = cheapestAtLevel(rentListings, effectiveLevel)
  return {
    card_id: card.card_id,
    buy_usd: buyDec !== null && decRate > 0 ? buyDec * decRate : null,
    rent_day_usd: rentDec !== null && decRate > 0 ? rentDec * decRate : null,
  }
}

/**
 * Fetch live buy and rent prices for a list of cards at a given level.
 * Runs up to 20 cards concurrently to avoid overwhelming the SL API.
 * Revalidate: 60s (via Next.js fetch cache on upstream calls).
 */
export async function fetchPrices(cards: CardInput[], level: number): Promise<PricingResult> {
  const decRate = await fetchDecRate()

  const CHUNK = 20
  const prices: CardPrice[] = []
  for (let i = 0; i < cards.length; i += CHUNK) {
    const chunk = cards.slice(i, i + CHUNK)
    const chunkPrices = await Promise.all(chunk.map((c) => priceOneCard(c, level, decRate)))
    prices.push(...chunkPrices)
  }

  return {
    prices,
    dec_usd_rate: decRate,
    fetched_at: new Date().toISOString(),
  }
}
