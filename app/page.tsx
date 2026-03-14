import Nav from '@/components/Nav'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Nav />
      <main
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '4rem 1.5rem',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            color: 'var(--text-primary)',
            fontSize: '2.25rem',
            fontWeight: 700,
            marginBottom: '1rem',
          }}
        >
          Splinterlands tier lists
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '3rem' }}>
          Coming soon.
        </p>
      </main>
    </div>
  )
}
