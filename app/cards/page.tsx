import type { Metadata } from 'next'
import { Suspense } from 'react'
import CatalogueTable from '@/components/catalogue/CatalogueTable'
import CatalogueShell from '@/components/catalogue/CatalogueShell'
import CatalogueTableSkeleton from '@/components/catalogue/CatalogueTableSkeleton'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Cards — Splinterlands Card Database',
  description:
    'Explore every Splinterlands unit, summoner, and land card. Filter by splinter, rarity, edition, format, level, and bloodline.',
}
export default async function CardsPage() {
  const cards = await getCatalogue()
  return (
    <CatalogueShell>
      <Suspense fallback={<CatalogueTableSkeleton />}>
        <CatalogueTable cards={cards} />
      </Suspense>
    </CatalogueShell>
  )
}
