import Nav from '@/components/Nav'

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <Nav />
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Page title */}
        <div style={{ height: 28, width: 160, background: '#21262d', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 14, width: 320, background: '#21262d', borderRadius: 4, marginBottom: '1.5rem', animation: 'pulse 1.5s ease-in-out infinite' }} />

        {/* Config panel skeleton */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ height: 10, width: 60, background: '#21262d', borderRadius: 3, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
            {[80, 100, 120, 90, 110, 95].map((w, i) => (
              <div key={i} style={{ height: 28, width: w, background: '#21262d', borderRadius: 6, animation: `pulse ${1.3 + i * 0.1}s ease-in-out infinite` }} />
            ))}
          </div>
          <div style={{ height: 10, width: 40, background: '#21262d', borderRadius: 3, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
            {[38, 38, 38, 38, 38].map((w, i) => (
              <div key={i} style={{ height: 32, width: w, background: '#21262d', borderRadius: 6, animation: `pulse ${1.3 + i * 0.1}s ease-in-out infinite` }} />
            ))}
          </div>
          <div style={{ height: 32, width: 220, background: '#21262d', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </main>
    </div>
  )
}
