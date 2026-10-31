import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  abilitiesAt,
  cardImage,
  cardInTab,
  cardSlug,
  filterCards,
  landAbilitiesAt,
  levelForLeague,
  normalizeCatalogue,
  parseCatalogueFilters,
  statAt,
  type CatalogueFilters,
  type RawCard,
} from '../lib/splinterlands/catalogue'
import {
  abilityInfo,
  hasAbilityDescription,
} from '../lib/splinterlands/abilities'
import { summarizePrices } from '../lib/splinterlands/card-prices'

const raw = (changes: Partial<RawCard> = {}): RawCard => ({
  id: 1,
  name: 'Goblin Shaman',
  color: 'Red',
  secondary_color: null,
  type: 'Monster',
  sub_type: 'Goblin',
  rarity: 1,
  editions: '0,1',
  tier: 0,
  game_type: 'splinterlands',
  total_printed: 100,
  stats: {
    mana: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    attack: [0, 0, 0, 1],
    health: [4, 5, 6],
    abilities: [['Weaken'], [], ['Slow'], [], ['Shatter']],
  },
  ...changes,
})
const settings = {
  modern_editions: [12, 14, 15, 16],
  modern_card_detail_ids: [505],
}
const filters: CatalogueFilters = {
  kind: 'unit',
  q: '',
  splinter: '',
  rarity: '',
  format: '',
  edition: '',
  league: 'diamond',
  bloodline: '',
}

