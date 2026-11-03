import review from '../../data/ability-review-2026-11-03.json'
import type { AbilityWeight, RatingProfile } from './types'
export const ABILITY_REVIEW = review
/** Three-way merge: only untouched provisional weights change; curator edits win. */
export function applyAbilityReview(config: RatingProfile) {
  const next = structuredClone(config)
  const changed: string[] = [],
    preserved: string[] = []
  for (const [name, change] of Object.entries(review.abilities)) {
    const current = config.abilities[name]
    const equals = (weight: AbilityWeight) =>
      current &&
      (Object.keys(weight) as (keyof AbilityWeight)[]).every(
        (k) => current[k] === weight[k],
      )
    if (equals(change.previous)) {
      next.abilities[name] = { ...change.next }
      changed.push(name)
    } else if (!equals(change.next)) preserved.push(name)
  }
  return { config: next, changed, preserved }
}
