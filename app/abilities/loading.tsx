import Nav from '@/components/Nav'
import AbilityTableSkeleton from '@/components/ratings/AbilityTableSkeleton'
import '../cards/catalogue.css'

export default function Loading() {
  return (
    <>
      <Nav />
      <main className="catalogue-page">
        <header className="catalogue-header">
          <p className="catalogue-eyebrow">The ability library · beta</p>
          <h1>Ability ratings</h1>
        </header>
        <AbilityTableSkeleton />
      </main>
    </>
  )
}
