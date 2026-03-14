import Nav from '@/components/Nav'

interface Props {
  params: { slug: string }
}

export default function TierListPage({ params }: Props) {
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
            fontSize: '2rem',
            fontWeight: 700,
            marginBottom: '1rem',
          }}
        >
          Tier List: <span style={{ color: 'var(--accent-red)' }}>{params.slug}</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Coming soon.</p>
      </main>
    </div>
  )
}