test('catalogue includes old, modern, gladiator, Foundation, land, and unprinted definitions; excludes Soulkeep', () => {
  const cards = normalizeCatalogue(
    [
      raw(),
      raw({ id: 2, editions: '6' }),
      raw({ id: 3, editions: '15,16' }),
      raw({
        id: 4,
        editions: '19',
        stats: { land_abilities: [[['GRAIN', 0.1]]] },
      }),
      raw({ id: 5, total_printed: 0 }),
      raw({ id: 10000, game_type: 'soulkeep' }),
    ],
    settings
  )
  assert.equal(cards.length, 5)
  assert.equal(cards.find((card) => card.id === 4)?.kind, 'land')
  assert.equal(cards.find((card) => card.id === 5)?.preview, true)
})
test('Modern uses current game settings including reward/promo parent tiers and explicit exceptions', () => {
  const cards = normalizeCatalogue(
    [
      raw({ id: 1, editions: '7', tier: 7 }),
      raw({ id: 2, editions: '18', tier: 14 }),
      raw({ id: 3, editions: '2', tier: 12 }),
      raw({ id: 505, editions: '2', tier: 7 }),
      raw({ id: 4, editions: '20', tier: 14 }),
    ],
    settings
  )
  assert.deepEqual(
    cards
      .filter((card) => card.modern)
      .map((card) => card.id)
      .sort(),
    [2, 3, 4, 505].sort()
  )
  assert.equal(filterCards(cards, { ...filters, format: 'wild' }).length, 1)
  assert.equal(filterCards(cards, filters).length, 5)
})
test('all filters intersect and dual-element cards match either splinter', () => {
  const cards = normalizeCatalogue(
    [raw({ secondary_color: 'Blue' }), raw({ id: 2, color: 'Green' })],
    settings
  )
  assert.equal(
    filterCards(cards, {
      ...filters,
      q: 'GOBLIN',
      splinter: 'Water',
      bloodline: 'Goblin',
      edition: '1',
      rarity: '1',
    }).length,
    1
  )
  assert.equal(
    filterCards(cards, { ...filters, splinter: 'Water', rarity: '4' }).length,
    0
  )
})
test('unit stats use selected rarity-specific league cap and abilities accumulate across levels', () => {
  const card = normalizeCatalogue([raw()], settings)[0]
  assert.equal(levelForLeague(card, 'bronze'), 3)
  assert.equal(statAt(card, 'attack', 3), 0)
  assert.deepEqual(abilitiesAt(card, 3), ['Weaken', 'Slow'])
  assert.deepEqual(abilitiesAt(card, 10), ['Weaken', 'Slow', 'Shatter'])
  assert.equal(statAt(card, 'health', 10), 6)
})
test('summoner scalar bonuses and direct ability lists remain valid at every level', () => {
  const card = normalizeCatalogue(
    [
      raw({
        type: 'Summoner',
        rarity: 4,
        stats: { mana: 7, speed: -1, abilities: ['Blind'], ptrOptions: [] },
      }),
    ],
    settings
  )[0]
  assert.equal(card.kind, 'summoner')
  assert.equal(levelForLeague(card, 'silver'), 2)
  assert.equal(statAt(card, 'speed', 1), -1)
  assert.deepEqual(abilitiesAt(card, 1), ['Blind'])
  assert.deepEqual(abilitiesAt(card, 4), ['Blind'])
})
test('land modifiers are per-level snapshots, not accumulated; dual-purpose units appear in both tabs', () => {
  const card = normalizeCatalogue(
    [
      raw({
        stats: {
          mana: [2, 2],
          land_abilities: [
            [['GRAIN', 0.01]],
            [
              ['GRAIN', 0.03],
              ['DD', -0.1],
            ],
          ],
        },
      }),
    ],
    settings
  )[0]
  assert.equal(cardInTab(card, 'unit'), true)
  assert.equal(cardInTab(card, 'land'), true)
  assert.deepEqual(landAbilitiesAt(card, 2), [
    ['GRAIN', 0.03],
    ['DD', -0.1],
  ])
  assert.equal(abilityInfo(['DD', -0.1]).label, 'Dark Discount -10%')
})
test('card slugs handle punctuation and collisions without losing a page', () => {
  assert.equal(cardSlug('Druid’s Golem'), 'druids-golem')
  const cards = normalizeCatalogue(
    [raw({ name: 'Test: A' }), raw({ id: 2, name: 'Test A' })],
    settings
  )
  assert.equal(new Set(cards.map((card) => card.slug)).size, 2)
})
test('official image paths preserve selected edition and separate black from gold art', () => {
  const card = normalizeCatalogue([raw()], settings)[0]
  assert.ok(cardImage(card, 0).includes('/alpha/'))
  assert.ok(cardImage(card, 1, 2).endsWith('_gold.png'))
  assert.ok(cardImage(card, 1, 4).endsWith('_blk.png'))
})
test('linked Kindred abilities retain the linked effect and official icon', () => {
  const info = abilityInfo('Kindred Spirit:Blast')
  assert.ok(info.icon.endsWith('ability_kindred-spirit.png'))
  assert.ok(info.description.includes('Linked ability: Blast'))
  assert.equal(hasAbilityDescription('Kindred Spirit:Blast'), true)
  assert.ok(abilityInfo('Stray Shot').description.includes('random ally'))
})
test('prices distinguish lowest per-BCX and an actual 1-BCX listing, separately for edition and all five foils', () => {
  const result = summarizePrices(
    [
      { edition: 0, foil: 0, buy_price: 6, bcx: 10 },
      { edition: 0, foil: 0, buy_price: 2, bcx: 1 },
      { edition: 1, foil: 0, buy_price: 0.1, bcx: 1 },
      { edition: 0, foil: '1', buy_price: 5, bcx: 1 },
      { edition: 0, foil: 2, buy_price: 100, bcx: 10 },
      { edition: 0, foil: 3, buy_price: 300, bcx: 10 },
      { edition: 0, foil: 4, buy_price: 1000, bcx: 10 },
    ],
    0
  )
  assert.equal(result[0].perBcx, 0.6)
  assert.equal(result[0].singleBcx, 2)
  assert.equal(result[1].singleBcx, 5)
  assert.deepEqual(
    result.slice(2).map((price) => price.perBcx),
    [10, 30, 100]
  )
  assert.deepEqual(
    result.slice(2).map((price) => price.singleBcx),
    [null, null, null]
  )
})
test('prices reject invalid, zero, negative, and non-USD offers instead of displaying false zero prices', () => {
  const result = summarizePrices(
    [
      { edition: 0, foil: 0, buy_price: 0, bcx: 1 },
      { edition: 0, foil: 0, buy_price: 1, bcx: 0 },
      { edition: 0, foil: 0, buy_price: -1, bcx: 1 },
      { edition: 0, foil: 0, buy_price: 'NaN', bcx: 1 },
      { edition: 0, foil: 0, buy_price: 1, bcx: 1, currency: 'DEC' },
    ],
    0
  )
  assert.deepEqual(
    result.map((price) => price.perBcx),
    [null, null, null, null, null]
  )
})

test('shared filter URLs reject invalid modes and ignore battle formats on land cards', () => {
  assert.equal(
    parseCatalogueFilters({ kind: 'land', format: 'modern' }).format,
    ''
  )
  const parsed = parseCatalogueFilters({
    kind: 'invalid',
    league: '99',
    rarity: '0',
    format: 'unknown',
    splinter: 'fake',
  })
  assert.equal(parsed.kind, 'unit')
  assert.equal(parsed.league, 'diamond')
  assert.equal(parsed.rarity, '')
  assert.equal(parsed.format, '')
  assert.equal(parsed.splinter, '')
})
