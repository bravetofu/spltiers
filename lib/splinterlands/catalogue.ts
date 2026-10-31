import { LEAGUE_LEVEL_CAPS, rarityMaxLevel } from '../editions'

export const CDN = 'https://d36mxiodymuqjm.cloudfront.net'
export const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary']
export const SPLINTERS: Record<string, string> = {
  Red: 'Fire',
  Blue: 'Water',
  Green: 'Earth',
  White: 'Life',
  Black: 'Death',
  Gold: 'Dragon',
  Gray: 'Neutral',
}
export const EDITIONS: Record<number, { name: string; art: string }> = {
  0: { name: 'Alpha', art: 'alpha' },
  1: { name: 'Beta', art: 'beta' },
  2: { name: 'Promo', art: 'promo' },
  3: { name: 'Reward', art: 'reward' },
  4: { name: 'Untamed', art: 'untamed' },
  5: { name: 'Dice', art: 'dice' },
  6: { name: 'Gladius', art: 'gladius' },
  7: { name: 'Chaos Legion', art: 'chaos' },
  8: { name: 'Riftwatchers', art: 'rift' },
  10: { name: 'Chaos Soulbound', art: 'soulbound' },
  12: { name: 'Rebellion', art: 'rebellion' },
  13: { name: 'Rebellion Soulbound', art: 'soulboundrb' },
  14: { name: 'Conclave Arcana', art: 'conclave' },
  15: { name: 'Foundation', art: 'foundations' },
  16: { name: 'Foundation Soulbound', art: 'foundations' },
  17: { name: 'Extra', art: 'extra' },
  18: { name: 'Conclave Rewards', art: 'reward' },
  19: { name: 'Land', art: 'land' },
  20: { name: 'Escalation', art: 'escalation' },
  21: { name: 'Visions of Verico', art: 'verico' },
  23: { name: 'Land Feats', art: 'land' },
}
export const FOILS = [
  { id: 0, name: 'Regular', color: '#c9d1d9' },
  { id: 1, name: 'Gold', color: '#ffd700' },
  { id: 2, name: 'Gold Arcane', color: '#f0beff' },
  { id: 3, name: 'Black', color: '#a9bacb' },
  { id: 4, name: 'Black Arcane', color: '#b69bff' },
] as const
export type CardKind = 'unit' | 'summoner' | 'land'
export type StatKey =
  | 'mana'
  | 'speed'
  | 'attack'
  | 'ranged'
  | 'magic'
  | 'armor'
  | 'health'
export const STAT_LABELS: Record<StatKey, string> = {
  mana: 'Mana',
  speed: 'Speed',
  attack: 'Melee',
  ranged: 'Ranged',
  magic: 'Magic',
  armor: 'Armor',
  health: 'Health',
}
export type LandAbility = [string, number?, string?]
export type Tactic = {
  id: string
  name: string
  description: string
  abilities?: string[]
  status_effects?: string[]
  stat_buff?: number[]
  max: number
  target: string
  target_type: string
  imageURL?: string | string[]
}
export type CardStats = Partial<Record<StatKey, number | number[]>> & {
  abilities?: string[] | string[][]
  ptrOptions?: Tactic[]
  racialSynergy?: { race: string; abilities?: string[] }[]
  land_abilities?: LandAbility[][]
}
export type Distribution = {
  edition: number
  foil?: number
  gold: boolean
  num_cards: string
}
export type RawCard = {
  id: number
  name: string
  color: string
  secondary_color?: string | null
  type: string
  sub_type: string | null
  rarity: number
  editions: string
  tier: number | null
  game_type: string
  stats: CardStats
  distribution?: Distribution[]
  total_printed?: number
  print_start_date?: string | null
}
export type GameSettings = {
  modern_editions: number[]
  modern_card_detail_ids: number[]
}
export type CatalogueCard = {
  id: number
  slug: string
  name: string
  kind: CardKind
  splinters: string[]
  bloodline: string
  rarity: number
  editions: number[]
  tier: number
  modern: boolean
  maxLevel: number
  stats: CardStats
  foils: Record<number, number[]>
  preview: boolean
}

