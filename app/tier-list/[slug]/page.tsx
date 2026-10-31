import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import TierListClient, { type TierEntry, type SetSummary } from '@/components/TierListClient'
import { getCardSet, getCardSets, getTierEntries } from '@/lib/db'
import { getEditionFormat } from '@/lib/editions'

export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const data = await getCardSet(params.slug)
    if (data?.name) {
      return {
        title: `${data.name} Tier List — splintiers`,
        description: `S/A/B/C/D card rankings for ${data.name}. Updated by the community.`,
      }
    }
  } catch {
    // Fall through to default
  }
  return { title: 'Tier List — splintiers' }
}

interface Props {
  params: { slug: string }
}

// Pre-generate static paths for all active editions at build time.
// Returns [] gracefully when DATABASE_URL is absent.
export async function generateStaticParams() {
  try {
    return (await getCardSets()).map((row) => ({ slug: row.slug }))
  } catch {
    return []
  }
}

export default async function TierListPage({ params }: Props) {
  let cardSet: { id: string; name: string; slug: string } | null = null
  let allSets: { name: string; slug: string }[] = []
  let tierEntries: TierEntry[] = []

  try {
    ;[cardSet, allSets] = await Promise.all([getCardSet(params.slug), getCardSets()])
    if (cardSet) tierEntries = await getTierEntries(cardSet.id)
  } catch {
    // Database unavailable — notFound() will be called below if cardSet is null
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
