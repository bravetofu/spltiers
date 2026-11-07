import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import AbilityTooltipProvider from '@/components/catalogue/AbilityTooltipProvider'
import AbilityDirectory from '@/components/ratings/AbilityDirectory'
import AbilityTableSkeleton from '@/components/ratings/AbilityTableSkeleton'
import { getAbilitySummaries, getPublicRatingSettings } from '@/lib/ratings/server'
import '../cards/catalogue.css'
export const revalidate = 300
export const metadata: Metadata = {
  title: 'Ability Ratings — Splintiers',
  description:
    'Explore Splinterlands ability strength, curated weights and battle evidence across league caps and ranked formats.',
}
export default async function AbilitiesPage() {
  const [scores, profile] = await Promise.all([
    getAbilitySummaries('diamond', 'modern'),
    getPublicRatingSettings(),
  ])
  const weights = profile?.abilities ?? {}
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
              initial={scores.items}
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
