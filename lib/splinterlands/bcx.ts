// BCX (base card) thresholds per rarity and level — shared by pricing action and collection checker.
// Rarity: 1=Common, 2=Rare, 3=Epic, 4=Legendary

// BCX thresholds for Alpha/Beta editions (editions 0, 1, and reward/promo cards with card_detail_id <= 223)
export const ALPHA_BETA_BCX: Record<number, number[]> = {
  1: [1, 3, 5, 12, 25, 52, 105, 172, 305, 505],   // Common (levels 1-10)
  2: [1, 3, 5, 11, 21, 35, 61, 115],               // Rare (levels 1-8)
  3: [1, 3, 6, 11, 23, 46],                        // Epic (levels 1-6)
  4: [1, 3, 5, 11],                                // Legendary (levels 1-4)
}

// BCX thresholds for Untamed and all subsequent editions
export const STANDARD_BCX: Record<number, number[]> = {
  1: [1, 5, 14, 30, 60, 100, 150, 220, 300, 400],  // Common (levels 1-10)
  2: [1, 5, 14, 25, 40, 60, 85, 115],              // Rare (levels 1-8)
  3: [1, 4, 10, 20, 32, 46],                       // Epic (levels 1-6)
  4: [1, 3, 6, 11],                                // Legendary (levels 1-4)
}

// Gold foil BCX thresholds for Alpha/Beta editions
// Levels with 0 BCX are reachable with a single 1-BCX gold foil card
export const ALPHA_BETA_GOLD_BCX: Record<number, number[]> = {
  1: [0, 0, 0, 1, 2, 4, 8, 13, 23, 38],  // Common (levels 1-10)
  2: [0, 0, 1, 2, 4, 7, 12, 22],          // Rare (levels 1-8)
  3: [0, 0, 1, 3, 5, 10],                 // Epic (levels 1-6)
  4: [0, 1, 2, 4],                        // Legendary (levels 1-4)
}

// Gold foil BCX thresholds for Untamed and subsequent editions
export const STANDARD_GOLD_BCX: Record<number, number[]> = {
  1: [0, 0, 1, 2, 5, 9, 14, 20, 27, 38],  // Common (levels 1-10)
  2: [0, 1, 2, 4, 7, 11, 16, 22],          // Rare (levels 1-8)
  3: [0, 1, 2, 4, 7, 10],                  // Epic (levels 1-6)
  4: [0, 1, 2, 4],                         // Legendary (levels 1-4)
}

/** BCX required to reach max level for regular foil. */
export function getMaxLevelBcx(rarity: number, isAlphaBeta: boolean): number {
  const table = isAlphaBeta ? ALPHA_BETA_BCX : STANDARD_BCX
  const row = table[rarity]
  return row ? row[row.length - 1] : 1
}

/**
 * BCX required to reach max level for gold foil.
 * Returns 1 if a single gold foil card already reaches max level (table value 0).
 */
export function getMaxLevelBcxGold(rarity: number, isAlphaBeta: boolean): number {
  const table = isAlphaBeta ? ALPHA_BETA_GOLD_BCX : STANDARD_GOLD_BCX
  const row = table[rarity]
  if (!row) return 1
  const last = row[row.length - 1]
  return last === 0 ? 1 : last
}
