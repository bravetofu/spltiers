import {
  abilitiesAt,
  levelForLeague,
  type CatalogueCard,
} from '../splinterlands/catalogue'
import { abilityPrior } from './ability-priors'
import type { AbilityContext } from './ability-context'
import type { League, RatingProfile, ScorePart } from './types'

const limit = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n))
const mean = (xs: number[], fallback: number) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback
export type PracticalScenario = {
  name: string
  weight: number
  value: number
  role: string
}
export type PracticalSummary = { role: string; scenarios: PracticalScenario[] }
// Deliberately small sensitivity panel, not claimed to be measured ruleset frequencies.
export const SCENARIOS = [
  { name: 'Low mana', weight: 0.15, budget: 22, mode: 'normal' },
  { name: 'Mixed opposition', weight: 0.25, budget: 32, mode: 'normal' },
  { name: 'High mana', weight: 0.15, budget: 50, mode: 'normal' },
  { name: 'Armored opposition', weight: 0.1, budget: 32, mode: 'armor' },
  { name: 'Magic opposition', weight: 0.1, budget: 32, mode: 'magic' },
  { name: 'Reverse Speed', weight: 0.05, budget: 32, mode: 'reverse' },
  { name: 'Noxious Fumes', weight: 0.05, budget: 32, mode: 'poison' },
  { name: 'Melee Mayhem', weight: 0.05, budget: 32, mode: 'melee' },
  { name: 'Close Range', weight: 0.05, budget: 32, mode: 'ranged' },
  { name: 'Back to Basics', weight: 0.05, budget: 32, mode: 'basic' },
] as const

/** Exact damage breakpoints, used in the small representative incoming-hit panel. */
export function reducedDamage(power: number, reduction: boolean) {
  return reduction ? (power <= 1 ? 0 : Math.ceil(power / 2)) : power
}
export function hitChance(
  attacker: number,
  defender: number,
  evasion = 0,
  reverse = false,
) {
  return limit(
    1 -
      Math.max(0, reverse ? attacker - defender : defender - attacker) * 0.1 -
      evasion,
    0.1,
    1,
  )
}
export function healingAmount(health: number) {
  return Math.min(health, Math.max(2, Math.floor(health / 3)))
}

// These effects are evaluated quantitatively below. Suppress their old stat and
// pair bonuses when BOTH effects are already represented in the same calculation.
export const PRACTICAL_ABILITIES = new Set([
  'Double Strike',
  'Armored Strike',
  'Heal',
  'Void',
  'Shield',
  'Void Armor',
  'Dodge',
  'Flying',
  'Phase',
  'True Strike',
  'Backfire',
  'Blast',
  'Recharge',
  'Reach',
  'Close Range',
  'Charge',
  'Bloodlust',
  'Weapons Training',
  'Weary',
  'Tank Heal',
  'Triage',
  'Repair',
  'Swiftness',
  'Slow',
  'Inspire',
  'Focus',
  'Strengthen',
  'Protect',
  'Silence',
  'Demoralize',
  'Headwinds',
  'Forcefield',
  'Taunt',
  'Camouflage',
  'Painforge',
])

/** Cached per scope; catalogue additions change matchup estimates, not a percentile rank. */
const environmentCache = new WeakMap<
  AbilityContext,
  { speed: number; power: number; health: number; physical: number }
>()
function environment(ctx: AbilityContext) {
  let value = environmentCache.get(ctx)
  if (!value) {
    const units = ctx.pool.filter((c) => c.kind === 'unit')
    const attack = (c: CatalogueCard) =>
      ctx.stat(c, 'attack') + ctx.stat(c, 'ranged')
    const physical = units.reduce((s, c) => s + attack(c), 0)
    const magic = units.reduce((s, c) => s + ctx.stat(c, 'magic'), 0)
    value = {
      speed: mean(
        units.map((c) => ctx.stat(c, 'speed')),
        3,
      ),
      power: limit(
        mean(
          units
            .map((c) => Math.max(attack(c), ctx.stat(c, 'magic')))
            .filter((n) => n > 0),
          3,
        ),
        2,
        5,
      ),
      health: mean(
        units.map((c) => ctx.stat(c, 'health')),
        6,
      ),
      physical:
        physical + magic
          ? limit(physical / (physical + magic), 0.35, 0.8)
          : 0.65,
    }
    environmentCache.set(ctx, value)
  }
  return value
}

