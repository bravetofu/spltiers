import imageIndex from '../../data/card-images.json'
import { cardSlug } from './catalogue'

const images = imageIndex as unknown as Record<string, [string, number, number]>

/** Content-addressed local images are shared by the catalogue, tier lists and deck builder. */
export function localCardArt(
  edition: string,
  name: string,
  foil = 0,
  compact = false
) {
  const variant = foil >= 3 ? 3 : foil > 0 ? 1 : 0
  const key = `${edition}/${cardSlug(name)}-${variant}`
  const image = images[key]
  if (!image) return null
  const [hash, width, height] = image
  return {
    src: `/images/cards/${key}-${hash}${compact ? '.thumb' : ''}.webp`,
    width,
    height,
  }
}

export function localCardImage(edition: string, name: string, compact = false) {
  return (
    localCardArt(edition, name, 0, compact)?.src ??
    '/images/card-unavailable.svg'
  )
}
