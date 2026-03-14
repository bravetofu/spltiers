'use client'

import Link from 'next/link'
import type { EditionFormat } from '@/lib/editions'

export type EditionCardData = {
  id: string
  slug: string
  name: string
  format: EditionFormat
  totalCards: number | null
  rankedCount: number
}

export default function EditionCard({
  set,
  format,
}: {
  set: EditionCardData
  format: EditionFormat
}) {
  const badgeStyle: React.CSSProperties =
    format === 'modern'
      ? { background: '#1a2a3d', color: '#58a6ff' }
      : format === 'wild'
      ? { background: '#2d1a35', color: '#d966ff' }
      : { background: '#21262d', color: '#8b949e' }

  return (
    <Link href={`/tier-list/${set.slug}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 10,
          padding: '1rem 1.1rem',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          height: '100%',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = '#484f58'
          ;(e.currentTarget as HTMLDivElement).style.background = '#1c2128'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)'
          ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)'
        }}
      >
        {/* Name + arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              lineHeight: 1.3,
            }}
          >
            {set.name}
          </span>
          <span style={{ color: 'var(--text-faint)', fontSize: '0.9rem', flexShrink: 0 }}>→</span>
        </div>

        {/* Format badge */}
        <span
          style={{
            ...badgeStyle,
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            width: 'fit-content',
          }}
        >
          {format === 'other' ? 'other' : format}
        </span>

        {/* Counts */}
        <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
          <div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
              {set.totalCards ?? '—'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: 3 }}>
              cards
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
              {set.rankedCount > 0 ? set.rankedCount : '—'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: 3 }}>
              ranked
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