export function practicalUnit(
  card: CatalogueCard,
  league: League,
  profile: RatingProfile,
  ctx: AbilityContext,
): { parts: ScorePart[]; summary: PracticalSummary } {
  const own = ctx.names(card),
    stat = (s: Parameters<typeof ctx.stat>[1]) => ctx.stat(card, s)
  const mult = profile.leagueMultipliers[league],
    w = profile.statWeights
  const env = environment(ctx),
    mana = stat('mana'),
    health = stat('health')
  const allies = ctx.pool.filter(
    (c) => c.kind === 'unit' && c.id !== card.id && ctx.compatible(card, c),
  )
  const prior = (a: string) => abilityPrior(a, profile) / 10
  const baseAbility = (a: string) => {
    const info = profile.abilities[a.split(':')[0]],
      p = abilityPrior(a, profile)
    return (
      (info?.drawback ? -(10 - p) / 10 : p / 10) *
      1.3 *
      mult.abilities *
      (a.includes(':') ? abilityPrior(a.split(':')[1], profile) / 10 : 1)
    )
  }
  const parts = new Map<string, ScorePart>()
  const add = (label: string, value: number, note: string, weight: number) => {
    const part = parts.get(label) ?? { label, value: 0, note }
    part.value += value * weight
    parts.set(label, part)
  }
  const scenarios: PracticalScenario[] = []
  for (const scenario of SCENARIOS) {
    const basic = scenario.mode === 'basic',
      has = (a: string) => !basic && own.has(a)
    const reverse = scenario.mode === 'reverse',
      poison = scenario.mode === 'poison'
    const physical = scenario.mode === 'magic' ? 0.2 : env.physical
    const affordable = allies.filter(
      (c) =>
        mana + ctx.stat(c, 'mana') + 3 <= scenario.budget &&
        ctx.canField([card, c], scenario.budget),
    )
    const recipients = limit((scenario.budget - mana - 4) / 6, 0, 5)
    const ready = (ability: string) =>
      affordable.filter((c) => ctx.names(c).has(ability))
    const turnAvailability =
      has('Weary') && !ready('Invigorate').length && !has('Invigorate')
        ? 0.8
        : 1
    const attackTypes = ['attack', 'ranged', 'magic'] as const
    const native = attackTypes.map((s) => stat(s))
    const trainer =
      !native.some(Boolean) && !has('Untrainable') && !basic
        ? ready('Weapons Training').sort(
            (a, b) =>
              Math.max(
                ...attackTypes.map((s) => Math.min(3, ctx.stat(b, s)) * w[s]),
              ) -
              Math.max(
                ...attackTypes.map((s) => Math.min(3, ctx.stat(a, s)) * w[s]),
              ),
          )[0]
        : undefined
    const trained = trainer
      ? attackTypes.map((s) => Math.min(3, ctx.stat(trainer, s)) * 0.55)
      : [0, 0, 0]
    const attack = native.map((n, i) => n + trained[i])
    const reverseNote = reverse
      ? ' Speed direction reverses in Reverse Speed.'
      : ''
    const evasion =
      (has('Dodge') ? 0.25 * prior('Dodge') : 0) +
      (has('Flying') ? 0.15 * prior('Flying') : 0)
    const physicalHit = hitChance(env.speed, stat('speed'), evasion, reverse)
    const magicHit = has('Phase') ? 1 - (1 - physicalHit) * prior('Phase') : 1
    const reduction = (power: number, magic: boolean) => {
      const a = magic ? 'Void' : 'Shield'
      const reduced = power - (power - reducedDamage(power, has(a))) * prior(a)
      return has('Forcefield') && power >= 5
        ? reduced - (reduced - 1) * prior('Forcefield')
        : reduced
    }
    const physicalDamage =
      mean(
        [1, Math.round(env.power), 5].map((p) => reduction(p, false)),
        env.power,
      ) * physicalHit
    const magicDamage =
      mean(
        [1, Math.round(env.power), 5].map((p) => reduction(p, true)),
        env.power,
      ) * magicHit
    const incoming = physical * physicalDamage + (1 - physical) * magicDamage
    // Armor grants at least one physical hit; overflow is lost without Piercing.
    const armor = stat('armor')
    const armorHealth =
      armor > 0
        ? (armor + Math.max(0, env.power - 1) * 0.65) *
          (has('Void Armor') ? 1 : physical)
        : 0
    const baseIncoming = mean([1, Math.round(env.power), 5], 3)
    const mitigation = limit(baseIncoming / Math.max(0.7, incoming), 0.7, 2.8)
    const passiveDamage = poison && !has('Immunity') ? 2 : 0
    const heal = has('Heal')
      ? healingAmount(health) *
        prior('Heal') *
        0.65 *
        turnAvailability *
        (has('Echo') ? 1.5 : 1)
      : 0
    const repair =
      has('Repair') && armor
        ? 2 * physical * prior('Repair') * 0.5 * turnAvailability
        : 0
    const effectiveHealth = (health + armorHealth + heal + repair) * mitigation
    const meleeAccess =
      scenario.mode === 'melee' ||
      has('Sneak') ||
      has('Opportunity') ||
      has('Charge')
    const flank = !basic && ready('Flank').length > 0
    const closeRangeGrant =
      !basic &&
      ctx.pool.some(
        (c) =>
          c.kind === 'summoner' &&
          ctx.names(c).has('Close Range') &&
          ctx.canField([card, c], scenario.budget),
      )
    const positions = [
      'Frontline',
      'Backline',
      ...(has('Reach') || flank ? ['Second position'] : []),
    ]
    const candidates = positions.map((role) => {
      const front = role === 'Frontline'
      const exposure =
        front || has('Taunt') ? 1 : has('Camouflage') ? 0.25 : 0.5
      const turns = limit(
        (health + armorHealth) /
          Math.max(
            1,
            (incoming * 1.5 - heal - repair) * exposure + passiveDamage,
          ),
        0.5,
        3,
      )
      const uptime = 0.55 + 0.15 * turns
      const melee =
        front || meleeAccess
          ? 1
          : role === 'Second position'
            ? has('Reach')
              ? 1
              : 0.55
            : 0.1
      const ranged =
        front && !has('Close Range') && scenario.mode !== 'ranged'
          ? closeRangeGrant
            ? 0.45
            : 0
          : 1
      const naturalAccuracy = hitChance(stat('speed'), env.speed, 0, reverse)
      const accuracy = has('True Strike')
        ? naturalAccuracy + (1 - naturalAccuracy) * prior('True Strike')
        : naturalAccuracy
      const magicAccuracy = 0.95 // Small allowance for Phase opponents; not a measured frequency.
      const armorFactor =
        scenario.mode === 'armor' && !has('Piercing')
          ? has('Shatter')
            ? 0.95
            : 0.8
          : 1
      const power =
        attack[0] * w.attack * melee * accuracy * armorFactor +
        attack[1] * w.ranged * ranged * accuracy * armorFactor +
        attack[2] * w.magic * magicAccuracy
      const extra =
        (has('Double Strike') ? power * prior('Double Strike') : 0) +
        (has('Armored Strike')
          ? armor * w.attack * melee * accuracy * 0.7 * prior('Armored Strike')
          : 0)
      const exhaustion = turnAvailability
      const recharge = has('Recharge') ? 1.1 : 1 // Delayed burst, not an unconditional 3x.
      const offense = (power + extra) * uptime * exhaustion * recharge
      const durability =
        (health * w.health + armorHealth * w.armor) *
        mitigation *
        (front || has('Taunt') ? 1 : 0.85)
      return {
        role,
        turns,
        power,
        extra,
        offense,
        durability,
        melee,
        ranged,
        accuracy,
      }
    })
    const best = candidates.sort(
      (a, b) => b.offense + b.durability - (a.offense + a.durability),
    )[0]
    const components: { label: string; value: number; note: string }[] = []
    const put = (label: string, value: number, note: string) =>
      components.push({ label, value, note })
    const costFactor =
      scenario.budget === 22 ? 1.15 : scenario.budget === 50 ? 0.75 : 1
    put(
      'Mana and team space',
      mana * w.mana * mult.mana * costFactor,
      'Mana opportunity cost averaged across 22, 32 and 50 mana situations; enabling partners must fit the budget.',
    )
    put(
      'Usable attack output',
      best.offense * mult.stats,
      'Position-legal attacks, accuracy, expected survival, Double Strike, remaining-armor attacks and turn loss. Training, Flank and archon Close Range access are discounted for partner and positioning requirements; they are possible alternatives, not guaranteed buffs.',
    )
    put(
      'Effective durability',
      (best.durability + stat('speed') * w.speed * (reverse ? 0.25 : 0.7)) *
        mult.stats,
      'Health and armor against physical and magic pressure, armor overflow, evasion and damage-reduction breakpoints. Healing extends useful turns.' +
        reverseNote,
    )
    for (const fullAbility of abilitiesAt(card, levelForLeague(card, league))) {
      const ability = fullAbility.split(':')[0]
      let factor = basic ? 0 : 1
      if (!basic) {
        if (
          [
            'Double Strike',
            'Armored Strike',
            'Recharge',
            'Weary',
            'Dodge',
            'Phase',
            'Void',
            'Shield',
            'Void Armor',
            'Forcefield',
            'True Strike',
            'Reach',
            'Close Range',
            'Charge',
          ].includes(ability)
        )
          factor = 0 // already in output/durability
        if (ability === 'Flying') factor = 0.35 // Earthquake and access flexibility beyond evasion
        if (ability === 'Heal')
          factor =
            limit(healingAmount(health) / 3, 0.65, 1.7) *
            (has('Echo') ? 1.4 : 1)
        if (ability === 'Repair')
          factor = limit(
            (armor ? 0.75 : 0.25) +
              affordable.filter((c) => ctx.stat(c, 'armor') > 0).length * 0.06,
            0.25,
            1.3,
          )
        if (ability === 'Weapons Training') {
          const trainees = affordable.filter(
            (c) =>
              !attackTypes.some((s) => ctx.stat(c, s) > 0) &&
              !ctx.names(c).has('Untrainable'),
          )
          const count = ctx.selectPartners(
            card,
            trainees.sort((a, b) => ctx.stat(a, 'mana') - ctx.stat(b, 'mana')),
            2,
            scenario.budget,
          ).length
          factor = ((count * Math.min(3, Math.max(...native))) / 3) * 0.9
        }
        if (ability === 'Bloodlust')
          factor = limit(
            (best.offense / 3.5) * (0.6 + best.turns * 0.15),
            0.1,
            1.6,
          )
        if (ability === 'Blast')
          factor = limit(
            (best.offense / 3) *
              (has('Scattershot') || has('Snipe') ? 1.25 : 1),
            0.15,
            1.7,
          )
        if (ability === 'Backfire')
          factor = limit((1 - physicalHit) * 3, 0.1, 1.5)
        if (ability === 'Taunt') factor = limit(effectiveHealth / 12, 0.4, 1.6)
        if (ability === 'Camouflage')
          factor = best.role === 'Frontline' ? 0.25 : 1.15
        if (['Tank Heal', 'Triage'].includes(ability))
          factor = limit(recipients / 2, 0.3, 1.8) * (has('Echo') ? 1.5 : 1)
        if (['Inspire', 'Focus'].includes(ability))
          factor =
            Math.min(
              recipients,
              affordable.filter(
                (c) =>
                  ctx.stat(c, ability === 'Inspire' ? 'attack' : 'ranged') > 0,
              ).length,
            ) / 2
        if (
          [
            'Strengthen',
            'Protect',
            'Swiftness',
            'Slow',
            'Demoralize',
            'Headwinds',
            'Silence',
          ].includes(ability)
        ) {
          factor = limit(recipients / 2, 0.3, 2)
          if (reverse && ['Swiftness', 'Slow'].includes(ability)) factor *= -1
          if (ability === 'Silence') factor *= (1 - physical) / 0.35
          if (['Demoralize', 'Headwinds'].includes(ability))
            factor *= physical / 0.65
        }
        if (ability === 'Painforge')
          factor =
            poison && !has('Immunity') ? limit(best.turns / 2, 0.3, 1.5) : 0.35 // partners credited separately
        if (ability === 'Martyr')
          factor =
            Math.min(2, recipients) *
            (has('Rebirth') ? 1.6 : 1) *
            (mana <= 4 ? 1 : 0.6)
        if (ability === 'Volley of Arrows')
          factor =
            Math.min(
              3,
              recipients,
              affordable.filter((c) => ctx.stat(c, 'ranged') > 0).length,
            ) * 0.9
        if (ability === 'Shapeshift') factor = 0.35 // available grants credited separately
        if (ability === 'Bloodline Tribute') factor = 0.35 // beneficiaries credited separately
        if (ability === 'Final Rest') factor = 0.65 // one enemy resurrection block; no blanket death suppression
        if (ability === 'Kindred Spirit')
          factor = ready('Kindred Will').length ? 0.65 : 0
        if (ability === 'Kindred Will')
          factor = ready('Kindred Spirit').length ? 0.65 : 0
        if (ability === 'Invigorate') factor = ready('Weary').length ? 1.2 : 0.2
        if (ability === 'Force Reduction') factor = recipients >= 4 ? 1.3 : 0.35
        if (
          ['Electrified', 'Incendiary', 'Reckless', 'Stray Shot'].includes(
            ability,
          )
        )
          factor = limit((recipients + 1) / 4, 0.5, 1.4)
      }
      if (['Heal', 'Repair', 'Tank Heal', 'Triage'].includes(ability))
        factor *= turnAvailability
      put(
        fullAbility,
        baseAbility(fullAbility) * factor,
        factor === 0 && !basic
          ? 'Included in attack output or durability; no duplicate bonus.'
          : 'Scaled to role, recipients and triggers; inactive in Back to Basics.',
      )
    }
    if (mana < 6)
      put(
        'Mana efficiency',
        (6 - mana) * 0.18,
        'Low-cost cards leave room for damage dealers and support; this allowance declines to zero at six mana.',
      )
    if (mana <= 1)
      put(
        'Low-mana flexibility',
        mana === 0 ? 1.5 : 0.6,
        'Cheap bodies can fill remaining mana and absorb an attack; still occupy a team slot.',
      )
    for (const c of components) add(c.label, c.value, c.note, scenario.weight)
    scenarios.push({
      name: scenario.name,
      weight: scenario.weight,
      value: components.reduce((s, c) => s + c.value, 0),
      role: best.role,
    })
  }
  const roles = new Map<string, number>()
  for (const s of scenarios)
    roles.set(s.role, (roles.get(s.role) ?? 0) + s.weight)
  return {
    parts: Array.from(parts.values()),
    summary: {
      role: Array.from(roles).sort((a, b) => b[1] - a[1])[0][0],
      scenarios,
    },
  }
}
