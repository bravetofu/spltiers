import { abilityContext, type AbilityContext } from './ability-context'
import { abilityPrior } from './ability-priors'
import {
  levelForLeague,
  statAt,
  type CatalogueCard,
} from '../splinterlands/catalogue'
import type { BattleFormat, League, RatingProfile, ScorePart } from './types'

// Contextual team-building priors, not measured marginal win contributions.
export function teamEngineParts(
  card: CatalogueCard,
  league: League,
  format: BattleFormat,
  catalogue: CatalogueCard[],
  profile: RatingProfile,
  context?: AbilityContext,
): ScorePart[] {
  const { pool, names, compatible } =
    context ?? abilityContext(catalogue, league, format)
  const own = names(card)
  if (!own.has('Bloodline Tribute') && !own.has('Bloodline Dominion')) return []
  const parts: ScorePart[] = []
  const externalReviver = (unit: CatalogueCard) =>
    pool.find(
      (c) =>
        c.id !== unit.id && compatible(unit, c) && names(c).has('Resurrect'),
    )
  const tributeValue = (unit: CatalogueCard, broaden: boolean) => {
    const abilities = names(unit),
      level = levelForLeague(unit, league)
    if (!abilities.has('Bloodline Tribute')) return 0
    const recipients = pool.filter(
      (c) =>
        c.kind === 'unit' &&
        c.id !== unit.id &&
        (broaden || compatible(unit, c)) &&
        (c.bloodline === unit.bloodline ||
          abilities.has('Shapeshift') ||
          names(c).has('Shapeshift')),
    )
    // Model three beneficiaries, not an automatic perfect five-unit bloodline team.
    const count = Math.min(3, recipients.length)
    const offense = recipients.length
      ? recipients.reduce(
          (sum, recipient) =>
            sum +
            (['attack', 'ranged', 'magic'] as const).reduce(
              (total, s) =>
                total +
                ((statAt(unit, s, level) ?? 0) > 0 &&
                (statAt(recipient, s, levelForLeague(recipient, league)) ?? 0) >
                  0
                  ? profile.statWeights[s]
                  : 0),
              0,
            ),
          0,
        ) / recipients.length
      : 0
    const statGain =
      offense +
      profile.statWeights.speed +
      profile.statWeights.armor +
      profile.statWeights.health
    const triggers =
      1 + (abilities.has('Rebirth') ? 1 : 0) + (externalReviver(unit) ? 0.5 : 0)
    const reliability = abilities.has('Taunt') ? 0.9 : 0.55
    const affordability = Math.min(
      1.5,
      6 / (3 + (statAt(unit, 'mana', level) ?? 0)),
    )
    return (
      count *
      statGain *
      triggers *
      reliability *
      affordability *
      profile.leagueMultipliers[league].stats
    )
  }
  if (card.kind === 'unit' && own.has('Bloodline Tribute')) {
    const enablers = pool.filter(
      (c) =>
        c.kind === 'summoner' &&
        names(c).has('Bloodline Dominion') &&
        c.stats.racialSynergy?.some((s) => s.race === card.bloodline),
    )
    const value = tributeValue(card, enablers.length > 0)
    // The ordinary ability prior already supplies the baseline; only add the interaction surplus.
    const baseline =
      (abilityPrior('Bloodline Tribute', profile) / 10) *
      1.3 *
      profile.leagueMultipliers[league].abilities
    parts.push({
      label: 'Repeatable bloodline team buffs',
      value: Math.max(0, value - baseline),
      note: `Up to three matching-bloodline or Shapeshift beneficiaries; ${own.has('Rebirth') ? 'two death triggers via Rebirth' : 'one death trigger'}${externalReviver(card) ? ` plus half an expected repeat from compatible Resurrect support (${externalReviver(card)!.name})` : ''}. Taunt improves trigger reliability; low mana leaves room for beneficiaries. Each shared attack type contributes. Resurrect partners are alternatives, not an unlimited loop; Final Rest/Dispel can counter the engine. Conditional team-building value.`,
    })
    if (enablers.length)
      parts.push({
        label: 'Bloodline summoner partnership',
        value: Math.min(1.5, value * 0.15),
        note: `Compatible Bloodline Dominion support: ${enablers
          .map((c) => c.name)
          .slice(0, 3)
          .join(
            ', ',
          )}. Broadens eligible allies within active splinters; assumes a suitable ruleset.`,
      })
  }
  if (card.kind === 'summoner' && own.has('Bloodline Dominion')) {
    const races = new Set(card.stats.racialSynergy?.map((s) => s.race) ?? [])
    const partners = pool.filter(
      (c) => c.kind === 'unit' && races.has(c.bloodline),
    )
    const best = partners
      .map((c) => ({ card: c, value: tributeValue(c, true) }))
      .sort((a, b) => b.value - a.value)[0]
    if (best?.value)
      parts.push({
        label: 'Bloodline death-engine partnership',
        value: Math.min(3, best.value * 0.4),
        note: `Best available partner at this cap: ${best.card.name}. Values repeatable team buffs and compatible bloodline access; alternatives are not summed.`,
      })
    if (
      best?.value &&
      card.stats.racialSynergy?.some(
        (s) =>
          s.race === best.card.bloodline && s.abilities?.includes('Scavenger'),
      )
    )
      parts.push({
        label: 'Death triggers × Scavenger',
        value: names(best.card).has('Rebirth') ? 1.2 : 0.6,
        note: 'Matching allies can gain health on each partner death, alongside the tribute. Conditional on fielding that team.',
      })
  }
  return parts
}
