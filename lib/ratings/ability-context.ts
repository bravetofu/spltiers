import {
  abilitiesAt,
  levelForLeague,
  statAt,
  type CatalogueCard,
  type StatKey,
} from '../splinterlands/catalogue'
import { abilityPrior, baseAbility } from './ability-priors'
import type { BattleFormat, League, RatingProfile, ScorePart } from './types'

export const PAINFORGE_SOURCES = [
  'Electrified',
  'Incendiary',
  'Reckless',
  'Stray Shot',
  'Resurgence',
  'Soul Siphon',
] as const
export function abilityContext(
  catalogue: CatalogueCard[],
  league: League,
  format: BattleFormat,
) {
  const pool = catalogue.filter(
    (c) => c.kind !== 'land' && (format === 'wild' || c.modern),
  )
  const cache = new Map<CatalogueCard, Set<string>>()
  const names = (c: CatalogueCard) => {
    let value = cache.get(c)
    if (!value) {
      value = new Set(
        abilitiesAt(c, levelForLeague(c, league)).map(baseAbility),
      )
      cache.set(c, value)
    }
    return value
  }
  const stat = (c: CatalogueCard, s: StatKey) =>
    statAt(c, s, levelForLeague(c, league)) ?? 0
  // Each lane is one archon and one legal element choice. Dragon does not
  // permit two unrelated base elements at once; dual archons do.
  const summoners = pool.filter((c) => c.kind === 'summoner')
  const racialAccess = (s: CatalogueCard, u: CatalogueCard) =>
    names(s).has('Bloodline Dominion') &&
    (names(u).has('Shapeshift') ||
      !!s.stats.racialSynergy?.some((r) => r.race === u.bloodline))
  const lanes = summoners.flatMap((s) =>
    (s.splinters.includes('Dragon')
      ? ['Fire', 'Water', 'Earth', 'Life', 'Death']
      : ['']
    ).map((element) => ({
      summoner: s,
      elements: new Set([
        ...s.splinters,
        'Neutral',
        ...(element ? [element] : []),
      ]),
    })),
  )
  const permits = (lane: (typeof lanes)[number], c: CatalogueCard) =>
    c.kind === 'summoner'
      ? c.id === lane.summoner.id
      : (c.splinters.some((e) => lane.elements.has(e)) ||
          racialAccess(lane.summoner, c)) &&
        (!c.editions.includes(6) || names(lane.summoner).has('Conscript'))
  const sameTeam = (a: CatalogueCard, b: CatalogueCard) =>
    a.splinters.includes('Neutral') ||
    b.splinters.includes('Neutral') ||
    a.splinters.some((s) => b.splinters.includes(s))
  const orderedLanes = [...lanes].sort(
    (a, b) => stat(a.summoner, 'mana') - stat(b.summoner, 'mana'),
  )
  const masks = new Map<number, Uint32Array>()
  const mask = (card: CatalogueCard) => {
    let m = masks.get(card.id)
    if (!m) {
      m = new Uint32Array(Math.ceil(orderedLanes.length / 32))
      orderedLanes.forEach((l, i) => {
        if (permits(l, card)) m![i >>> 5] |= 1 << (i & 31)
      })
      masks.set(card.id, m)
    }
    return m
  }
  const compatible = (a: CatalogueCard, b: CatalogueCard) => {
    if (a.editions.includes(6) && b.editions.includes(6)) return false
    if (!lanes.length) return sameTeam(a, b)
    const am = mask(a),
      bm = mask(b)
    for (let i = 0; i < am.length; i++) if (am[i] & bm[i]) return true
    return false
  }
  const canField = (cards: CatalogueCard[], budget: number) => {
    const units = cards.filter((c) => c.kind === 'unit')
    if (
      units.length > 6 ||
      units.filter((c) => c.editions.includes(6)).length > 1
    )
      return false
    const mana = units.reduce((s, c) => s + stat(c, 'mana'), 0)
    if (!lanes.length)
      return mana + 4 <= budget && cards.every((c) => sameTeam(cards[0], c))
    const ms = cards.map(mask)
    for (let i = 0; i < ms[0].length; i++) {
      let bits = ms[0][i]
      for (let j = 1; j < ms.length; j++) bits &= ms[j][i]
      if (bits) {
        const lane = orderedLanes[i * 32 + 31 - Math.clz32(bits & -bits)]
        return mana + stat(lane.summoner, 'mana') <= budget
      }
    }
    return false
  }
  const selectPartners = (
    card: CatalogueCard,
    candidates: CatalogueCard[],
    count: number,
    budget: number,
  ) => {
    const picked: CatalogueCard[] = []
    for (const c of candidates) {
      if (
        c.id !== card.id &&
        !picked.some((p) => p.id === c.id) &&
        canField([card, ...picked, c], budget)
      )
        picked.push(c)
      if (picked.length >= count) break
    }
    return picked
  }
  return { pool, names, stat, compatible, canField, selectPartners }
}
export type AbilityContext = ReturnType<typeof abilityContext>

