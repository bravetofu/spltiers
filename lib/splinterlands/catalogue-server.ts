import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import snapshot from '../../data/card-catalogue.json'
import {
  normalizeCatalogue,
  type RawCard,
  type GameSettings,
  type CatalogueCard,
} from './catalogue'

// Cache the compact result, not the multi-megabyte upstream response (which can
// exceed Next's Data Cache item limit). The checked-in snapshot also permits
// builds and cold starts while the game's API is unavailable.
const loadCatalogue = unstable_cache(
  async (): Promise<CatalogueCard[]> => {
    try {
      const options = {
        // unstable_cache already bypasses the inner fetch cache. Explicit
        // no-store here incorrectly triggers a static-render bailout in Next 14.
        signal: AbortSignal.timeout(30000),
      }
      const [cards, settings] = await Promise.all([
        fetch('https://api.splinterlands.io/cards/get_details', options),
        fetch('https://api.splinterlands.io/settings', options),
      ])
      if (!cards.ok || !settings.ok)
        throw new Error(
          'The Splinterlands card directory is temporarily unavailable'
        )
      return normalizeCatalogue(
        (await cards.json()) as RawCard[],
        (await settings.json()) as GameSettings
      )
    } catch (error) {
      console.warn(
        '[catalogue] Using the bundled snapshot:',
        error instanceof Error ? error.message : 'upstream unavailable'
      )
      return snapshot as unknown as CatalogueCard[]
    }
  },
  ['splinterlands-normalized-catalogue-v2'],
  { revalidate: 3600 }
)

export const getCatalogue = cache(loadCatalogue)
