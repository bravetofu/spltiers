import assert from 'node:assert/strict'
import { test } from 'node:test'
import profileJson from '../data/rating-profile.json'
import catalogueJson from '../data/card-catalogue.json'
import fixture from './fixtures/modern-ranked-battle.json'
import { abilitiesAt, type CatalogueCard } from '../lib/splinterlands/catalogue'
import {
  allRatings,
  blendRating,
  curatedCard,
  rateCard,
  rateAbility,
} from '../lib/ratings/engine'
import { checkedProfile, validateProfile } from '../lib/ratings/validation'
import { parseBattle } from '../lib/ratings/battles'
import { sharedReplayIds } from '../lib/ratings/collector'
import { EMPTY_EVIDENCE, type Evidence } from '../lib/ratings/types'

const profile = checkedProfile(profileJson),
  cards = catalogueJson as unknown as CatalogueCard[]
const fresh = () => structuredClone(profile)
const at = Date.parse(fixture.created_date) + 1000

test('initial curation covers all known abilities and validates against actual combat cards', () => {
  assert.equal(
    validateProfile(
      profile,
      new Set(cards.filter((c) => c.kind !== 'land').map((c) => c.id)),
    ),
    null,
  )
  assert.equal(Object.keys(profile.abilities).length, 124)
})
test('all combat scopes stay bounded; land and Wild-exclusive cards receive no Modern combat score', () => {
  const scores = allRatings(cards, profile)
  assert.ok(scores.cards.length > 5000)
  for (const score of [...scores.cards, ...scores.abilities])
    assert.ok(
      Number.isFinite(score.score) && score.score >= 0 && score.score <= 10,
    )
  const land = cards.find((c) => c.kind === 'land')!,
    wild = cards.find((c) => c.kind === 'unit' && !c.modern)!,
    modern = cards.find((c) => c.kind === 'unit' && c.modern)!
  assert.equal(rateCard(land, 'bronze', 'wild', profile), null)
  assert.equal(rateCard(wild, 'diamond', 'modern', profile), null)
  assert.ok(rateCard(modern, 'diamond', 'wild', profile))
})
test('no or sparse battle data keeps a valid curated rating rather than inventing evidence', () => {
  assert.equal(blendRating(7.2).score, 7.2)
  assert.equal(blendRating(7.2).battleScore, null)
  const sparse: Evidence = {
    ...EMPTY_EVIDENCE,
    battles: 29,

    days: 10,
    effective: 29,
    adjustedWinRate: 1,
  }
  assert.equal(blendRating(7.2, sparse).battleWeight, 0)
  assert.equal(
    blendRating(7.2, {
      ...sparse,
      battles: 10000,
      effective: 10000,
      days: 1,
    }).score,
    7.2,
  )
})
test('broad evidence blends gradually with a hard 65% maximum and can lower an optimistic prior', () => {
  const evidence: Evidence = {
    ...EMPTY_EVIDENCE,
    battles: 10000,

    days: 30,
    effective: 9000,
    adjustedWinRate: 0.4,
    rawWinRate: 0.7,
  }
  const result = blendRating(9, evidence)
  assert.ok(result.battleWeight > 0 && result.battleWeight <= 0.65)
  assert.ok(result.score < 9 && result.score > 6)
  assert.equal(result.confidence, 'strong')
})

