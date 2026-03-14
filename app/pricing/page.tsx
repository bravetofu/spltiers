import Nav from '@/components/Nav'

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Nav />
      <main
        style={{
          maxWidth: '1000px',
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
          Pricing Calculator
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Coming soon.</p>
      </main>
    </div>
  )
}
