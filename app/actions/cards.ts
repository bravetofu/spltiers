'use server'

export type CardData = {
  card_id: number
  card_name: string
  edition: string       // display name e.g. "Chaos Legion"
  cdn_slug: string      // e.g. "chaos" (without slashes, added at render)
  rarity: number        // 1–4
  max_level: number
  is_soulbound: boolean
}

// Raw shape from https://api.splinterlands.io/cards/get_details
type RawCard = {
  id: number
  name: string
  editions: string      // e.g. "7" or "0,1"
  tier: number | null
  rarity: number
}

function rarityMaxLevel(rarity: number): number {
  switch (rarity) {
    case 1: return 10
    case 2: return 8
    case 3: return 6
    case 4: return 4
    default: return 1
  }
}

/**
 * Returns { displayName, cdnSlug } for a card given its editions string and tier value.
 * Uses the full mapping table from CLAUDE.md — editions + tier combo.
 */
function resolveEditionAndSlug(
  editionsRaw: string,
  tierValue: number | null,
): { displayName: string; cdnSlug: string } | null {
  // editions field can be a single number or comma-separated e.g. "0,1"
  const editionNums = editionsRaw.split(',').map((e) => parseInt(e.trim(), 10))
  // Normalise to number — the API sometimes returns tier as a string (e.g. "14")
  const t = Number(tierValue ?? 0)

  // Alpha/Beta: editions 0, 1, or 0,1 (any tier)
  if (editionNums.every((e) => e === 0 || e === 1)) {
    return { displayName: 'Alpha/Beta', cdnSlug: 'beta' }
  }

  const e = editionNums[0]

  // Promo (editions=2) — branched by tier
  if (e === 2) {
    if (t === 0 || t === 1) return { displayName: 'Alpha/Beta', cdnSlug: 'promo' }
    if (t === 4)            return { displayName: 'Untamed',    cdnSlug: 'promo' }
    if (t === 7)            return { displayName: 'Chaos Legion', cdnSlug: 'promo' }
    if (t === 12)           return { displayName: 'Rebellion',  cdnSlug: 'promo' }
    if (t === 14)           return { displayName: 'Conclave Arcana', cdnSlug: 'promo' }
  }

  // Reward (editions=3) — branched by tier
  if (e === 3) {
    if (t === 0 || t === 1) return { displayName: 'Alpha/Beta',   cdnSlug: 'reward' }
    if (t === 4)            return { displayName: 'Untamed',       cdnSlug: 'reward' }
    if (t === 7)            return { displayName: 'Chaos Legion',  cdnSlug: 'reward' }
    if (t === 12)           return { displayName: 'Rebellion',     cdnSlug: 'reward' }
  }

  // Untamed
  if (e === 4) return { displayName: 'Untamed', cdnSlug: 'untamed' }

  // Dice
  if (e === 5) return { displayName: 'Dice', cdnSlug: 'dice' }

  // Chaos Legion
  if (e === 7)  return { displayName: 'Chaos Legion',  cdnSlug: 'chaos' }

  // CL Soulbound
  if (e === 10) return { displayName: 'Chaos Legion',  cdnSlug: 'soulbound' }

  // Riftwatchers
  if (e === 8)  return { displayName: 'Riftwatchers',  cdnSlug: 'rift' }

  // Rebellion
  if (e === 12) return { displayName: 'Rebellion',     cdnSlug: 'rebellion' }

  // Rebellion Soulbound
  if (e === 13) return { displayName: 'Rebellion',     cdnSlug: 'soulboundrb' }

  // Conclave Arcana: editions 14 (any tier)
  if (e === 14) return { displayName: 'Conclave Arcana', cdnSlug: 'conclave' }

  // Conclave Arcana: editions 17, branched by tier
  if (e === 17) {
    if (t === 15) return null  // excluded cards
    if (t === 14) return { displayName: 'Conclave Arcana', cdnSlug: 'extra' }
    return { displayName: 'Conclave Arcana', cdnSlug: 'conclave' }
  }

  // Conclave reward
  if (e === 18) return { displayName: 'Conclave Arcana', cdnSlug: 'reward' }

  // Escalation
  if (e === 20) return { displayName: 'Escalation', cdnSlug: 'escalation' }

  return null
}

const SOULBOUND_EDITIONS = new Set([10, 13])

async function fetchAllCards(): Promise<CardData[]> {
  const res = await fetch('https://api.splinterlands.io/cards/get_details', {
    next: { revalidate: 3600 },
    headers: { 'Accept-Encoding': 'gzip, deflate, br, zstd' },
  })
  if (!res.ok) throw new Error(`SL API error: ${res.status}`)
  const raw: RawCard[] = await res.json()

  const cards: CardData[] = []
  for (const card of raw) {
    const resolved = resolveEditionAndSlug(card.editions, card.tier)
    if (!resolved) continue
    if (card.id === 803) resolved.cdnSlug = 'conclave'
    if ([243, 96, 216, 119].includes(card.id)) resolved.cdnSlug = 'beta'
    const editionNums = card.editions.split(',').map((e) => parseInt(e.trim(), 10))
    const isSoulbound = editionNums.some((e) => SOULBOUND_EDITIONS.has(e))
    cards.push({
      card_id: card.id,
      card_name: card.name,
      edition: resolved.displayName,
      cdn_slug: resolved.cdnSlug,
      rarity: card.rarity,
      max_level: rarityMaxLevel(card.rarity),
      is_soulbound: isSoulbound,
    })
  }
  return cards
}

/**
 * Returns all cards for a given edition display name.
 */
export async function getCardsForEdition(editionName: string): Promise<CardData[]> {
  const all = await fetchAllCards()
  return all.filter((c) => c.edition === editionName)
}

/**
 * Returns all cards grouped by edition display name.
 * Useful for the admin home page to show card counts.
 */
export async function getAllCardsByEdition(): Promise<Map<string, CardData[]>> {
  const all = await fetchAllCards()
  const map = new Map<string, CardData[]>()
  for (const card of all) {
    const bucket = map.get(card.edition) ?? []
    bucket.push(card)
    map.set(card.edition, bucket)
  }
  return map
}
