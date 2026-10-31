import { abilityNames } from '../splinterlands/abilities'
import { STAT_LABELS } from '../splinterlands/catalogue'
import { LEAGUES, type RatingProfile } from './types'

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const number = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
const note = (v: unknown) =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 1500
const known = new Set(abilityNames)
const stats = new Set(Object.keys(STAT_LABELS))

export function validateProfile(
  value: unknown,
  cardIds?: Set<number>,
): string | null {
  if (!object(value) || value.schemaVersion !== 1)
    return 'Unsupported rating profile.'
  if (!number(value.standardWeight, 0, 1))
    return 'Standard ruleset weight must be between 0 and 1.'
  if (
    value.summonerWeights !== undefined &&
    (!object(value.summonerWeights) ||
      ['attack', 'ranged', 'magic', 'speed', 'armor', 'health'].some(
        (key) =>
          !number(
            (value.summonerWeights as Record<string, unknown>)[key],
            0,
            3,
          ),
      ))
  )
    return 'Summoner effect weights must be between 0 and 3.'
  if (
    value.summonerAbilityFactor !== undefined &&
    !number(value.summonerAbilityFactor, 0.5, 6)
  )
    return 'Summoner ability factor must be between 0.5 and 6.'
  if (
    value.summonerCalibration !== undefined &&
    !number(value.summonerCalibration, 0, 8)
  )
    return 'Summoner calibration must be between 0 and 8.'
  if (
    !object(value.statWeights) ||
    Object.keys(STAT_LABELS).some(
      (stat) =>
        !number(
          (value.statWeights as Record<string, unknown>)[stat],
          stat === 'mana' ? -3 : 0,
          stat === 'mana' ? 0 : 3,
        ),
    )
  )
    return 'Stat weights are missing or outside their allowed ranges.'
  if (
    !object(value.leagueMultipliers) ||
    LEAGUES.some((league) => {
      const v = (value.leagueMultipliers as Record<string, unknown>)[league]
      return (
        !object(v) ||
        ['stats', 'mana', 'abilities'].some((key) => !number(v[key], 0.25, 3))
      )
    })
  )
    return 'Each league needs valid stat, mana and ability multipliers.'
  if (
    !object(value.abilities) ||
    Object.keys(value.abilities).length > 250 ||
    abilityNames.some(
      (name) => !value.abilities || !(name in (value.abilities as object)),
    )
  )
    return 'Every current ability needs a curated weight.'
  for (const [name, weight] of Object.entries(value.abilities)) {
    if (
      !known.has(name) ||
      !object(weight) ||
      !number(weight.standard, 0, 10) ||
      !number(weight.nonStandard, 0, 10) ||
      !number(weight.multiplier, 0.25, 3) ||
      typeof weight.drawback !== 'boolean' ||
      !note(weight.notes)
    )
      return `Invalid ability weight or explanation: ${name}.`
  }
  if (!Array.isArray(value.synergies) || value.synergies.length > 500)
    return 'At most 500 ability synergies are allowed.'
  const seen = new Set<string>()
  for (const rule of value.synergies) {
    if (
      !object(rule) ||
      !Array.isArray(rule.abilities) ||
      rule.abilities.length !== 2 ||
      rule.abilities.some(
        (name) => typeof name !== 'string' || !known.has(name),
      ) ||
      rule.abilities[0] === rule.abilities[1] ||
      ![-1, 1, 2, 3].includes(rule.strength as number) ||
      !note(rule.notes)
    )
      return 'Each synergy needs two distinct known abilities, a strength and an explanation.'
    const key = [...rule.abilities].sort().join(':')
    if (seen.has(key)) return `Duplicate synergy: ${key}.`
    seen.add(key)
  }
  if (!Array.isArray(value.statSynergies) || value.statSynergies.length > 300)
    return 'At most 300 stat synergies are allowed.'
  for (const rule of value.statSynergies)
    if (
      !object(rule) ||
      typeof rule.ability !== 'string' ||
      !known.has(rule.ability) ||
      typeof rule.stat !== 'string' ||
      !stats.has(rule.stat) ||
      !number(rule.minimum, 0, 100) ||
      !number(rule.bonus, -2, 2) ||
      !note(rule.notes)
    )
      return 'Invalid stat synergy or explanation.'
  if (!Array.isArray(value.adjustments) || value.adjustments.length > 1000)
    return 'At most 1,000 card adjustments are allowed.'
  const adjustments = new Set<string>()
  for (const rule of value.adjustments) {
    if (
      !object(rule) ||
      !Number.isSafeInteger(rule.cardId) ||
      (cardIds && !cardIds.has(rule.cardId as number)) ||
      !['all', ...LEAGUES].includes(rule.league as 'all') ||
      !['all', 'modern', 'wild'].includes(rule.format as string) ||
      !number(rule.delta, -2, 2) ||
      !note(rule.notes)
    )
      return 'Each adjustment needs a valid combat card, scope, a delta between -2 and +2, and an explanation.'
    const key = `${rule.cardId}:${rule.league}:${rule.format}`
    if (adjustments.has(key)) return 'Duplicate card adjustment scope.'
    adjustments.add(key)
  }
  // Overlapping wildcard adjustments could evade the intended +/-2 guardrail.
  for (const id of Array.from(
    new Set(value.adjustments.map((rule) => rule.cardId)),
  ))
    for (const league of LEAGUES)
      for (const format of ['modern', 'wild']) {
        const delta = value.adjustments
          .filter(
            (rule) =>
              rule.cardId === id &&
              (rule.league === 'all' || rule.league === league) &&
              (rule.format === 'all' || rule.format === format),
          )
          .reduce((sum, rule) => sum + rule.delta, 0)
        if (Math.abs(delta) > 2)
          return `Combined adjustments for card ${id} exceed the +/-2 point limit.`
      }
  return null
}
export function checkedProfile(
  value: unknown,
  cardIds?: Set<number>,
): RatingProfile {
  const error = validateProfile(value, cardIds)
  if (error) throw new Error(error)
  return value as RatingProfile
}
