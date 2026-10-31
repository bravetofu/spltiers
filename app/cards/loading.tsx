import Nav from '@/components/Nav'
export default function Loading() {
  return (
    <>
      <Nav />
      <main
        style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem 1.5rem' }}
      >
        <h1>Loading card library…</h1>
        <p>Fetching the latest Splinterlands card data.</p>
      </main>
    </>
  )
}
