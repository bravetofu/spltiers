import test from 'node:test'
import assert from 'node:assert/strict'
import { abilityContext } from '../lib/ratings/ability-context'
import { curatedCard } from '../lib/ratings/engine'
import {
  practicalUnit,
  reducedDamage,
  healingAmount,
  hitChance,
  SCENARIOS,
} from '../lib/ratings/practical-value'
import { checkedProfile } from '../lib/ratings/validation'
import profileJson from '../data/rating-profile.json'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
const profile = checkedProfile(profileJson)
let id = 80000
function unit(
  abilities: string[] = [],
  stats: CatalogueCard['stats'] = {},
): CatalogueCard {
  return {
    id: id++,
    slug: 'fixture',
    name: 'Fixture',
    kind: 'unit',
    splinters: ['Earth'],
    bloodline: 'Test',
    rarity: 4,
    maxLevel: 4,
    editions: [14],
    tier: 14,
    modern: true,
    foils: {},
    preview: false,
    stats: {
      mana: 4,
      attack: 3,
      ranged: 0,
      magic: 0,
      health: 8,
      armor: 2,
      speed: 3,
      abilities: [abilities],
      ...stats,
    },
  }
}
const practical = (c: CatalogueCard, pool: CatalogueCard[] = []) =>
  practicalUnit(
    c,
    'diamond',
    profile,
    abilityContext(pool, 'diamond', 'modern'),
  )
const score = (c: CatalogueCard, pool: CatalogueCard[] = []) =>
  curatedCard(c, 'diamond', 'modern', profile, pool)!.score
const output = (c: CatalogueCard) =>
  practical(c).parts.find((p) => p.label === 'Usable attack output')!.value
function archon(elements: string[], abilities: string[] = []) {
  const c = unit([], { mana: 3, abilities })
  return { ...c, kind: 'summoner' as const, splinters: elements }
}

test('incoming damage and healing honor decisive breakpoints', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((p) => reducedDamage(p, true)),
    [0, 1, 2, 2, 3],
  )
  assert.equal(reducedDamage(5, false), 5)
  assert.deepEqual([1, 3, 5, 8, 9, 16].map(healingAmount), [1, 2, 2, 2, 3, 5])
})
test('accuracy uses speed direction, evasion and bounded probabilities', () => {
  assert.equal(hitChance(2, 5), 0.7)
  assert.equal(hitChance(2, 5, 0, true), 1)
  assert.equal(hitChance(5, 2, 0, true), 0.7)
  assert.ok(hitChance(3, 3, 0.25) < hitChance(3, 3))
  assert.equal(hitChance(1, 30, 0.5), 0.1)
})
test('Double Strike scales with power and replaces the old flat attack bonus', () => {
  const weak = unit([], { attack: 1 }),
    strong = unit([], { attack: 5 })
  const doubled = (c: CatalogueCard) => ({
    ...c,
    stats: { ...c.stats, abilities: [['Double Strike']] },
  })
  assert.ok(
    output(doubled(strong)) - output(strong) >
      output(doubled(weak)) - output(weak),
  )
  assert.equal(
    practical(doubled(strong)).parts.find((p) => p.label === 'Double Strike')!
      .value,
    0,
  )
})
test('Armored Strike requires armor and improves as usable armor rises', () => {
  const bare = unit(['Armored Strike'], { armor: 0 }),
    armored = unit(['Armored Strike'], { armor: 5 })
  assert.equal(output(bare), output(unit([], { armor: 0 })))
  assert.ok(output(armored) > output(unit([], { armor: 5 })))
})
test('training is conditional on cap, format, affordability and eligibility', () => {
  const recipient = unit([], { attack: 0 }),
    trainer = unit(['Weapons Training'], { attack: 0, magic: 3 })
  assert.ok(score(recipient, [trainer]) > score(recipient))
  const untrainable = {
    ...recipient,
    stats: { ...recipient.stats, abilities: [['Untrainable']] },
  }
  const attacks = (c: CatalogueCard, pool: CatalogueCard[]) =>
    practical(c, pool).parts.find((p) => p.label === 'Usable attack output')!
      .value
  assert.equal(attacks(untrainable, [trainer]), 0)
  assert.equal(
    score(recipient, [{ ...trainer, modern: false }]),
    score(recipient),
  )
  assert.equal(
    attacks(recipient, [{ ...trainer, stats: { ...trainer.stats, mana: 60 } }]),
    0,
  )
  const locked = {
    ...trainer,
    stats: { ...trainer.stats, abilities: [[], [], [], ['Weapons Training']] },
  }
  assert.equal(
    curatedCard(recipient, 'bronze', 'modern', profile, [locked])!.parts.find(
      (p) => p.label === 'Usable attack output',
    )!.value,
    0,
  )
})
test('Back to Basics removes intrinsic ability output, and scenario weights sum to one', () => {
  const a = unit([]),
    b = {
      ...a,
      stats: { ...a.stats, abilities: [['Double Strike', 'Void', 'Heal']] },
    }
  const basic = (c: CatalogueCard) =>
    practical(c).summary.scenarios.find((s) => s.name === 'Back to Basics')!
      .value
  assert.equal(basic(a), basic(b))
  assert.ok(
    Math.abs(SCENARIOS.reduce((sum, s) => sum + s.weight, 0) - 1) < 1e-10,
  )
})
test('Dragon pairs cannot be combined into an impossible three-element package', () => {
  const dragon = archon(['Dragon']),
    earth = unit(),
    fire = { ...unit(), splinters: ['Fire'] },
    water = { ...unit(), splinters: ['Water'] }
  const ctx = abilityContext([dragon, earth, fire, water], 'diamond', 'modern')
  assert.ok(ctx.compatible(dragon, earth))
  assert.ok(ctx.compatible(dragon, fire))
  assert.equal(ctx.canField([earth, fire], 32), false)
  const dual = archon(['Earth', 'Fire'])
  assert.ok(
    abilityContext([dual, earth, fire], 'diamond', 'modern').canField(
      [earth, fire],
      32,
    ),
  )
})
test('partner packages pay archon and unit mana, respect six slots and Gladiator access', () => {
  const summoner = archon(['Earth']),
    a = unit(),
    b = unit()
  const ctx = abilityContext([summoner, a, b], 'diamond', 'modern')
  assert.equal(ctx.canField([a, b], 10), false)
  assert.equal(ctx.canField([a, b], 11), true)
  const gladiator = { ...unit(), editions: [6] }
  assert.equal(ctx.canField([a, gladiator], 32), false)
  const conscript = archon(['Earth'], ['Conscript'])
  const permitted = abilityContext(
    [conscript, a, gladiator],
    'diamond',
    'modern',
  )
  assert.ok(permitted.canField([a, gladiator], 32))
  assert.equal(
    permitted.canField([gladiator, { ...gladiator, id: id++ }], 32),
    false,
  )
})
test('Weary loses productive turns and compatible Invigorate mitigates it', () => {
  const tired = unit(['Weary']),
    awake = unit(['Invigorate'])
  assert.ok(output(tired) < output(unit()))
  assert.ok(score(tired, [awake]) > score(tired))
})
test('curator ability priors remain effective for quantitatively modeled defenses', () => {
  const c = unit(['Shield']),
    p = structuredClone(profile)
  p.abilities.Shield.standard = 0
  p.abilities.Shield.nonStandard = 0
  assert.ok(score(c) > curatedCard(c, 'diamond', 'modern', p)!.score)
})
