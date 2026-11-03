import type { RatingProfile } from './types'
export const baseAbility = (name: string) => name.split(':')[0]
export function abilityPrior(name: string, profile: RatingProfile): number {
  const weight = profile.abilities[baseAbility(name)]
  if (!weight) return 5
  return Math.max(
    0,
    Math.min(
      10,
      (weight.standard * profile.standardWeight +
        weight.nonStandard * (1 - profile.standardWeight)) *
        weight.multiplier,
    ),
  )
}
