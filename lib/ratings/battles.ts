import {
  abilitiesAt,
  levelForLeague,
  type CatalogueCard,
} from '../splinterlands/catalogue'
import { baseAbility } from './engine'
import {
  LEAGUES,
  PARSER_VERSION,
  type BattleFormat,
  type League,
} from './types'
import { LEAGUE_LEVEL_CAPS } from '../editions'

export type BattleObservation = {
  side: 1 | 2
  kind: 'card' | 'ability'
  subject: string
  level: number | null
  player: string
  outcome: number
  expected: number
  mirrored: boolean
}
export type CardUsage = {
  side: 1 | 2
  cardId: number
  level: number
  outcome: number
}
export type ParsedBattle = {
  id: string
  queueIds: string[]
  playedAt: string
  format: BattleFormat
  matchType: string
  league: League | null
  leagueMethod: string
  mana: number | null
  rulesets: string[]
  winner: string | null
  eligible: boolean
  exclusion: string | null
  parserVersion: number
  raw: Record<string, unknown>
  observations: BattleObservation[]
  cardUsage: CardUsage[]
  players: string[]
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
export function jsonObject(value: unknown): Record<string, unknown> | null {
  for (let i = 0; i < 3; i++) {
    if (record(value)) return value
    if (typeof value !== 'string') return null
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  return record(value) ? value : null
}
const numeric = (v: unknown) =>
  v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v))
    ? Number(v)
    : null
export const validAccount = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z][a-z0-9.-]{2,31}$/.test(v)
export const validQueueId = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-zA-Z0-9_-]{6,100}$/.test(v)

