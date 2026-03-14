'use client'

import { useState } from 'react'

type Props = {
  cardName: string
  cdnSlug: string
  rarity: number
  maxLevel: number
  size?: number
  isSoulbound?: boolean
}

export default function CardThumb({
  cardName,
  cdnSlug,
  rarity,
  maxLevel,
  size = 62,
  isSoulbound = false,
}: Props) {
  const [errored, setErrored] = useState(false)

  const src = `https://d36mxiodymuqjm.cloudfront.net/cards_by_level/${cdnSlug}/${encodeURIComponent(cardName)}_lv${maxLevel}.png`

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 6,
        overflow: 'hidden',
        flexShrink: 0,
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
          style={{ objectFit: 'cover', display: 'block', width: '100%', height: '100%' }}
          onError={() => setErrored(true)}
        />
      )}
      {isSoulbound && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
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
