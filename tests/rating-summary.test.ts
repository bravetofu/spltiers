import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarizeBattle } from '../lib/ratings/summary'
import { parseBattle } from '../lib/ratings/battles'
import fixture from './fixtures/modern-ranked-battle.json'
import catalogue from '../data/card-catalogue.json'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
const battle = parseBattle(
  fixture,
  catalogue as unknown as CatalogueCard[],
  Date.parse(fixture.created_date) + 1000,
)!
test('daily summary excludes mirrors and counts draws as a separate outcome', () => {
  const sample = {
    ...battle,
    observations: [
      {
        ...battle.observations[0],
        mirrored: false,
        outcome: 0.5,
        expected: 0.3,
      },
      { ...battle.observations[0], mirrored: true, outcome: 1 },
    ],
    cardUsage: [
      { cardId: 1, side: 1 as const, level: 1, outcome: 1 },
      { cardId: 1, side: 2 as const, level: 1, outcome: 0 },
      { cardId: 2, side: 1 as const, level: 1, outcome: 0.5 },
    ],
  }
  const summary = summarizeBattle(sample)
  assert.equal(summary.evidence.length, 1)
  assert.equal(summary.evidence[0].draws, 1)
  assert.equal(summary.evidence[0].wins, 0)
  assert.equal(summary.evidence[0].expected, 0.3)
  assert.deepEqual(summary.usage, [
    { card_id: 1, uses: 2, wins: 1, losses: 1, draws: 0 },
    { card_id: 2, uses: 1, wins: 0, losses: 0, draws: 1 },
  ])
})
