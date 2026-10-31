'use client'
import Nav from '@/components/Nav'
export default function Error({ reset }: { reset: () => void }) {
  return (
    <>
      <Nav />
      <main
        style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem' }}
      >
        <h1>The card library is unavailable</h1>
        <p>Splinterlands could not be reached. Please try again.</p>
        <button onClick={reset}>Try again</button>
      </main>
    </>
  )
}
