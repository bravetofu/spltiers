// Edition format classification as defined in CLAUDE.md

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
