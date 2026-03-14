import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import TierListClient, { type TierEntry, type SetSummary } from '@/components/TierListClient'
import { createPublicClient } from '@/lib/supabase/server'
import { getEditionFormat } from '@/lib/editions'

export const revalidate = 3600

interface Props {
  params: { slug: string }
}

// Pre-generate static paths for all active editions at build time.
// Returns [] gracefully when Supabase env vars are absent.
export async function generateStaticParams() {
  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('card_sets')
      .select('slug')
      .eq('is_active', true)
    return (data ?? []).map((row) => ({ slug: row.slug }))
  } catch {
    return []
  }
}

export default async function TierListPage({ params }: Props) {
  let cardSet: { id: string; name: string; slug: string } | null = null
  let allSets: { name: string; slug: string }[] = []
  let tierEntries: TierEntry[] = []

  try {
    const supabase = createPublicClient()

    // Fetch this card_set and all active sets in parallel
    const [setRes, allSetsRes] = await Promise.all([
      supabase
        .from('card_sets')
        .select('id, name, slug')
        .eq('slug', params.slug)
        .eq('is_active', true)
        .single(),
      supabase
        .from('card_sets')
        .select('name, slug')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ])

    cardSet = setRes.data ?? null
    allSets = allSetsRes.data ?? []

    if (cardSet) {
      const { data: entries } = await supabase
        .from('tier_entries')
        .select('card_id, card_name, cdn_slug, rarity, tier, role, notes, is_soulbound')
        .eq('set_id', cardSet.id)
      tierEntries = (entries ?? []) as TierEntry[]
    }
  } catch {
    // Supabase unavailable — notFound() will be called below if cardSet is null
  }

  if (!cardSet) notFound()

  // Group tier entries by tier
  const tierGroups: Record<string, TierEntry[]> = { S: [], A: [], B: [], C: [], D: [] }
  for (const entry of tierEntries) {
    const t = entry.tier
    if (tierGroups[t]) tierGroups[t].push(entry)
  }

  // Build set summaries for the dropdown
  const setList: SetSummary[] = allSets.map((s) => ({
    slug: s.slug,
    name: s.name,
    format: getEditionFormat(s.name),
  }))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Nav />
      <TierListClient
        currentSet={{ name: cardSet.name, slug: cardSet.slug }}
        tierGroups={tierGroups}
        allSets={setList}
      />
    </div>
  )
}
