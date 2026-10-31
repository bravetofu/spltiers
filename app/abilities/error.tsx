'use client'
import Nav from '@/components/Nav'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <>
      <Nav />
      <main
        style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem' }}
      >
        <h1>Ability ratings are unavailable</h1>
        <p>Please try again in a moment.</p>
        <button onClick={reset}>Try again</button>
      </main>
    </>
  )
}
