import test from 'node:test'
import assert from 'node:assert/strict'
import catalogue from '../data/card-catalogue.json'
import profileJson from '../data/rating-profile.json'
import { curatedCard, rateAbility, abilityPrior } from '../lib/ratings/engine'
import {
  abilityContext,
  contextualAbilityParts,
} from '../lib/ratings/ability-context'
import { teamEngineParts } from '../lib/ratings/team-engines'
import {
  ABILITY_REVIEW,
  applyAbilityReview,
} from '../lib/ratings/curation-review'
import { checkedProfile } from '../lib/ratings/validation'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
import type { League, BattleFormat } from '../lib/ratings/types'
const profile = checkedProfile(profileJson)
let sequence = 90000
function unit(
  abilities: string[] = [],
  stats: Record<string, unknown> = {},
): CatalogueCard {
  return {
    ...(catalogue[0] as unknown as CatalogueCard),
    id: sequence++,
    name: 'Anonymous fixture',
    kind: 'unit',
    rarity: 1,
    maxLevel: 10,
    modern: true,
    splinters: ['Earth'],
    bloodline: 'Test race',
    stats: {
      mana: 4,
      attack: 0,
      ranged: 0,
      magic: 0,
      health: 8,
      speed: 3,
      armor: 1,
      abilities: [abilities],
      ...stats,
    },
  }
}
function parts(
  card: CatalogueCard,
  pool: CatalogueCard[] = [],
  league: League = 'diamond',
  format: BattleFormat = 'modern',
) {
  return contextualAbilityParts(
    card,
    league,
    profile,
    abilityContext(pool, league, format),
  )
}
const delta = (
  card: CatalogueCard,
  pool: CatalogueCard[] = [],
  league: League = 'diamond',
  format: BattleFormat = 'modern',
) => parts(card, pool, league, format).reduce((sum, p) => sum + p.value, 0)

