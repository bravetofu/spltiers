import Nav from '@/components/Nav'
import AbilityTooltipProvider from './AbilityTooltipProvider'

export default function CatalogueShell({
  children,
}: {
  children: React.ReactNode
}) {
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
        <AbilityTooltipProvider>{children}</AbilityTooltipProvider>
        <p className="catalogue-credit">
          Stats, editions, artwork, and current format eligibility from
          Splinterlands. Hover, focus, or tap an ability to learn more. Card
          artwork © Splinterlands.
        </p>
      </main>
    </>
  )
}
