import Nav from '@/components/Nav'

export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <Nav />

      {/* Sub-nav placeholder */}
      <div
        style={{
          background: '#0d1117',
          borderBottom: '1px solid #30363d',
          height: 46,
          display: 'flex',
          alignItems: 'center',
          padding: '0 1.5rem',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ width: 80, height: 14, background: '#21262d', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 120, height: 26, background: '#21262d', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.5rem 3rem' }}>
        {/* Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ height: 28, width: 220, background: '#21262d', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 14, width: 100, background: '#21262d', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>

        {/* Rarity filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          {[70, 60, 55, 80].map((w, i) => (
            <div key={i} style={{ height: 28, width: w, background: '#21262d', borderRadius: 6, animation: `pulse ${1.3 + i * 0.1}s ease-in-out infinite` }} />
          ))}
        </div>

        {/* Tier row skeletons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[6, 8, 5, 4, 3].map((count, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <div style={{ width: 52, minHeight: 84, background: '#21262d', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ flex: 1, display: 'flex', gap: 6, padding: '0.6rem 0.75rem', flexWrap: 'wrap' }}>
                {Array.from({ length: count }).map((_, j) => (
                  <div
                    key={j}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 6,
                      background: '#21262d',
                      flexShrink: 0,
                      animation: `pulse ${1.4 + j * 0.05}s ease-in-out infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
