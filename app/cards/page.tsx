import type { Metadata } from 'next'
import { Suspense } from 'react'
import CatalogueTable from '@/components/catalogue/CatalogueTable'
import CatalogueShell from '@/components/catalogue/CatalogueShell'
import CatalogueTableSkeleton from '@/components/catalogue/CatalogueTableSkeleton'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import { getRatingIndex } from '@/lib/ratings/server'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Cards — Splinterlands Card Database',
  description:
    'Explore every Splinterlands unit, summoner, and land card. Filter by splinter, rarity, edition, format, level, and bloodline.',
}
export default async function CardsPage() {
  const [cards, scores] = await Promise.all([
    getCatalogue(),
    getRatingIndex('diamond', 'auto').catch(() => ({})),
  ])
  return (
    <CatalogueShell>
      <Suspense fallback={<CatalogueTableSkeleton />}>
        <CatalogueTable cards={cards} initialRatings={scores} />
      </Suspense>
    </CatalogueShell>
  )
}