test('well-sampled results at expectation preserve the curated strength scale', () => {
  const evidence: Evidence = {
    ...EMPTY_EVIDENCE,
    battles: 10000,

    days: 30,
    effective: 9000,
    adjustedWinRate: 0.5,
  }
  assert.equal(blendRating(9, evidence).score, 9)
  assert.equal(blendRating(2, evidence).score, 2)
})
test('rating uses the selected level, unlocked abilities and signed summoner effects', () => {
  const unit = cards.find(
    (c) =>
      c.kind === 'unit' &&
      c.maxLevel === 10 &&
      abilitiesAt(c, 10).length > abilitiesAt(c, 3).length,
  )!
  const bronze = curatedCard(
    unit,
    'bronze',
    unit.modern ? 'modern' : 'wild',
    profile,
  )!
  assert.equal(bronze.level, 3)
  assert.equal(
    bronze.parts.filter((p) => Object.keys(profile.abilities).includes(p.label))
      .length,
    abilitiesAt(unit, 3).length,
  )
  const summoner = cards.find(
    (c) =>
      c.kind === 'summoner' &&
      typeof c.stats.speed === 'number' &&
      c.stats.speed < 0,
  )!
  assert.ok(
    curatedCard(
      summoner,
      'diamond',
      summoner.modern ? 'modern' : 'wild',
      profile,
    )!.parts.find((p) => p.label === 'Team stat effects')!.value > 0,
  )
  assert.ok(
    rateAbility('Heal', 'bronze', 'modern', profile).curated >=
      rateAbility('Heal', 'diamond', 'modern', profile).curated,
  )
})
test('overlapping adjustments cannot bypass the +/-2 cap; pairing order cannot create duplicates', () => {
  const p = fresh(),
    id = cards.find((c) => c.kind === 'unit')!.id
  p.adjustments = [
    { cardId: id, league: 'all', format: 'all', delta: 2, notes: 'Review' },
    {
      cardId: id,
      league: 'bronze',
      format: 'modern',
      delta: 1,
      notes: 'Extra',
    },
  ]
  assert.match(validateProfile(p)!, /Combined adjustments/)
  const duplicate = fresh()
  duplicate.synergies.push({
    ...duplicate.synergies[0],
    abilities: [...duplicate.synergies[0].abilities].reverse() as [
      string,
      string,
    ],
  })
  assert.match(validateProfile(duplicate)!, /Duplicate synergy/)
})
test('invalid weights, unexplained changes and missing ability priors are rejected', () => {
  const p = fresh()
  p.abilities.Heal.standard = NaN
  assert.match(validateProfile(p)!, /Invalid ability/)
  p.abilities.Heal.standard = 9
  p.abilities.Heal.notes = ''
  assert.match(validateProfile(p)!, /Invalid ability/)
  delete p.abilities.Heal
  assert.match(validateProfile(p)!, /Every current ability/)
})
test('live ranked fixture maps explicit rarity caps correctly and keeps original pre-battle ratings', () => {
  const result = parseBattle(fixture, cards, at)!
  assert.equal(result.matchType, 'Ranked')
  assert.equal(result.format, 'modern')
  assert.equal(result.league, 'silver')
  assert.equal(result.leagueMethod, 'explicit')
  assert.equal(result.eligible, true, result.exclusion ?? '')
  assert.ok(result.observations.length > 0)
  assert.ok(
    result.observations.every((o) => o.expected >= 0 && o.expected <= 1),
  )
  assert.equal('player_1_data' in result.raw, false)
})
test('either replay queue ID yields one canonical battle, with no duplicate outcome evidence', () => {
  const a = parseBattle(fixture, cards, at)!,
    b = parseBattle(
      {
        ...fixture,
        battle_queue_id_1: fixture.battle_queue_id_2,
        battle_queue_id_2: fixture.battle_queue_id_1,
      },
      cards,
      at,
    )!
  assert.equal(a.id, b.id)
  assert.equal(
    new Set(a.observations.map((o) => `${o.side}:${o.kind}:${o.subject}`)).size,
    a.observations.length,
  )
})
test('non-ranked, surrender, unknown outcomes and custom caps cannot contaminate ranked scores', () => {
  for (const patch of [
    { match_type: 'Tournament' },
    { is_surrender: true },
    { winner: 'unknown' },
    {
      settings: JSON.stringify({
        max_common_level: 7,
        max_rare_level: 4,
        max_epic_level: 3,
        max_legendary_level: 2,
      }),
    },
  ]) {
    const b = parseBattle({ ...fixture, ...patch }, cards, at)!
    assert.equal(b.eligible, false)
    assert.equal(b.observations.length, 0)
  }
  assert.equal(
    parseBattle('Error: no battle queue transaction found', cards),
    null,
  )
  assert.equal(
    parseBattle({ ...fixture, format: 'foundation' }, cards, at),
    null,
  )
})
test('identical features on both teams are marked as mirrors, while underlevelled card appearances are excluded', () => {
  const details = JSON.parse(fixture.details),
    modified = structuredClone(fixture)
  details.team2 = structuredClone(details.team1)
  details.team2.player = fixture.player_2
  modified.details = JSON.stringify(details)
  const b = parseBattle(modified, cards, at)!
  assert.equal(b.eligible, true, b.exclusion ?? '')
  assert.ok(b.observations.length > 0)
  assert.ok(b.observations.every((o) => o.mirrored))
  const map = new Map(cards.map((c) => [String(c.id), c]))
  for (const o of b.observations.filter((o) => o.kind === 'card'))
    assert.equal(
      o.level,
      Math.min(
        map.get(o.subject)!.maxLevel,
        ({ 1: 5, 2: 4, 3: 3, 4: 2 } as Record<number, number>)[
          map.get(o.subject)!.rarity
        ],
      ),
    )
})
test('shared-post discovery accepts only official replay URLs and extracts no arbitrary request destinations', () => {
  const id = 'sl_0123456789abcdef'
  assert.deepEqual(
    sharedReplayIds([
      {
        body: `https://splinterlands.com/?p=battle&amp;id=${id} https://evil.example/?id=sl_abcdefghi https://splinterlands.com.evil.example/?id=sl_abcdefghi https://splinterlands.com/?id=sl`,
      },
    ]),
    [id],
  )
})

test('repeatable tribute rewards mechanics and affordability, not card identity', () => {
  const grix = cards.find((c) => c.name === 'Grix')!
  const score = (card: CatalogueCard, pool = cards) =>
    curatedCard(card, 'diamond', 'modern', profile, pool)!.score
  const original = score(grix)
  assert.ok(
    original > 9,
    'Repeatable, affordable Tribute remains exceptional without saturating the scale',
  )
  const anonymous = { ...grix, id: 999999, name: 'Anonymous test unit' }
  assert.equal(
    score(
      anonymous,
      cards.map((c) => (c.id === grix.id ? anonymous : c)),
    ),
    original,
  )
  const without = (ability: string) => ({
    ...grix,
    stats: {
      ...grix.stats,
      abilities: (grix.stats.abilities as string[][]).map((level) =>
        level.filter((a) => a !== ability),
      ),
    },
  })
  assert.ok(score(without('Rebirth')) < original)
  assert.ok(score(without('Taunt')) < original)
  assert.ok(
    score({ ...grix, stats: { ...grix.stats, mana: [9, 9, 9, 9] } }) < original,
  )
  assert.ok(score(grix, []) < original)
  const mancer = cards.find((c) => c.name === 'Dragonlord Mancer')!
  assert.ok(
    score(mancer, cards) >
      score(
        mancer,
        cards.filter(
          (c) => !abilitiesAt(c, c.maxLevel).includes('Bloodline Tribute'),
        ),
      ),
  )
  assert.ok(
    curatedCard(grix, 'bronze', 'modern', profile, cards)!.score < original,
  )
})
