'use client'

import { useState } from 'react'

type Props = {
  cardName: string
  cdnSlug: string
  rarity: number
  maxLevel: number
  size?: number
  isSoulbound?: boolean
  className?: string
}

const RARITY_COLOUR: Record<number, string> = {
  1: '#95a5a6',
  2: '#3498db',
  3: '#a855f7',
  4: '#ffd700',
}

const RARITY_HOVER_COLOUR: Record<number, string> = {
  1: '#b0bec5',
  2: '#4db6e8',
  3: '#c084fc',
  4: '#ffe033',
}

export default function CardThumb({
  cardName,
  cdnSlug,
  rarity,
  maxLevel,
  size = 62,
  isSoulbound = false,
  className,
}: Props) {
  const [errored, setErrored] = useState(false)
  const [hovered, setHovered] = useState(false)

  const src = `https://d36mxiodymuqjm.cloudfront.net/cards_by_level/${cdnSlug}/${encodeURIComponent(cardName)}_lv${maxLevel}.png`

  const borderColor = hovered
    ? (RARITY_HOVER_COLOUR[rarity] ?? '#b0bec5')
    : (RARITY_COLOUR[rarity] ?? '#95a5a6')

  return (
    <div
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 8,
        border: `2px solid ${borderColor}`,
        padding: 2,
        flexShrink: 0,
        background: '#21262d',
        boxSizing: 'border-box',
        transform: hovered ? 'scale(1.06)' : undefined,
        transition: 'transform 0.15s, border-color 0.15s',
      }}
    >
      {/* Inner wrapper clips the image to rounded corners */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 4,
          overflow: 'hidden',
          background: '#21262d',
        }}
      >
        {errored ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: '#21262d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 9, color: '#484f58', textAlign: 'center', padding: 2, lineHeight: 1.2 }}>
              {cardName}
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={cardName}
            width={size}
            height={size}
            loading="lazy"
            style={{ objectFit: 'cover', objectPosition: 'top center', display: 'block', width: '100%', height: '100%' }}
            onError={() => setErrored(true)}
          />
        )}
      </div>

      {isSoulbound && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 14,
            height: 14,
            background: 'rgba(0,0,0,0.7)',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* lock icon */}
          <svg width="9" height="10" viewBox="0 0 9 10" fill="none">
            <rect x="1" y="4" width="7" height="6" rx="1" fill="#c9d1d9" />
            <path d="M2.5 4V3a2 2 0 0 1 4 0v1" stroke="#c9d1d9" strokeWidth="1.2" fill="none" />
          </svg>
        </div>
      )}
    </div>
  )
}