/** Interaction deltas in raw card points. Never feed battle-derived ability scores back into cards. */
export function contextualAbilityParts(
  card: CatalogueCard,
  league: League,
  profile: RatingProfile,
  context: AbilityContext,
): ScorePart[] {
  if (card.kind !== 'unit') return []
  const { pool, names, stat, compatible } = context
  const own = names(card),
    parts: ScorePart[] = []
  const scale = 1.3 * profile.leagueMultipliers[league].abilities
  const unitPartners = () =>
    pool.filter(
      (c) => c.kind === 'unit' && c.id !== card.id && compatible(card, c),
    )
  if (own.has('Bloodlust')) {
    let pressure =
      stat(card, 'attack') +
      0.85 * stat(card, 'ranged') +
      1.1 * stat(card, 'magic')
    let trainer: CatalogueCard | undefined
    if (!pressure && !own.has('Untrainable')) {
      const trainers = unitPartners()
        .filter((c) => names(c).has('Weapons Training'))
        .map((c) => ({
          card: c,
          power: Math.min(
            3,
            Math.max(
              stat(c, 'attack'),
              0.85 * stat(c, 'ranged'),
              1.1 * stat(c, 'magic'),
            ),
          ),
        }))
        .sort((a, b) => b.power - a.power)
      trainer = trainers[0]?.card
      pressure = (trainers[0]?.power ?? 0) * 0.7
    }
    const factor = Math.max(0.15, Math.min(1.6, pressure / 3.5))
    parts.push({
      label: 'Bloodlust trigger potential',
      value: (abilityPrior('Bloodlust', profile) / 10) * scale * (factor - 1),
      note: `${factor.toFixed(2)}× the Bloodlust contribution from cap-level attack pressure. ${trainer ? `Conditional training from ${trainer.name}, discounted for adjacency and team cost.` : 'Weak attacks receive less snowball value; combined attacks receive more.'} Double Strike and targeting bonuses remain in the curated pair rules, not this multiplier.`,
    })
  }
  const sources = PAINFORGE_SOURCES.filter((a) => own.has(a))
  const canDamage = (c: CatalogueCard, source: string) =>
    source === 'Stray Shot'
      ? stat(c, 'ranged') > 0
      : source !== 'Reckless' ||
        ['attack', 'ranged', 'magic'].some((s) => stat(c, s as StatKey) > 0)
  const reliability = (source: string, self: boolean) =>
    source === 'Electrified'
      ? 0.8
      : source === 'Incendiary'
        ? self
          ? 0.7
          : 0.35
        : source === 'Reckless'
          ? 0.65
          : source === 'Resurgence'
            ? 0.3
            : 0.25
  // A short-lived source cannot repeatedly hit adjacent allies. Discount both
  // the source and receiver views using the same survivability assumption.
  const sourceUptime = (c: CatalogueCard, source: string) =>
    source === 'Reckless'
      ? Math.min(
          1,
          (stat(c, 'health') + stat(c, 'armor') * 0.6) /
            (names(c).has('Taunt') ? 18 : 12),
        )
      : 1
  const forgePower = (c: CatalogueCard) =>
    Math.min(
      1.5,
      ['attack', 'ranged', 'magic'].filter((s) => stat(c, s as StatKey) > 0)
        .length * 0.75 ||
        (!names(c).has('Untrainable') &&
        pool.some(
          (t) =>
            t.id !== c.id &&
            names(t).has('Weapons Training') &&
            compatible(c, t) &&
            canDamage(t, 'Reckless'),
        )
          ? 0.4
          : 0),
    ) * Math.min(1, stat(c, 'health') / 6)
  if (sources.length || own.has('Painforge')) {
    const allies = unitPartners().filter((c) => context.canField([card, c], 32))
    // Only Electrified and Incendiary reliably damage their own carrier. Reckless is adjacent; Stray Shot is random.
    const receiverValue = (source: string) => {
      const recipients = allies
        .filter((c) => names(c).has('Painforge'))
        .map(
          (c) =>
            forgePower(c) *
            reliability(source, false) *
            sourceUptime(card, source),
        )
      if (
        own.has('Painforge') &&
        ['Electrified', 'Incendiary'].includes(source)
      )
        recipients.push(forgePower(card) * reliability(source, true))
      return recipients
        .sort((a, b) => b - a)
        .slice(0, source === 'Electrified' ? 2 : 1)
        .reduce((a, b) => a + b, 0)
    }
    const enabling = Math.max(
      0,
      ...sources.filter((s) => canDamage(card, s)).map(receiverValue),
    )
    const receiving = own.has('Painforge')
      ? Math.max(
          0,
          ...allies.flatMap((c) =>
            PAINFORGE_SOURCES.filter(
              (s) => names(c).has(s) && canDamage(c, s),
            ).map(
              (s) =>
                forgePower(card) * reliability(s, false) * sourceUptime(c, s),
            ),
          ),
        )
      : 0
    const value =
      (Math.min(1.2, Math.max(enabling, receiving)) *
        scale *
        abilityPrior('Painforge', profile)) /
      10
    if (value > 0)
      parts.push({
        label: 'Painforge damage conversion',
        value,
        note: 'Conditional allied-damage engine: attack types and health limit the payoff. Electrified is reliable, Reckless needs a hit, adjacency and a source that survives to act, Burning must spread, Stray Shot is random, and resurrection damage is intermittent. Uses the best source/receiver role, not their sum; friendly damage penalties remain. Weary is not a damage trigger.',
      })
  }
  if (own.has('Shapeshift')) {
    const allies = pool.filter(
      (c) =>
        c.id !== card.id &&
        compatible(card, c) &&
        context.canField([card, c], 32),
    )
    const grants = allies
      .filter((c) => c.kind === 'summoner')
      .map((c) =>
        // A Shapeshift recipient qualifies for every racial entry of ONE summoner.
        Array.from(
          new Set(
            c.stats.racialSynergy?.flatMap((s) => s.abilities ?? []) ?? [],
          ),
        ).reduce((sum, a) => sum + abilityPrior(a, profile) / 10, 0),
      )
    const summoner = Math.min(1, Math.max(0, ...grants) * 0.6)
    const tribute = allies.some((c) => names(c).has('Bloodline Tribute'))
      ? (abilityPrior('Bloodline Tribute', profile) / 10) * 0.6
      : 0
    const pact = allies.some((c) => names(c).has('Bloodline Pact'))
      ? (abilityPrior('Bloodline Pact', profile) / 10) * 0.35
      : 0
    const value =
      ((summoner + tribute + pact) *
        scale *
        abilityPrior('Shapeshift', profile)) /
      10
    if (value > 0)
      parts.push({
        label: 'Shapeshift bloodline access',
        value,
        note: 'Universal bloodline eligibility: best available summoner grant package plus bounded Tribute/Pact access. Alternative summoners are not stacked. Pact also carries death penalties; active elements, team slots and rulesets still constrain access. This is additional partner value, not a guaranteed lineup.',
      })
  }
  return parts
}
