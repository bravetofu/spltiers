import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import cardsJson from '../data/card-catalogue.json'
import imageIndex from '../data/card-images.json'
import unpublished from '../data/unpublished-images.json'
import {
  artEdition,
  cardSlug,
  type CatalogueCard,
} from '../lib/splinterlands/catalogue'
import { localCardArt } from '../lib/splinterlands/card-assets'

const cards = cardsJson as unknown as CatalogueCard[]

test('every catalogue print and minted foil resolves to local art or an explicitly unpublished variant', () => {
  const unavailable = new Set<string>(unpublished)
  for (const card of cards)
    for (const edition of card.editions) {
      for (const foil of card.foils[edition]) {
        const variant = foil >= 3 ? 3 : foil > 0 ? 1 : 0
        const key = `${artEdition(card, edition)}/${cardSlug(card.name)}-${variant}`
        const full = localCardArt(artEdition(card, edition), card.name, foil)
        assert.ok(full || unavailable.has(key), `Missing local art: ${key}`)
        if (full) {
          assert.ok(existsSync(`public${full.src}`), full.src)
          assert.ok(
            existsSync(
              `public${localCardArt(artEdition(card, edition), card.name, foil, true)!.src}`
            )
          )
        }
      }
    }
  assert.ok(
    Buffer.byteLength(JSON.stringify(cards)) < 1_000_000,
    'Normalized data must fit comfortably in the Data Cache'
  )
})

test('immutable card filenames match their actual bytes and all ability icons are stored locally', () => {
  for (const [key, value] of Object.entries(imageIndex)) {
    const [hash] = value as [string, number, number]
    const file = key.startsWith('abilities/')
      ? `public/images/${key}.webp`
      : `public/images/cards/${key}-${hash}.webp`
    const bytes = readFileSync(file)
    assert.equal(
      createHash('sha256').update(bytes).digest('hex').slice(0, 10),
      hash,
      file
    )
    assert.ok(bytes.includes(Buffer.from('WEBP')), file)
  }
})
