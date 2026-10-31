import 'server-only'
import { neon, neonConfig } from '@neondatabase/serverless'

// Use the database endpoint itself so managed environments can allow one hostname.
neonConfig.fetchEndpoint = (host) => `https://${host}/sql`

export type CardSet = {
  id: string
  slug: string
  name: string
  icon_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type TierEntry = {
  id: string
  set_id: string
  card_id: number
  card_name: string
  edition: string
  cdn_slug: string
  rarity: number
  tier: string | null
  role: string | null
  notes: string | null
  is_soulbound: boolean
  updated_at: string
}

export type RankedEntry = TierEntry & { tier: string }
export type TierInput = Omit<TierEntry, 'id' | 'updated_at'>

function database(uncached = false) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  return neon(process.env.DATABASE_URL, {
    fetchOptions: uncached
      ? { cache: 'no-store' }
      : { next: { revalidate: 3600, tags: ['editions'] } },
  })
}

export async function getCardSets(activeOnly = true): Promise<CardSet[]> {
  return await database(!activeOnly)`
    SELECT id, slug, name, icon_url, is_active, sort_order, created_at::text FROM card_sets WHERE (${!activeOnly} OR is_active)
    ORDER BY sort_order, name
  ` as CardSet[]
}

export async function getCardSet(slug: string, activeOnly = true): Promise<CardSet | null> {
  const rows = await database(!activeOnly)`
    SELECT id, slug, name, icon_url, is_active, sort_order, created_at::text FROM card_sets WHERE slug = ${slug} AND (${!activeOnly} OR is_active)
  `
  return (rows[0] as CardSet | undefined) ?? null
}

export async function getTierActivity(uncached = true): Promise<{ set_id: string; updated_at: string }[]> {
  return await database(uncached)`SELECT set_id, updated_at::text FROM tier_entries` as { set_id: string; updated_at: string }[]
}

export async function getTierEntries(setId: string, uncached = false): Promise<RankedEntry[]> {
  return await database(uncached)`
    SELECT id, set_id, card_id, card_name, edition, cdn_slug, rarity, tier, role, notes, is_soulbound, updated_at::text FROM tier_entries WHERE set_id = ${setId} AND tier IS NOT NULL
    ORDER BY card_id
  ` as RankedEntry[]
}

export async function getAllPublicTierEntries(): Promise<RankedEntry[]> {
  return await database()`
    SELECT e.id, e.set_id, e.card_id, e.card_name, e.edition, e.cdn_slug, e.rarity, e.tier, e.role, e.notes, e.is_soulbound, e.updated_at::text FROM tier_entries e JOIN card_sets s ON s.id = e.set_id
    WHERE s.is_active AND e.tier IS NOT NULL ORDER BY s.sort_order, e.card_id
  ` as RankedEntry[]
}

export async function getDeckEntries() {
  // Match the existing deck builder: every ranked entry, including inactive sets.
  return await database(true)`
    SELECT card_id, card_name, edition, cdn_slug, rarity, tier, is_soulbound
    FROM tier_entries WHERE tier IS NOT NULL ORDER BY card_id
  `
}

export async function createCardSet(input: {
  name: string; slug: string; icon_url: string | null; sort_order: number
}): Promise<CardSet> {
  const rows = await database(true)`
    INSERT INTO card_sets (name, slug, icon_url, sort_order)
    VALUES (${input.name}, ${input.slug}, ${input.icon_url}, ${input.sort_order}) RETURNING id, slug, name, icon_url, is_active, sort_order, created_at::text
  `
  return rows[0] as CardSet
}

export async function setCardSetActive(id: string, active: boolean): Promise<CardSet | null> {
  const rows = await database(true)`
    UPDATE card_sets SET is_active = ${active} WHERE id = ${id} RETURNING id, slug, name, icon_url, is_active, sort_order, created_at::text
  `
  return (rows[0] as CardSet | undefined) ?? null
}

export async function saveTierEntries(setId: string, entries: TierInput[]): Promise<string | null> {
  const sql = database(true)
  // Serialize concurrent saves of the same edition and replace its full state atomically.
  const [sets] = await sql.transaction([
    sql`SELECT slug FROM card_sets WHERE id = ${setId} FOR UPDATE`,
    sql`DELETE FROM tier_entries WHERE set_id = ${setId}`,
    sql`
      INSERT INTO tier_entries (set_id, card_id, card_name, edition, cdn_slug, rarity, tier, role, notes, is_soulbound)
      SELECT ${setId}::uuid, card_id, card_name, edition, cdn_slug, rarity, tier, role, notes, is_soulbound
      FROM jsonb_to_recordset(${JSON.stringify(entries)}::jsonb) AS e(
        card_id int, card_name text, edition text, cdn_slug text, rarity int,
        tier text, role text, notes text, is_soulbound boolean
      )
    `,
  ], { fetchOptions: { cache: 'no-store' } })
  return sets[0]?.slug ?? null
}
