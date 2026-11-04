/** Read-only, reproducible comparison against a captured production profile/evidence/tier reference. */
import { readFile, writeFile } from 'node:fs/promises'
import { allRatings } from '../lib/ratings/engine'
import {
  summarizeTierRatings,
  tierDistance,
  type TierKey,
} from '../lib/ratings/tier-reference'
import type { CardRating, Evidence, RatingProfile } from '../lib/ratings/types'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
import catalogue from '../data/card-catalogue.json'
const input = process.argv[2] ?? 'work/scoring-baseline.json'
const reference = JSON.parse(await readFile(input, 'utf8')) as {
  profile: { config: RatingProfile }
  evidence: Record<string, Evidence>
  baseline: { cards: CardRating[] }
  tiers: { card_id: number; card_name: string; tier: TierKey }[]
  published: CardRating[]
}
const start = performance.now()
const next = allRatings(
  catalogue as CatalogueCard[],
  reference.profile.config,
  reference.evidence,
)
const old = new Map(
  reference.baseline.cards.map((r) => [
    `${r.cardId}:${r.league}:${r.format}`,
    r,
  ]),
)
const names = new Map(catalogue.map((c) => [c.id, c.name]))
const rows = next.cards.map((r) => {
  const before = old.get(`${r.cardId}:${r.league}:${r.format}`)!
  return {
    ...r,
    name: names.get(r.cardId),
    previous: before.score,
    delta: r.score - before.score,
    priorDelta: r.curated - before.curated,
  }
})
const index = summarizeTierRatings(next.cards),
  previousIndex = summarizeTierRatings(reference.baseline.cards)
const unique = [
  ...new Map(reference.tiers.map((t) => [t.card_id, t])).values(),
].filter((t) => index[t.card_id])
const mismatches = unique
  .map((t) => ({
    ...t,
    average: index[t.card_id].average,
    previous: previousIndex[t.card_id].average,
    distance: tierDistance(t.tier, index[t.card_id]),
    previousDistance: tierDistance(t.tier, previousIndex[t.card_id]),
    scopes: index[t.card_id].scopes,
  }))
  .sort((a, b) => b.distance - a.distance || a.average - b.average)
const summary = {
  scopes: rows.length,
  elapsedMs: Math.round(performance.now() - start),
  meanAbsoluteChange:
    rows.reduce((s, r) => s + Math.abs(r.delta), 0) / rows.length,
  movesOver2: rows.filter((r) => Math.abs(r.delta) >= 2).length,
  tiers: unique.length,
  meanTierDistanceBefore:
    unique.reduce(
      (s, t) => s + tierDistance(t.tier, previousIndex[t.card_id]),
      0,
    ) / unique.length,
  meanTierDistanceAfter:
    unique.reduce((s, t) => s + tierDistance(t.tier, index[t.card_id]), 0) /
    unique.length,
}
await writeFile(
  'work/scoring-review.json',
  JSON.stringify({ summary, rows, mismatches }),
)
console.log(summary)
console.log(
  'Largest changes',
  rows
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 25)
    .map(({ name, league, format, previous, score, delta }) => ({
      name,
      league,
      format,
      previous,
      score,
      delta,
    })),
)
console.log(
  'Tier discrepancies',
  mismatches
    .slice(0, 22)
    .map(({ card_name, tier, average, previous, distance }) => ({
      card_name,
      tier,
      average,
      previous,
      distance,
    })),
)
