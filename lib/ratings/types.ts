import type { StatKey } from '../splinterlands/catalogue'

export const LEAGUES = ['bronze', 'silver', 'gold', 'diamond'] as const
export type League = (typeof LEAGUES)[number]
export type BattleFormat = 'modern' | 'wild'
export const LEAGUE_NAMES: Record<League, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  diamond: 'Diamond / Champion',
}
export type AbilityWeight = {
  standard: number
  nonStandard: number
  multiplier: number
  drawback: boolean
  notes: string
}
export type Synergy = {
  abilities: [string, string]
  strength: -1 | 1 | 2 | 3
  notes: string
}
export type StatSynergy = {
  ability: string
  stat: StatKey
  minimum: number
  bonus: number
  notes: string
}
export type CardAdjustment = {
  cardId: number
  league: League | 'all'
  format: BattleFormat | 'all'
  delta: number
  notes: string
}
export const SUMMONER_WEIGHTS = {
  attack: 1,
  ranged: 1,
  magic: 1.35,
  speed: 1.1,
  armor: 0.8,
  health: 0.7,
}
export type RatingProfile = {
  summonerWeights?: typeof SUMMONER_WEIGHTS
  summonerAbilityFactor?: number
  summonerCalibration?: number
  schemaVersion: 1
  standardWeight: number
  statWeights: Record<StatKey, number>
  leagueMultipliers: Record<
    League,
    { stats: number; mana: number; abilities: number }
  >
  abilities: Record<string, AbilityWeight>
  synergies: Synergy[]
  statSynergies: StatSynergy[]
  adjustments: CardAdjustment[]
}
export type UsageEvidence = {
  battles: number
  totalBattles: number
  days: number
  effective: number
  totalEffective: number
  rate: number
  weightedRate: number
}
export type Evidence = {
  usage?: UsageEvidence
  battles: number
  days: number
  wins: number
  draws: number
  effective: number
  adjustedWinRate: number
  rawWinRate: number
  lastPlayed: string | null
  standardBattles: number
  nonStandardBattles: number
}
export type Confidence = 'curated' | 'early' | 'moderate' | 'strong'
export type Rating = {
  score: number
  curated: number
  battleScore: number | null
  battleWeight: number
  usageWeight: number
  winRateAdjustment: number
  usageAdjustment: number
  boundsAdjustment: number
  confidence: Confidence
  evidence: Evidence
}
export type ScorePart = { label: string; value: number; note?: string }
export type CardRating = Rating & {
  cardId: number
  league: League
  format: BattleFormat
  level: number
  practical?: import('./practical-value').PracticalSummary
  parts: ScorePart[]
}
export type AbilityRating = Rating & {
  name: string
  league: League
  format: BattleFormat
}
export type PublishedInfo = {
  id: string
  label: string
  notes: string
  publishedAt: string
  author: string
}
export type CollectorStatus = {
  battles: number
  rankedBattles: number
  eligibleBattles: number
  lastBattle: string | null
  lastRun: {
    status: string
    message: string
    finishedAt: string | null
    collected: number
  } | null
}
export const ENGINE_VERSION = 'practical-3.1'
export const PARSER_VERSION = 3
export const EVIDENCE_WINDOW_DAYS = 90
export const EVIDENCE_HALF_LIFE_DAYS = 30
export const EMPTY_EVIDENCE: Evidence = {
  battles: 0,
  days: 0,
  wins: 0,
  draws: 0,
  effective: 0,
  adjustedWinRate: 0.5,
  rawWinRate: 0.5,
  lastPlayed: null,
  standardBattles: 0,
  nonStandardBattles: 0,
}
