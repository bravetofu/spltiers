'use client'

import Link from 'next/link'

const TIER_COLORS: Record<string, string> = {
  S: '#ffd700',
  A: '#2ecc71',
  B: '#3498db',
  C: '#95a5a6',
  D: '#555e6a',
}

type LogoSize = 'nav' | 'lg'

const SIZE: Record<LogoSize, { eyebrow: number; wordmark: number; stripe: number; gap: number }> = {
  nav: { eyebrow: 8,  wordmark: 20, stripe: 3,  gap: 2 },
  lg:  { eyebrow: 10, wordmark: 28, stripe: 4,  gap: 3 },
}

export default function Logo({ size = 'nav' }: { size?: LogoSize }) {
  const s = SIZE[size]

  return (
    <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', flexDirection: 'column', gap: s.gap, lineHeight: 1 }}>
      {/* TIER LISTS eyebrow */}
      <span
        style={{
          display: 'block',
          color: '#ffd700',
          fontSize: s.eyebrow,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        Tier Lists
      </span>

      {/* Wordmark: splin (white) + tiers (red) */}
      <span style={{ display: 'block', lineHeight: 1 }}>
        <span
          style={{
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: s.wordmark,
            color: '#f0f6fc',
            letterSpacing: '-0.02em',
          }}
        >
          splin
        </span>
        <span
          style={{
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: s.wordmark,
            color: '#e63946',
            letterSpacing: '-0.02em',
          }}
        >
          tiers
        </span>
      </span>

      {/* S/A/B/C/D tier stripe */}
      <span style={{ display: 'flex', gap: s.gap }}>
        {['S', 'A', 'B', 'C', 'D'].map((t) => (
          <span
            key={t}
            style={{
              display: 'inline-block',
              height: s.stripe,
              width: s.wordmark * 0.44,
              borderRadius: s.stripe,
              background: TIER_COLORS[t],
            }}
          />
        ))}
      </span>
    </Link>
  )
}
