import { teamEngineParts } from './team-engines'
import {
  abilitiesAt,
  levelForLeague,
  statAt,
  type CatalogueCard,
  type StatKey,
} from '../splinterlands/catalogue'
import {
  SUMMONER_WEIGHTS,
  EMPTY_EVIDENCE,
  LEAGUES,
  type AbilityRating,
  type BattleFormat,
  type CardRating,
  type Evidence,
  type League,
  type Rating,
  type RatingProfile,
  type ScorePart,
} from './types'

export const clamp = (value: number, min = 0, max = 10) =>
  Math.max(min, Math.min(max, value))
const round = (value: number) => Math.round(value * 1000) / 1000
export const baseAbility = (name: string) => name.split(':')[0]

export function abilityPrior(name: string, profile: RatingProfile): number {
  const weight = profile.abilities[baseAbility(name)]
  if (!weight) return 5
  return clamp(
    (weight.standard * profile.standardWeight +
      weight.nonStandard * (1 - profile.standardWeight)) *
      weight.multiplier,
  )
}

/** Shrink noisy observational evidence toward the curated prior. No evidence is not a zero rating. */
export function blendRating(
  curated: number,
  evidence: Evidence = EMPTY_EVIDENCE,
  model: 'card' | 'ability' = 'ability',
): Rating {
  curated = round(clamp(curated))
  const card = model === 'card'
  const usable =
    evidence.battles >= (card ? 20 : 30) &&
    evidence.players >= 5 &&
    evidence.effective >= (card ? 15 : 20)
  const reliability =
    (evidence.effective / (evidence.effective + (card ? 75 : 150))) *
    Math.min(1, evidence.players / (card ? 15 : 20)) *
    Math.min(1, evidence.days / (card ? 3 : 7))
  const battleWeight = usable ? (card ? 0.8 : 0.65) * reliability : 0
  // The 0–10 strength scale is not a win-probability scale. Center evidence on
  // the curated prior: expected results preserve it; +/-5 percentage points
  // of player-adjusted performance imply +/-1 potential rating point.
  const battleScore = evidence.battles
    ? clamp(curated + (evidence.adjustedWinRate - 0.5) * 20)
    : null
  const usage = card ? evidence.usage : undefined
  const usageUsable =
    !!usage &&
    usage.battles >= 20 &&
    usage.players >= 5 &&
    usage.effective >= 15 &&
    usage.totalEffective >= 50
  const usageWeight = usageUsable
    ? (usage.totalEffective / (usage.totalEffective + 100)) *
      (usage.effective / (usage.effective + 30)) *
      Math.min(1, usage.players / 15) *
      Math.min(1, usage.days / 3)
    : 0
  // Popularity is a limited utility signal, never a penalty for an unseen card.
  // A card in 20% of sampled matches reaches the one-point pre-confidence cap.
  const usageAdjustment = round(
    usageWeight * Math.min(1, (usage?.weightedRate ?? 0) / 0.2),
  )
  const winRateAdjustment = round(
    ((battleScore ?? curated) - curated) * battleWeight,
  )
  const unbounded = curated + winRateAdjustment + usageAdjustment
  const score = round(clamp(unbounded))
  const confidence = !usable
    ? usageUsable
      ? 'early'
      : 'curated'
    : evidence.effective >= 500 && evidence.players >= 30 && evidence.days >= 14
      ? 'strong'
      : evidence.effective >= 150 &&
          evidence.players >= 15 &&
          evidence.days >= 7
        ? 'moderate'
        : 'early'
  return {
    score,
    curated,
    battleScore: battleScore === null ? null : round(battleScore),
    battleWeight: round(battleWeight),
    usageWeight: round(usageWeight),
    winRateAdjustment,
    usageAdjustment,
    boundsAdjustment: round(score - unbounded),
    confidence,
    evidence,
  }
}