export function cardSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
export function normalizeCatalogue(
  raw: RawCard[],
  settings: GameSettings
): CatalogueCard[] {
  const used = new Set<string>()
  return raw
    .filter(
      (card) =>
        card.game_type === 'splinterlands' &&
        ['Monster', 'Summoner'].includes(card.type)
    )
    .map((card) => {
      const editions = card.editions
        .split(',')
        .map(Number)
        .filter(Number.isFinite)
      const land = card.stats.mana === undefined && !!card.stats.land_abilities
      const tier = Number(card.tier ?? 0)
      const modern =
        !land &&
        (settings.modern_card_detail_ids.includes(card.id) ||
          editions.some((id) => settings.modern_editions.includes(id)) ||
          (editions.some((id) => [2, 3, 17, 18, 20].includes(id)) &&
            settings.modern_editions.includes(tier)))
      const base = cardSlug(card.name)
      const slug = used.has(base) ? `${base}-${card.id}` : base
      used.add(slug)
      return {
        id: card.id,
        slug,
        name: card.name,
        kind: land ? 'land' : card.type === 'Summoner' ? 'summoner' : 'unit',
        splinters: Array.from(
          new Set(
            [card.color, card.secondary_color]
              .filter(Boolean)
              .map((color) => SPLINTERS[color!] ?? color!)
          )
        ),
        bloodline: card.sub_type ?? 'Unknown',
        rarity: card.rarity,
        editions,
        tier,
        modern,
        maxLevel: Math.max(
          1,
          Array.isArray(card.stats.mana)
            ? card.stats.mana.length
            : (card.stats.land_abilities?.length ?? rarityMaxLevel(card.rarity))
        ),
        stats: card.stats,
        foils: Object.fromEntries(
          editions.map((edition) => [
            edition,
            Array.from(
              new Set([
                0,
                ...(card.distribution ?? [])
                  .filter((entry) => entry.edition === edition)
                  .map((entry) => Number(entry.foil ?? (entry.gold ? 1 : 0))),
              ])
            ).sort(),
          ])
        ),
        preview:
          !card.total_printed ||
          (!!card.print_start_date &&
            Date.parse(card.print_start_date) > Date.now()),
      } satisfies CatalogueCard
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
export function statAt(
  card: CatalogueCard,
  stat: StatKey,
  level: number
): number | null {
  const value = card.stats[stat]
  return Array.isArray(value)
    ? (value[Math.max(0, Math.min(level, value.length) - 1)] ?? null)
    : (value ?? null)
}
export function abilitiesAt(card: CatalogueCard, level: number): string[] {
  const values = card.stats.abilities ?? []
  return Array.from(
    new Set(
      values
        .slice(0, Array.isArray(values[0]) ? level : values.length)
        .flat()
        .filter(Boolean)
    )
  )
}
export function levelForLeague(card: CatalogueCard, league: string): number {
  return Math.min(
    card.maxLevel,
    LEAGUE_LEVEL_CAPS[league]?.[card.rarity] ?? card.maxLevel
  )
}
export function landAbilitiesAt(
  card: CatalogueCard,
  level: number
): LandAbility[] {
  return (
    card.stats.land_abilities?.[
      Math.max(0, Math.min(level, card.maxLevel) - 1)
    ] ?? []
  )
}
export function editionName(id: number): string {
  return EDITIONS[id]?.name ?? `Edition ${id}`
}
export function artEdition(card: CatalogueCard, edition: number): string {
  if ([243, 96, 216, 119].includes(card.id)) return 'beta'
  if (card.id === 803) return 'conclave'
  if (edition === 17) return card.tier === 15 ? 'foundations' : 'extra'
  return EDITIONS[edition]?.art ?? 'promo'
}
export function cardImage(
  card: CatalogueCard,
  edition: number,
  foil = 0,
  level = 1
): string {
  return `${CDN}/cards_by_level/${artEdition(card, edition)}/${encodeURIComponent(card.name)}_lv${level}${foil === 1 || foil === 2 ? '_gold' : foil >= 3 ? '_blk' : ''}.png`
}
export function cardInTab(card: CatalogueCard, kind: CardKind): boolean {
  return kind === 'land' ? !!card.stats.land_abilities : card.kind === kind
}
export type CatalogueFilters = {
  kind: CardKind
  q: string
  splinter: string
  rarity: string
  format: string
  edition: string
  league: string
  bloodline: string
}
export function filterCards(
  cards: CatalogueCard[],
  filters: CatalogueFilters
): CatalogueCard[] {
  const query = filters.q.trim().toLowerCase()
  return cards.filter(
    (card) =>
      cardInTab(card, filters.kind) &&
      (!query || card.name.toLowerCase().includes(query)) &&
      (!filters.splinter || card.splinters.includes(filters.splinter)) &&
      (!filters.rarity || card.rarity === Number(filters.rarity)) &&
      (!filters.format ||
        (card.kind !== 'land' &&
          (filters.format === 'modern' ? card.modern : !card.modern))) &&
      (!filters.edition || card.editions.includes(Number(filters.edition))) &&
      (!filters.bloodline || card.bloodline === filters.bloodline)
  )
}

export function cardImageCandidates(
  card: CatalogueCard,
  edition: number,
  foil = 0
): string[] {
  const suffix = foil === 1 || foil === 2 ? '_gold' : foil >= 3 ? '_blk' : ''
  const folder =
    card.kind === 'land' && edition !== 21 ? 'cards_land' : 'cards_v2.2'
  return [
    cardImage(card, edition, foil, card.maxLevel),
    `${CDN}/${folder}/${encodeURIComponent(card.name.replace(/'/g, ''))}${suffix}.jpg`,
    cardImage(card, edition, foil, 1),
    cardImage(card, edition, foil, 3),
  ]
}

export function parseCatalogueFilters(
  initial: Record<string, string | string[] | undefined>
): CatalogueFilters {
  const text = (key: string) =>
    typeof initial[key] === 'string' ? (initial[key] as string) : ''
  const kind = ['unit', 'summoner', 'land'].includes(text('kind'))
    ? (text('kind') as CardKind)
    : 'unit'
  return {
    kind,
    q: text('q'),
    splinter: Object.values(SPLINTERS).includes(text('splinter'))
      ? text('splinter')
      : '',
    rarity: /^[1-4]$/.test(text('rarity')) ? text('rarity') : '',
    format:
      kind !== 'land' && ['modern', 'wild'].includes(text('format'))
        ? text('format')
        : '',
    edition: /^\d+$/.test(text('edition')) ? text('edition') : '',
    league: ['bronze', 'silver', 'gold', 'diamond'].includes(text('league'))
      ? text('league')
      : 'diamond',
    bloodline: text('bloodline'),
  }
}
