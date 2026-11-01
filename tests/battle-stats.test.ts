import assert from 'node:assert/strict'
import { test } from 'node:test'
import fixture from './fixtures/modern-ranked-battle.json'
import catalogue from '../data/card-catalogue.json'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
import { parseBattle } from '../lib/ratings/battles'
import {
  cardWinRate,
  formatWinRate,
  EMPTY_BATTLE_STATS,
} from '../lib/ratings/battle-stats'

const cards = catalogue as unknown as CatalogueCard[]
const at = Date.parse(fixture.created_date) + 1000

test('usage retains every lineup card, including summoners, underlevelled cards and mirrors', () => {
  const details = JSON.parse(fixture.details)
  details.team1.summoner.level = 1
  details.team2 = structuredClone(details.team1)
  details.team2.player = fixture.player_2
  const battle = parseBattle(
    { ...fixture, details: JSON.stringify(details) },
    cards,
    at,
  )!
  assert.ok(battle.eligible)
  assert.equal(battle.cardUsage.length, 2 * (details.team1.monsters.length + 1))
  const summoners = battle.cardUsage.filter(
    (u) => u.cardId === details.team1.summoner.card_detail_id,
  )
  assert.equal(summoners.length, 2)
  assert.deepEqual(summoners.map((u) => u.outcome).sort(), [0, 1])
  assert.ok(
    !battle.observations.some(
      (o) =>
        o.kind === 'card' &&
        Number(o.subject) === details.team1.summoner.card_detail_id,
    ),
  )
})

test('draws remain separate from wins and losses, and empty samples have no win rate', () => {
  const draw = parseBattle({ ...fixture, winner: 'DRAW' }, cards, at)!
  assert.ok(draw.cardUsage.length)
  assert.ok(draw.cardUsage.every((u) => u.outcome === 0.5))
  assert.equal(cardWinRate(EMPTY_BATTLE_STATS), null)
  assert.equal(formatWinRate(EMPTY_BATTLE_STATS), '—')
  assert.equal(
    formatWinRate({ uses: 4, wins: 1, losses: 2, draws: 1 }),
    '25.0%',
  )
  assert.equal(formatWinRate({ uses: 2, wins: 0, losses: 2, draws: 0 }), '0.0%')
})

test('unresolved, surrender and non-ranked matches never create public usage rows', () => {
  for (const patch of [
    { winner: 'unknown' },
    { is_surrender: true },
    { match_type: 'Tournament' },
  ]) {
    assert.deepEqual(
      parseBattle({ ...fixture, ...patch }, cards, at)!.cardUsage,
      [],
    )
  }
})
