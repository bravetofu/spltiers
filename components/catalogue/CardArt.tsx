'use client'

import { useState } from 'react'
import {
  cardImageCandidates,
  FOILS,
  type CatalogueCard,
} from '@/lib/splinterlands/catalogue'

export default function CardArt({
  card,
  edition,
  foil = 0,
  compact = false,
}: {
  card: CatalogueCard
  edition: number
  foil?: number
  compact?: boolean
}) {
  const [attempt, setAttempt] = useState(0)
  const foilInfo = FOILS.find((entry) => entry.id === foil) ?? FOILS[0]
  const images = cardImageCandidates(card, edition, foil)
  return (
    <div
      className={`catalogue-art ${compact ? 'art-compact' : ''} foil-${foil}`}
      style={{ borderColor: foilInfo.color }}
    >
      {attempt < images.length ? (
        // Official pre-rendered artwork is served directly from the Splinterlands CDN.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={images[attempt]}
          alt={`${card.name} · ${foilInfo.name} foil`}
          width={compact ? 48 : 320}
          height={compact ? 64 : 440}
          loading={compact ? 'lazy' : 'eager'}
          onError={() => setAttempt((value) => value + 1)}
        />
      ) : (
        <div className="art-unavailable">
          {compact ? card.name.slice(0, 2) : 'Artwork not published yet'}
        </div>
      )}
    </div>
  )
}
