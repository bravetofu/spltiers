'use client'

import {
  artEdition,
  FOILS,
  type CatalogueCard,
} from '@/lib/splinterlands/catalogue'
import { localCardArt } from '@/lib/splinterlands/card-assets'

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
  const foilInfo = FOILS.find((entry) => entry.id === foil) ?? FOILS[0]
  const image = localCardArt(
    artEdition(card, edition),
    card.name,
    foil,
    compact
  )
  return (
    <div
      className={`catalogue-art ${compact ? 'art-compact' : ''} foil-${foil}`}
    >
      {image ? (
        // Optimized local files avoid remote requests and runtime fallback waterfalls.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.src}
          alt={`${card.name} · ${foilInfo.name} foil`}
          width={image.width}
          height={image.height}
          loading={compact ? 'lazy' : 'eager'}
          decoding="async"
        />
      ) : (
        <div className="art-unavailable">
          {compact ? card.name.slice(0, 2) : 'Artwork not published yet'}
        </div>
      )}
    </div>
  )
}
