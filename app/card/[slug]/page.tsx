import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import CardDetail from '@/components/catalogue/CardDetail'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import '../../cards/catalogue.css'

export const revalidate = 3600
// Other cards render on demand and are cached; avoid generating 1,000+ pages on every build.
export async function generateStaticParams() {
  return [{ slug: 'malric-inferno' }]
}
type Props = { params: { slug: string } }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = (await getCatalogue()).find((card) => card.slug === params.slug)
  if (!card) return { title: 'Card not found' }
  return {
    title: `${card.name} — Stats, Abilities & Prices`,
    description: `Explore ${card.name}: every level, ${card.bloodline} bloodline, abilities, foil artwork, and current market prices.`,
    alternates: { canonical: `/card/${card.slug}` },
  }
}
export default async function CardPage({ params }: Props) {
  const card = (await getCatalogue()).find((card) => card.slug === params.slug)
  if (!card) notFound()
  return (
    <>
      <Nav />
      <main className="catalogue-page card-detail-page">
        <CardDetail key={card.id} card={card} />
      </main>
    </>
  )
}