export function parseBattle(
  value: unknown,
  catalogue: CatalogueCard[],
  now = Date.now(),
  historyFormat?: BattleFormat,
): ParsedBattle | null {
  if (!record(value)) return null // HTTP 200 may contain a JSON error string.
  const queueIds = Array.from(
    new Set(
      [value.battle_queue_id_1, value.battle_queue_id_2].filter(validQueueId),
    ),
  ).sort()
  if (queueIds.length !== 2) return null
  const settings = jsonObject(value.settings)
  const allowed = jsonObject(settings?.allowed_cards)
  // The format-filtered history endpoint omits the format on legacy Wild rows.
  // Only that caller supplies context; an unlabelled standalone replay stays unknown.
  const format =
    value.format ??
    (typeof settings?.allowed_cards === 'string'
      ? settings.allowed_cards
      : allowed?.epoch) ??
    historyFormat
  if (format !== 'modern' && format !== 'wild') return null
  const playedAt =
    typeof value.created_date === 'string'
      ? Date.parse(value.created_date)
      : NaN
  if (!Number.isFinite(playedAt) || playedAt > now + 300000) return null
  if (
    !validAccount(value.player_1) ||
    !validAccount(value.player_2) ||
    value.player_1 === value.player_2
  )
    return null
  const players = [value.player_1, value.player_2]
  const details = jsonObject(value.details)
  const teams = [jsonObject(details?.team1), jsonObject(details?.team2)]
  const winnerValue = value.winner ?? details?.winner
  const draw =
    typeof winnerValue === 'string' && /^(draw|tie)$/i.test(winnerValue)
  const winner =
    typeof winnerValue === 'string' && players.includes(winnerValue)
      ? winnerValue
      : null
  const knownWinner = winner !== null || draw
  const cards = new Map(catalogue.map((card) => [card.id, card]))
  const lineups = teams.map((team) => {
    const summoner = jsonObject(team?.summoner)
    const monsters = Array.isArray(team?.monsters)
      ? team.monsters
          .map(jsonObject)
          .filter((v): v is Record<string, unknown> => !!v)
      : []
    return summoner ? [summoner, ...monsters] : []
  })
  const units = lineups.flat().map((unit) => ({
    unit,
    card: cards.get(Number(unit.card_detail_id)),
    level: numeric(unit.level),
  }))
  const validLineups =
    lineups.every((team) => team.length >= 2 && team.length <= 7) &&
    units.every(
      ({ card, level }) =>
        card &&
        card.kind !== 'land' &&
        level !== null &&
        Number.isInteger(level) &&
        level >= 1 &&
        level <= card.maxLevel,
    )
  let league: League | null = null,
    leagueMethod = 'unmapped'
  const ratingLevel = numeric(settings?.rating_level)
  const explicitCaps = [
    'max_common_level',
    'max_rare_level',
    'max_epic_level',
    'max_legendary_level',
  ].map((key) => numeric(settings?.[key]))
  const hasExplicitCaps = explicitCaps.every((value) => value !== null)
  if (hasExplicitCaps) {
    league =
      LEAGUES.find((candidate) =>
        explicitCaps.every(
          (cap, index) => cap === LEAGUE_LEVEL_CAPS[candidate][index + 1],
        ),
      ) ?? null
    leagueMethod = league ? 'explicit' : 'custom cap'
  } else if (
    ratingLevel !== null &&
    ratingLevel >= 1 &&
    ratingLevel <= 4 &&
    Number.isInteger(ratingLevel)
  ) {
    league = LEAGUES[ratingLevel - 1]
    leagueMethod = 'explicit'
  } else if (validLineups && ratingLevel !== 0) {
    // Only infer a cap when both complete lineups fit and at least two cards
    // reach it. Never turn a player's ladder rating into an assumed card level.
    for (const candidate of LEAGUES)
      if (
        units.every(
          ({ card, level }) => level! <= levelForLeague(card!, candidate),
        ) &&
        units.filter(
          ({ card, level }) => level === levelForLeague(card!, candidate),
        ).length >= 2
      ) {
        league = candidate
        leagueMethod = 'inferred'
        break
      }
  }
  const ratings = [
    numeric(value.player_1_rating_initial ?? teams[0]?.rating),
    numeric(value.player_2_rating_initial ?? teams[1]?.rating),
  ]
  const mana = numeric(value.mana_cap)
  const rulesets =
    typeof value.ruleset === 'string'
      ? Array.from(
          new Set(
            value.ruleset
              .split('|')
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        )
      : []
  const matchType =
    typeof value.match_type === 'string' && /^ranked$/i.test(value.match_type)
      ? 'Ranked'
      : String(value.match_type ?? 'Unknown')
  const exclusion =
    matchType !== 'Ranked'
      ? 'Non-ranked match'
      : value.is_surrender === true
        ? 'Surrender'
        : !knownWinner
          ? 'Unresolved outcome'
          : !validLineups
            ? 'Incomplete or unknown lineup'
            : ratings.some((r) => r === null || r < 0)
              ? 'Missing pre-battle rating'
              : !league
                ? 'Unmapped level cap'
                : mana === null || !rulesets.length
                  ? 'Missing battle context'
                  : null
  const observations: BattleObservation[] = []
  const cardUsage: CardUsage[] = []
  if (!exclusion && league) {
    const featureSets = lineups.map((team) => {
      const features = new Map<
        string,
        { kind: 'card' | 'ability'; subject: string; level: number | null }
      >()
      for (const unit of team) {
        const card = cards.get(Number(unit.card_detail_id))!,
          level = Number(unit.level)
        // Underlevelled cards remain in raw data but don't represent cap-level strength.
        if (level === levelForLeague(card, league!))
          features.set(`card:${card.id}`, {
            kind: 'card',
            subject: String(card.id),
            level,
          })
        const intrinsic =
          Array.isArray(unit.abilities) &&
          unit.abilities.every((a) => typeof a === 'string')
            ? (unit.abilities as string[])
            : abilitiesAt(card, level)
        for (const ability of intrinsic)
          features.set(`ability:${baseAbility(ability)}`, {
            kind: 'ability',
            subject: baseAbility(ability),
            level: null,
          })
      }
      return features
    })
    for (const side of [0, 1] as const) {
      const expected =
        1 / (1 + Math.pow(10, (ratings[1 - side]! - ratings[side]!) / 400))
      const outcome = draw ? 0.5 : winner === players[side] ? 1 : 0
      // Usage is descriptive: retain underlevelled and mirrored appearances.
      // Strength evidence keeps its separate cap-level and mirror exclusions.
      for (const unit of lineups[side])
        cardUsage.push({
          side: (side + 1) as 1 | 2,
          cardId: Number(unit.card_detail_id),
          level: Number(unit.level),
          outcome,
        })
      for (const [key, feature] of Array.from(featureSets[side]))
        observations.push({
          side: (side + 1) as 1 | 2,
          ...feature,
          player: players[side],
          outcome,
          expected,
          mirrored: featureSets[1 - side].has(key),
        })
    }
  }
  // Retain full replay details for later reprocessing, without duplicating the
  // unrelated current player-profile payloads returned by the replay endpoint.
  const keep = [
    'battle_queue_id_1',
    'battle_queue_id_2',
    'player_1',
    'player_2',
    'player_1_rating_initial',
    'player_2_rating_initial',
    'player_1_rating_final',
    'player_2_rating_final',
    'winner',
    'details',
    'settings',
    'created_date',
    'match_type',
    'mana_cap',
    'ruleset',
    'inactive',
    'block_num',
    'is_surrender',
    'format',
    'bracket',
  ]
  return {
    id: queueIds.join(':'),
    queueIds,
    playedAt: new Date(playedAt).toISOString(),
    format,
    matchType,
    league,
    leagueMethod,
    mana,
    rulesets,
    winner: draw ? 'DRAW' : winner,
    eligible: !exclusion,
    exclusion,
    parserVersion: PARSER_VERSION,
    raw: Object.fromEntries(
      keep.filter((key) => key in value).map((key) => [key, value[key]]),
    ),
    observations,
    cardUsage,
    players,
  }
}
