import 'server-only'
import { cache } from 'react'
import {
  normalizeCatalogue,
  type RawCard,
  type GameSettings,
} from './catalogue'

export const getCatalogue = cache(async () => {
  const options = {
    next: { revalidate: 3600 },
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
})
