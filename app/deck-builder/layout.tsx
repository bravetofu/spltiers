import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Deck Builder — splintiers',
  description: 'Explore the real cost of building a competitive deck — filter by edition, tier, and league to see live market prices.',
}

export default function DeckBuilderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
