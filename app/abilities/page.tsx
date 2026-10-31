import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import AbilityTooltipProvider from '@/components/catalogue/AbilityTooltipProvider'
import AbilityDirectory from '@/components/ratings/AbilityDirectory'
import AbilityTableSkeleton from '@/components/ratings/AbilityTableSkeleton'
import { getAbilityRatings, getPublishedProfile } from '@/lib/ratings/server'
import type { AbilityRating } from '@/lib/ratings/types'
import '../cards/catalogue.css'
export const revalidate = 300
export const metadata: Metadata = {
  title: 'Ability Ratings — Splintiers',
  description:
    'Explore Splinterlands ability strength, curated weights and battle evidence across league caps and ranked formats.',
}
export default async function AbilitiesPage() {
  const [scores, profile] = await Promise.all([
    getAbilityRatings('diamond', 'modern'),
    getPublishedProfile(),
  ])
  const weights = Object.fromEntries(
    Object.entries(profile?.config.abilities ?? {}).map(([name, value]) => [
      name,
      {
        standard: value.standard,
        nonStandard: value.nonStandard,
        multiplier: value.multiplier,
        drawback: value.drawback,
      },
    ]),
  )
  return (
    <>
      <Nav />
      <main className="catalogue-page">
        <header className="catalogue-header">
          <p className="catalogue-eyebrow">The ability library · beta</p>
          <h1>Know what makes a card strong.</h1>
          <p>
            Published ability strength, the mechanic behind it, and the evidence
            supporting each rating. Scores are provisional and context matters.
          </p>
          <div className="catalogue-header-links">
            <Link href="/cards">Browse cards ↗</Link>
            <Link href="/ratings/methodology">How ratings work ↗</Link>
          </div>
        </header>
        <AbilityTooltipProvider>
          <Suspense fallback={<AbilityTableSkeleton />}>
            <AbilityDirectory
              initial={scores.items as AbilityRating[]}
              weights={weights}
            />
          </Suspense>
        </AbilityTooltipProvider>
        <p className="catalogue-credit">
          {scores.publication?.label ?? 'Rating setup pending'} · Stats and
          ability mechanics © Splinterlands. Battle scores describe observed
          association, with confidence limits.
        </p>
      </main>
    </>
  )
}
