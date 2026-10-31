import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import CatalogueTable from '@/components/catalogue/CatalogueTable'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import './catalogue.css'

export const metadata: Metadata = {
  title: 'Cards — Splinterlands Card Database',
  description:
    'Explore every Splinterlands unit, summoner, and land card. Filter by splinter, rarity, edition, format, level, and bloodline.',
}
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const cards = await getCatalogue()
  return (
    <>
      <Nav />
      <main className="catalogue-page">
        <header className="catalogue-header">
          <p className="catalogue-eyebrow">The card library</p>
          <h1>Find your next play.</h1>
          <p>
            Every unit, summoner, and land card. Compare stats, explore
            bloodlines, and see what changes as cards level up.
          </p>
        </header>
        <CatalogueTable cards={cards} initial={searchParams} />
        <p className="catalogue-credit">
          Stats, editions, artwork, and current format eligibility from
          Splinterlands. Hover, focus, or tap an ability to learn more. Card
          artwork © Splinterlands.
        </p>
      </main>
    </>
  )
}
