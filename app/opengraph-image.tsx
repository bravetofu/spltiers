import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'splintiers — Splinterlands Tier Lists & Deck Builder'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0d1117',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          gap: 20,
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ color: '#f0f6fc', fontSize: 96, fontWeight: 700, letterSpacing: '-2px' }}>
            splin
          </span>
          <span style={{ color: '#e63946', fontSize: 96, fontWeight: 700, letterSpacing: '-2px' }}>
            tiers
          </span>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#ffd700',
              marginLeft: 6,
              marginTop: 8,
              flexShrink: 0,
            }}
          />
        </div>

        {/* Tier colour stripe */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            ['S', '#ffd700'],
            ['A', '#2ecc71'],
            ['B', '#3498db'],
            ['C', '#95a5a6'],
            ['D', '#555e6a'],
          ].map(([label, color]) => (
            <div
              key={label}
              style={{
                background: color,
                color: '#0d1117',
                width: 52,
                height: 52,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Subtitle */}
        <p style={{ color: '#8b949e', fontSize: 28, margin: 0 }}>
          Splinterlands Tier Lists &amp; Deck Builder
        </p>
      </div>
    ),
    { ...size },
  )
}
