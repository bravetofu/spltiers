import {
  abilitiesAt,
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
): ScorePart[] {
  const names = (c: CatalogueCard) =>
    new Set(
      abilitiesAt(c, levelForLeague(c, league)).map((a) => a.split(':')[0]),
    )
  const own = names(card)
  if (!own.has('Bloodline Tribute') && !own.has('Bloodline Dominion')) return []
  const pool = catalogue.filter(
    (c) => c.kind !== 'land' && (format === 'wild' || c.modern),
  )
  const parts: ScorePart[] = []
  const sameTeam = (a: CatalogueCard, b: CatalogueCard) =>
    a.splinters.includes('Neutral') ||
    b.splinters.includes('Neutral') ||
    a.splinters.some((s) => b.splinters.includes(s))
  const tributeValue = (unit: CatalogueCard, broaden: boolean) => {
    const abilities = names(unit),
      level = levelForLeague(unit, league)
    if (!abilities.has('Bloodline Tribute')) return 0
    const recipients = pool.filter(
      (c) =>
        c.kind === 'unit' &&
        c.id !== unit.id &&
        (broaden || sameTeam(unit, c)) &&
        (c.bloodline === unit.bloodline || names(c).has('Shapeshift')),
    )
    // Model three beneficiaries, not an automatic perfect five-unit bloodline team.
    const count = Math.min(3, recipients.length)
    const offense = recipients.length
      ? recipients.reduce(
          (sum, recipient) =>
            sum +
            Math.max(
              ...(['attack', 'ranged', 'magic'] as const).map((s) =>
                (statAt(unit, s, level) ?? 0) > 0 &&
                (statAt(recipient, s, levelForLeague(recipient, league)) ?? 0) >
                  0
                  ? profile.statWeights[s]
                  : 0,
              ),
            ),
          0,
        ) / recipients.length
      : 0
    const statGain =
      offense +
      profile.statWeights.speed +
      profile.statWeights.armor +
      profile.statWeights.health
    const triggers = abilities.has('Rebirth') ? 2 : 1
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
    const prior = profile.abilities['Bloodline Tribute']
    const baseline = prior
      ? (((prior.standard * profile.standardWeight +
          prior.nonStandard * (1 - profile.standardWeight)) *
          prior.multiplier) /
          10) *
        1.3 *
        profile.leagueMultipliers[league].abilities
      : 0
    parts.push({
      label: 'Repeatable bloodline team buffs',
      value: Math.max(0, value - baseline),
      note: `Up to three matching-bloodline or Shapeshift beneficiaries; ${own.has('Rebirth') ? 'two death triggers via Rebirth' : 'one death trigger'}. Taunt improves trigger reliability; low mana leaves room for beneficiaries. Shared attack types only. Conditional team-building value.`,
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