export function curatedCard(
  card: CatalogueCard,
  league: League,
  format: BattleFormat,
  profile: RatingProfile,
  catalogue: CatalogueCard[] = [],
): { score: number; parts: ScorePart[]; level: number } | null {
  if (card.kind === 'land' || (format === 'modern' && !card.modern)) return null
  const level = levelForLeague(card, league)
  const abilities = abilitiesAt(card, level)
  const names = new Set(abilities.map(baseAbility))
  const mult = profile.leagueMultipliers[league]
  const get = (stat: StatKey) => statAt(card, stat, level) ?? 0
  const parts: ScorePart[] = [{ label: 'Baseline', value: 1.6 }]
  const mana = get('mana')
  parts.push({
    label: 'Mana cost',
    value: mana * profile.statWeights.mana * mult.mana,
    note: `${mana} mana`,
  })
  if (card.kind === 'summoner') {
    // Summoner values affect a team. Signed enemy debuffs and ally buffs both have value;
    // unlike unit stats, negative stat effects must not be scored as bad self-stats.
    const effects = (
      ['attack', 'ranged', 'magic', 'speed', 'armor', 'health'] as StatKey[]
    ).reduce(
      (sum, stat) =>
        sum +
        Math.abs(get(stat)) *
          (profile.summonerWeights ?? SUMMONER_WEIGHTS)[
            stat as keyof typeof SUMMONER_WEIGHTS
          ] *
          mult.stats *
          2,
      0,
    )
    parts.push({ label: 'Team stat effects', value: effects })
  } else {
    const offense = (['attack', 'ranged', 'magic'] as StatKey[]).reduce(
      (sum, stat) => sum + get(stat) * profile.statWeights[stat] * mult.stats,
      0,
    )
    const defense = (['speed', 'armor', 'health'] as StatKey[]).reduce(
      (sum, stat) => sum + get(stat) * profile.statWeights[stat] * mult.stats,
      0,
    )
    parts.push(
      { label: 'Attack stats', value: offense },
      { label: 'Speed and durability', value: defense },
    )
    const attackTypes = ['attack', 'ranged', 'magic'].filter(
      (stat) => get(stat as StatKey) > 0,
    ).length
    if (attackTypes > 1)
      parts.push({
        label: 'Multiple attack types',
        value: 0.45,
        note: 'Extra flexibility beyond the individual attack values.',
      })
    if (!attackTypes && !names.has('Untrainable'))
      parts.push({
        label: 'No-attack utility',
        value: 0.65,
        note: 'Potential Weapons Training recipient; value depends on team composition.',
      })
    if (mana <= 1)
      parts.push({
        label: 'Low-mana flexibility',
        value: mana === 0 ? 1.5 : 0.6,
      })
  }
  const abilityValue = (name: string) => {
    const info = profile.abilities[baseAbility(name)]
    const prior = abilityPrior(name, profile)
    let value = info?.drawback ? -(10 - prior) / 10 : prior / 10
    // Linked Kindred/Bloodline grants depend on both the gate and the linked effect.
    const linked = name.split(':')[1]
    if (linked && !info?.drawback) value *= abilityPrior(linked, profile) / 10
    return (
      value *
      (card.kind === 'summoner' ? (profile.summonerAbilityFactor ?? 4) : 1.3) *
      mult.abilities
    )
  }
  for (const name of abilities)
    parts.push({
      label: name,
      value: abilityValue(name),
      note:
        profile.abilities[baseAbility(name)]?.notes ??
        'Unreviewed ability: neutral prior, pending curation.',
    })
  if (card.kind === 'summoner') {
    const tactics = card.stats.ptrOptions ?? []
    // Tactics are alternatives. Count the best option, never every option together.
    const values = tactics.map(
      (tactic) =>
        (tactic.abilities ?? []).reduce(
          (sum, name) => sum + Math.max(0, abilityValue(name)),
          0,
        ) *
          Math.min(1, tactic.max / 3) +
        (tactic.stat_buff ?? []).reduce(
          (sum, value) => sum + Math.abs(value) * 0.18,
          0,
        ),
    )
    if (values.length)
      parts.push({
        label: 'Tactical choice',
        value: Math.min(3, Math.max(...values)),
        note: 'Values the strongest available option, scaled by recipient count; alternatives are not added together.',
      })
    const bloodlines = card.stats.racialSynergy ?? []
    if (bloodlines.length)
      parts.push({
        label: 'Bloodline grants',
        value: Math.min(
          1.5,
          Math.max(
            ...bloodlines.map((s) =>
              (s.abilities ?? []).reduce(
                (sum, name) => sum + Math.max(0, abilityValue(name)),
                0,
              ),
            ),
          ) * 0.5,
        ),
        note: 'Conditional team benefit, discounted for the bloodline restriction.',
      })
  }
  const pairPoints = { '-1': -0.5, '1': 0.15, '2': 0.35, '3': 0.65 }
  let synergy = 0
  for (const rule of profile.synergies)
    if (rule.abilities.every((name) => names.has(name))) {
      const bonus = pairPoints[String(rule.strength) as keyof typeof pairPoints]
      synergy += bonus
      parts.push({
        label: `${rule.abilities[0]} + ${rule.abilities[1]}`,
        value: bonus,
        note: rule.notes,
      })
    }
  // Avoid an explosive score from many overlapping pair rules.
  if (synergy > 2)
    parts.push({ label: 'Synergy overlap adjustment', value: 2 - synergy })
  let statSynergy = 0
  for (const rule of profile.statSynergies)
    if (names.has(rule.ability) && get(rule.stat) >= rule.minimum) {
      statSynergy += rule.bonus
      parts.push({
        label: `${rule.ability} × ${rule.stat}`,
        value: rule.bonus,
        note: rule.notes,
      })
    }
  if (statSynergy > 2)
    parts.push({
      label: 'Stat synergy overlap adjustment',
      value: 2 - statSynergy,
    })
  if (card.splinters.includes('Neutral'))
    parts.push({
      label: 'Neutral flexibility',
      value: 0.5,
      note: 'Playable with any active splinter.',
    })
  else if (card.splinters.length > 1)
    parts.push({ label: 'Dual-splinter flexibility', value: 0.25 })
  parts.push(...teamEngineParts(card, league, format, catalogue, profile))
  const raw = parts.reduce((sum, part) => sum + part.value, 0)
  // Fixed smooth calibration: stable when a new card is added, and no artificial
  // requirement that the strongest card in a pool must be a perfect 10.
  const center =
    card.kind === 'summoner' ? (profile.summonerCalibration ?? 2.5) : 5
  let score = 10 / (1 + Math.exp(-(raw - center) / 2))
  for (const adjustment of profile.adjustments)
    if (
      adjustment.cardId === card.id &&
      (adjustment.league === 'all' || adjustment.league === league) &&
      (adjustment.format === 'all' || adjustment.format === format)
    ) {
      score += adjustment.delta
      parts.push({
        label: 'Curator adjustment (rating points)',
        value: adjustment.delta,
        note: adjustment.notes,
      })
    }
  return {
    score: clamp(score),
    level,
    parts: parts.map((p) => ({ ...p, value: round(p.value) })),
  }
}

