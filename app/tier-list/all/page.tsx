import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import TierListClient, { type TierEntry, type SetSummary } from '@/components/TierListClient'
import { createPublicClient } from '@/lib/supabase/server'
import { getEditionFormat } from '@/lib/editions'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'All Tier List — splintiers',
  description: 'S/A/B/C/D card rankings across all editions. Updated by the community.',
}

export default async function AllTierListPage() {
  let allSets: { id: string; name: string; slug: string }[] = []
  let tierEntries: TierEntry[] = []

  try {
    const supabase = createPublicClient()

    const { data: sets } = await supabase
      .from('card_sets')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    allSets = sets ?? []

    if (allSets.length > 0) {
      const setIds = allSets.map((s) => s.id)
      const { data: entries } = await supabase
        .from('tier_entries')
        .select('card_id, card_name, cdn_slug, rarity, tier, role, notes, is_soulbound')
        .in('set_id', setIds)

      tierEntries = (entries ?? []) as TierEntry[]
    }
  } catch {
    // Supabase unavailable — render empty groups
  }

  const tierGroups: Record<string, TierEntry[]> = { S: [], A: [], B: [], C: [], D: [] }
  for (const entry of tierEntries) {
    const t = entry.tier
    if (tierGroups[t]) tierGroups[t].push(entry)
  }

  const setList: SetSummary[] = [
    { slug: 'all', name: 'All', format: 'other' },
    ...allSets.map((s) => ({
      slug: s.slug,
      name: s.name,
      format: getEditionFormat(s.name),
    })),
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Nav />
      <TierListClient
        currentSet={{ name: 'All', slug: 'all' }}
        tierGroups={tierGroups}
        allSets={setList}
      />
    </div>
  )
}