test('reviewed shared ability priors raise published strength and appear in card baselines', () => {
  for (const name of ['Shapeshift', 'Bloodline Tribute', 'Bloodlust']) {
    assert.ok(rateAbility(name, 'diamond', 'modern', profile).curated >= 9)
    const card = unit([name], { magic: 3 })
    const part = curatedCard(card, 'diamond', 'modern', profile)!.parts.find(
      (p) => p.label === name,
    )!
    assert.ok(
      Math.abs(part.value - (abilityPrior(name, profile) / 10) * 1.3) < 0.001,
    )
  }
  assert.ok(
    abilityPrior('Electrified', profile) > abilityPrior('Weary', profile),
  )
  assert.ok(
    curatedCard(
      unit(['Electrified']),
      'diamond',
      'modern',
      profile,
    )!.parts.find((p) => p.label === 'Electrified')!.value < 0,
  )
})
test('Bloodlust rewards attack pressure, and no-attack training needs an unlocked compatible donor', () => {
  const weak = unit(['Bloodlust'], { ranged: 1 }),
    dual = unit(['Bloodlust'], { attack: 3, magic: 3 }),
    blank = unit(['Bloodlust'])
  assert.ok(delta(dual) > delta(weak))
  const trainer = unit(['Weapons Training'], { magic: 3 })
  assert.ok(delta(blank, [trainer]) > delta(blank))
  assert.equal(
    delta(unit(['Bloodlust', 'Untrainable']), [trainer]),
    delta(blank),
  )
  assert.equal(
    delta(blank, [{ ...trainer, splinters: ['Fire'] }]),
    delta(blank),
  )
  const locked = {
    ...trainer,
    stats: { ...trainer.stats, abilities: [[], [], [], ['Weapons Training']] },
  }
  assert.equal(delta(blank, [locked], 'bronze'), delta(blank, [], 'bronze'))
  assert.ok(delta(blank, [locked]) > delta(blank))
  assert.equal(delta(blank, [{ ...trainer, modern: false }]), delta(blank))
  assert.ok(
    delta(blank, [{ ...trainer, modern: false }], 'diamond', 'wild') >
      delta(blank, [], 'diamond', 'wild'),
  )
})
test('Painforge conversions require useful recipients and preserve source-specific trigger constraints', () => {
  const forge = unit(['Painforge'], { attack: 3 })
  const electric = unit(['Electrified'], { magic: 2 })
  assert.ok(delta(electric, [forge]) > 0)
  assert.equal(delta(electric), 0)
  assert.equal(delta(unit(['Weary'], { magic: 2 }), [forge]), 0)
  assert.equal(delta(electric, [unit(['Painforge'])]), 0)
  assert.ok(delta(unit(['Electrified', 'Painforge'], { magic: 2 })) > 0)
  assert.ok(delta(unit(['Incendiary', 'Painforge'], { magic: 2 })) > 0)
  assert.equal(delta(unit(['Reckless', 'Painforge'], { magic: 2 })), 0)
  assert.equal(delta(unit(['Reckless']), [forge]), 0)
  assert.equal(delta(unit(['Stray Shot'], { magic: 2 }), [forge]), 0)
  const reckless = delta(unit(['Reckless'], { attack: 3 }), [forge])
  const stray = delta(unit(['Stray Shot'], { ranged: 3 }), [forge])
  assert.ok(reckless > stray && stray > 0)
  assert.ok(delta(forge, [electric]) > 0)
  assert.equal(delta(forge, [{ ...electric, modern: false }]), 0)
  assert.ok(
    delta(electric, [forge]) >
      delta(electric, [{ ...forge, stats: { ...forge.stats, health: 1 } }]),
  )
})
test('Shapeshift accesses other bloodlines and keeps alternative summoners mutually exclusive', () => {
  const shape = unit(['Shapeshift'], { magic: 3 })
  const summoner: CatalogueCard = {
    ...unit(['Bloodline Dominion']),
    kind: 'summoner',
    splinters: ['Fire'],
    stats: {
      abilities: ['Bloodline Dominion'],
      racialSynergy: [{ race: 'Other race', abilities: ['Heal'] }],
    },
  }
  assert.ok(delta(shape, [summoner]) > 0)
  assert.equal(
    delta(shape, [summoner]),
    delta(shape, [summoner, { ...summoner, id: sequence++ }]),
  )
  const tribute = {
    ...unit(['Bloodline Tribute'], { magic: 2 }),
    bloodline: 'Another race',
  }
  const pact = { ...unit(['Bloodline Pact']), bloodline: 'Another race' }
  assert.ok(delta(shape, [summoner, tribute, pact]) > delta(shape, [summoner]))
  assert.equal(delta(shape, [{ ...summoner, modern: false }]), 0)
  const locked = {
    ...tribute,
    stats: { ...tribute.stats, abilities: [[], [], [], ['Bloodline Tribute']] },
  }
  assert.equal(delta(shape, [locked], 'bronze'), 0)
})
test('Tribute credits each shared attack and a bounded compatible external resurrection', () => {
  const tribute = unit(['Bloodline Tribute', 'Taunt'], { attack: 2, magic: 2 })
  const ally = unit([], { attack: 2, magic: 2 })
  const reviver = unit(['Resurrect'])
  const value = (
    c: CatalogueCard,
    pool: CatalogueCard[],
    league: League = 'diamond',
  ) =>
    teamEngineParts(c, league, 'modern', pool, profile).reduce(
      (sum, p) => sum + p.value,
      0,
    )
  assert.ok(value(tribute, [ally, reviver]) > value(tribute, [ally]))
  // Use a different bloodline so additional revivers do not also add Tribute beneficiaries.
  const support = { ...reviver, bloodline: 'Support race' }
  assert.equal(
    value(tribute, [ally, support]),
    value(tribute, [ally, support, { ...support, id: sequence++ }]),
  )
  assert.ok(
    value(tribute, [ally]) >
      value({ ...tribute, stats: { ...tribute.stats, magic: 0 } }, [ally]),
  )
  assert.equal(
    value(tribute, [ally, { ...support, modern: false }]),
    value(tribute, [ally]),
  )
  const locked = {
    ...support,
    stats: { ...support.stats, abilities: [[], [], [], ['Resurrect']] },
  }
  assert.equal(
    value(tribute, [ally, locked], 'bronze'),
    value(tribute, [ally], 'bronze'),
  )
})
test('the curation review is idempotent and preserves custom weights, adjustments and private edits', () => {
  const old = structuredClone(profile)
  for (const [name, change] of Object.entries(ABILITY_REVIEW.abilities))
    old.abilities[name] = { ...change.previous }
  const review = applyAbilityReview(old)
  assert.equal(review.changed.length, 8)
  assert.deepEqual(review.config, profile)
  assert.equal(applyAbilityReview(review.config).changed.length, 0)
  old.abilities.Shapeshift.notes = 'An unpublished curator decision'
  old.abilities.Bloodlust.standard = 7.123
  old.adjustments.push({
    cardId: 123,
    league: 'all',
    format: 'all',
    delta: 0.5,
    notes: 'Keep this',
  })
  const merged = applyAbilityReview(old)
  assert.deepEqual(merged.preserved.sort(), ['Bloodlust', 'Shapeshift'])
  assert.equal(
    merged.config.abilities.Shapeshift.notes,
    'An unpublished curator decision',
  )
  assert.equal(merged.config.abilities.Bloodlust.standard, 7.123)
  assert.deepEqual(merged.config.adjustments, old.adjustments)
  assert.equal(old.abilities.Electrified.standard, 1, 'Input is not mutated')
})
