// Edition format classification as defined in CLAUDE.md

// League-based level caps per rarity (1=Common, 2=Rare, 3=Epic, 4=Legendary)
// Update these if Splinterlands changes league level requirements
export const LEAGUE_LEVEL_CAPS: Record<string, Record<number, number>> = {
  bronze:  { 1: 3,  2: 2,  3: 2,  4: 1 },
  silver:  { 1: 5,  2: 4,  3: 3,  4: 2 },
  gold:    { 1: 8,  2: 6,  3: 5,  4: 3 },
  diamond: { 1: 10, 2: 8,  3: 6,  4: 4 },
}

export const MODERN_EDITION_NAMES = new Set([
  'Conclave Arcana',
  'Rebellion',
  'Escalation',
])

export const WILD_EDITION_NAMES = new Set([
  'Chaos Legion',
  'Riftwatchers',
  'Untamed',
  'Alpha/Beta',
  'Dice',
])

export type EditionFormat = 'modern' | 'wild' | 'other'

export function getEditionFormat(name: string): EditionFormat {
  if (MODERN_EDITION_NAMES.has(name)) return 'modern'
  if (WILD_EDITION_NAMES.has(name)) return 'wild'
  return 'other'
}

export function rarityMaxLevel(rarity: number): number {
  switch (rarity) {
    case 1: return 10
    case 2: return 8
    case 3: return 6
    case 4: return 4
    default: return 1
  }
}
