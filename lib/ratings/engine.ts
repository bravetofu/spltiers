import { abilityPrior, baseAbility } from './ability-priors'
export { abilityPrior, baseAbility } from './ability-priors'
import {
  abilityContext,
  contextualAbilityParts,
  type AbilityContext,
} from './ability-context'
import { teamEngineParts } from './team-engines'
import {
  practicalUnit,
  PRACTICAL_ABILITIES,
  type PracticalSummary,
} from './practical-value'
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
    evidence.effective >= (card ? 15 : 20) &&
    evidence.days >= 2
  const reliability =
    (evidence.effective / (evidence.effective + (card ? 75 : 150))) *
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
    usage.effective >= 15 &&
    usage.totalEffective >= 50 &&
    usage.days >= 2
  const usageWeight = usageUsable
    ? (usage.totalEffective / (usage.totalEffective + 100)) *
      (usage.effective / (usage.effective + 30)) *
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
    : evidence.effective >= 500 && evidence.days >= 14
      ? 'strong'
      : evidence.effective >= 150 && evidence.days >= 7
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
  context?: AbilityContext,
): {
  score: number
  parts: ScorePart[]
  level: number
  practical?: PracticalSummary
} | null {
  if (card.kind === 'land' || (format === 'modern' && !card.modern)) return null
  const level = levelForLeague(card, league)
  const abilities = abilitiesAt(card, level)
  const names = new Set(abilities.map(baseAbility))
  const mult = profile.leagueMultipliers[league]
  const get = (stat: StatKey) => statAt(card, stat, level) ?? 0
  const parts: ScorePart[] = [{ label: 'Baseline', value: 1.6 }]
  const teamContext = context ?? abilityContext(catalogue, league, format)
  let practical: PracticalSummary | undefined
  const mana = get('mana')
  if (card.kind === 'summoner')
    parts.push({
      label: 'Mana cost',
      value: mana * profile.statWeights.mana * mult.mana,
      note: `${mana} mana`,
    })
  if (card.kind === 'summoner') {
    // Summoner values affect a team. Signed enemy debuffs and ally buffs both have value;
    // unlike unit stats, negative stat effects must not be scored as bad self-stats.
    parts.push({
      label: 'Team access',
      value:
        1.5 +
        (card.splinters.length > 1
          ? 1.5
          : card.splinters.includes('Dragon')
            ? 0.6
            : 0),
      note: 'Access to a playable team has value even without buffs; dual-element and Dragon archons widen legal choices. Mana is charged separately.',
    })
    const legalUnits = teamContext.pool.filter(
      (c) => c.kind === 'unit' && teamContext.compatible(card, c),
    )
    const teamSize = Math.max(1, Math.min(5, (32 - mana) / 6))
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
          (['attack', 'ranged', 'magic'].includes(stat) && get(stat) > 0
            ? Math.min(
                teamSize,
                legalUnits.filter((c) => teamContext.stat(c, stat) > 0).length,
              ) / 2
            : teamSize / 2),
      0,
    )
    parts.push({
      label: 'Team stat effects',
      value: 4 * Math.log1p(effects / 4),
      note: 'Team buffs and enemy debuffs with diminishing returns; several stat effects are not independent full-team advantages.',
    })
  } else {
    const evaluated = practicalUnit(card, league, profile, teamContext)
    parts.push(...evaluated.parts)
    practical = evaluated.summary
  }
  const legalUnits =
    card.kind === 'summoner'
      ? teamContext.pool.filter(
          (c) => c.kind === 'unit' && teamContext.compatible(card, c),
        )
      : []
  const grantFactor = (name: string) => {
    const base = baseAbility(name)
    if (base === 'Close Range')
      return Math.min(
        1,
        legalUnits.filter((c) => teamContext.stat(c, 'ranged') > 0).length / 3,
      )
    if (base === 'Bloodline Dominion') {
      const choices = legalUnits.filter(
        (c) =>
          card.stats.racialSynergy?.some((s) => s.race === c.bloodline) ||
          teamContext.names(c).has('Shapeshift'),
      ).length
      return Math.min(0.9, (Math.log1p(choices) / Math.log(30)) * 0.7)
    }
    if (base === 'Final Rest') return 0.65
    if (base === 'Last Stand') return 0.45
    if (base === 'Enrage') return 0.7
    return 1
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
      mult.abilities *
      (card.kind === 'summoner' ? grantFactor(name) : 1)
    )
  }
  for (const name of card.kind === 'summoner' ? abilities : [])
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
          (sum, value) =>
            sum + Math.abs(value) * 0.35 * Math.min(3, tactic.max),
          0,
        ),
    )
    if (values.length)
      parts.push({
        label: 'Tactical choice',
        value: Math.min(3, Math.max(...values)),
        note: 'Best alternative, scaled by the number of recipients and effect size. A flexible tactical choice is not several simultaneous buffs.',
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
    if (
      rule.abilities.every((name) => names.has(name)) &&
      !(
        card.kind === 'unit' &&
        rule.abilities.every((name) => PRACTICAL_ABILITIES.has(name))
      )
    ) {
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
    if (
      names.has(rule.ability) &&
      get(rule.stat) >= rule.minimum &&
      !(card.kind === 'unit' && PRACTICAL_ABILITIES.has(rule.ability))
    ) {
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
  parts.push(
    ...contextualAbilityParts(card, league, profile, teamContext).filter(
      (p) => p.label !== 'Bloodlust trigger potential',
    ),
  )
  parts.push(
    ...teamEngineParts(
      card,
      league,
      format,
      catalogue,
      profile,
      teamContext,
    ).map((p) => ({
      ...p,
      value: p.value * (card.kind === 'unit' ? 0.95 : 1),
    })),
  )
  const raw = parts.reduce((sum, part) => sum + part.value, 0)
  // Fixed smooth calibration: stable when a new card is added, and no artificial
  // requirement that the strongest card in a pool must be a perfect 10.
  const center =
    card.kind === 'summoner' ? (profile.summonerCalibration ?? 2.5) : 4
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
    practical: practical
      ? {
          ...practical,
          scenarios: practical.scenarios.map((s) => ({
            ...s,
            value: round(s.value),
          })),
        }
      : undefined,
  }
}

export function rateCard(
  card: CatalogueCard,
  league: League,
  format: BattleFormat,
  profile: RatingProfile,
  evidence?: Evidence,
  catalogue: CatalogueCard[] = [],
  context?: AbilityContext,
): CardRating | null {
  const prior = curatedCard(card, league, format, profile, catalogue, context)
  return prior
    ? {
        cardId: card.id,
        league,
        format,
        level: prior.level,
        parts: prior.parts,
        practical: prior.practical,
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
      const context = abilityContext(cards, league, format)
      for (const card of cards) {
        const rating = rateCard(
          card,
          league,
          format,
          profile,
          evidence[`card:${ratingKey(card.id, league, format)}`],
          cards,
          context,
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