export function rateCard(
  card: CatalogueCard,
  league: League,
  format: BattleFormat,
  profile: RatingProfile,
  evidence?: Evidence,
  catalogue: CatalogueCard[] = [],
): CardRating | null {
  const prior = curatedCard(card, league, format, profile, catalogue)
  return prior
    ? {
        cardId: card.id,
        league,
        format,
        level: prior.level,
        parts: prior.parts,
        ...blendRating(prior.score, evidence, 'card'),
      }
    : null
}
export function rateAbility(
  name: string,
  league: League,
  format: BattleFormat,
  profile: RatingProfile,
  evidence?: Evidence,
): AbilityRating {
  return {
    name,
    league,
    format,
    ...blendRating(
      clamp(
        5 +
          (abilityPrior(name, profile) - 5) *
            profile.leagueMultipliers[league].abilities,
      ),
      evidence,
    ),
  }
}
export function ratingKey(
  id: number | string,
  league: League,
  format: BattleFormat,
) {
  return `${id}:${league}:${format}`
}
export function allRatings(
  cards: CatalogueCard[],
  profile: RatingProfile,
  evidence: Record<string, Evidence> = {},
) {
  const cardRatings: CardRating[] = [],
    abilityRatings: AbilityRating[] = []
  for (const format of ['modern', 'wild'] as const)
    for (const league of LEAGUES) {
      for (const card of cards) {
        const rating = rateCard(
          card,
          league,
          format,
          profile,
          evidence[`card:${ratingKey(card.id, league, format)}`],
          cards,
        )
        if (rating) cardRatings.push(rating)
      }
      for (const name of Object.keys(profile.abilities))
        abilityRatings.push(
          rateAbility(
            name,
            league,
            format,
            profile,
            evidence[`ability:${ratingKey(name, league, format)}`],
          ),
        )
    }
  return { cards: cardRatings, abilities: abilityRatings }
}
