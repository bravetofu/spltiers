import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blendRating } from '../lib/ratings/engine'
import { EMPTY_EVIDENCE, type Evidence } from '../lib/ratings/types'
import {
  prioritizeTargets,
  type CollectionTarget,
} from '../lib/ratings/collection-priority'

const broad: Evidence = {
  ...EMPTY_EVIDENCE,
  battles: 500,
  effective: 450,

  days: 14,
  adjustedWinRate: 0.6,
  usage: {
    battles: 100,
    totalBattles: 1000,

    days: 7,
    effective: 90,
    totalEffective: 900,
    rate: 0.1,
    weightedRate: 0.1,
  },
}
test('card win results have more influence than the previous ability model; usage is a separate bounded bonus', () => {
  const old = blendRating(6, broad)
  const card = blendRating(6, broad, 'card')
  assert.ok(card.winRateAdjustment > old.winRateAdjustment)
  assert.ok(card.battleWeight <= 0.8)
  assert.ok(card.usageAdjustment > 0 && card.usageAdjustment <= 1)
  assert.equal(old.usageAdjustment, 0)
  assert.ok(
    Math.abs(
      card.score -
        card.curated -
        card.winRateAdjustment -
        card.usageAdjustment -
        card.boundsAdjustment,
    ) < 1e-9,
  )
  assert.ok(
    blendRating(6, { ...broad, adjustedWinRate: 0.4 }, 'card').score < 6,
  )
})
test('match share uses a same-scope denominator and popularity never penalizes an unseen card', () => {
  const a = blendRating(6, { ...broad, adjustedWinRate: 0.5 }, 'card')
  const b = blendRating(
    6,
    {
      ...broad,
      adjustedWinRate: 0.5,
      usage: { ...broad.usage!, rate: 0.05, weightedRate: 0.05 },
    },
    'card',
  )
  assert.ok(a.usageAdjustment > b.usageAdjustment)
  const noUse = blendRating(
    6,
    { ...broad, adjustedWinRate: 0.5, usage: undefined },
    'card',
  )
  assert.equal(noUse.score, 6)
  const popular = blendRating(
    6,
    { ...broad, usage: { ...broad.usage!, weightedRate: 0.8 } },
    'card',
  )
  const capped = blendRating(
    6,
    { ...broad, usage: { ...broad.usage!, weightedRate: 0.2 } },
    'card',
  )
  assert.equal(popular.usageAdjustment, capped.usageAdjustment)
})
test('one day, sparse or stale usage cannot move scores; usage alone is early evidence', () => {
  for (const overrides of [
    { days: 1 },
    { battles: 19 },
    { effective: 14 },
    { totalEffective: 49 },
  ]) {
    const result = blendRating(
      6,
      { ...EMPTY_EVIDENCE, usage: { ...broad.usage!, ...overrides } },
      'card',
    )
    assert.equal(result.score, 6)
    assert.equal(result.confidence, 'curated')
  }
  const usageOnly = blendRating(
    6,
    { ...EMPTY_EVIDENCE, usage: broad.usage },
    'card',
  )
  assert.equal(usageOnly.confidence, 'early')
  assert.equal(usageOnly.winRateAdjustment, 0)
  assert.ok(usageOnly.score > 6)
  assert.equal(
    blendRating(6, { ...broad, battles: 19, usage: undefined }, 'card').score,
    6,
  )
  assert.equal(
    blendRating(6, { ...broad, days: 1, usage: undefined }, 'card').score,
    6,
  )
})
test('final breakdown reconciles at both bounds and zero evidence preserves the baseline', () => {
  for (const prior of [0, 1, 5.12345, 9.9, 10]) {
    for (const rate of [0, 0.5, 1]) {
      const result = blendRating(
        prior,
        { ...broad, adjustedWinRate: rate },
        'card',
      )
      assert.ok(result.score >= 0 && result.score <= 10)
      assert.ok(
        Math.abs(
          result.score -
            result.curated -
            result.winRateAdjustment -
            result.usageAdjustment -
            result.boundsAdjustment,
        ) < 1e-9,
      )
    }
  }
  assert.ok(blendRating(10, broad, 'card').boundsAdjustment < 0)
  assert.equal(blendRating(7.2, undefined, 'card').score, 7.2)
})
const targets: CollectionTarget[] = [
  ...Array.from({ length: 10 }, (_, i) => ({
    player: `scarce-${i}`,
    format: 'modern' as const,
    league: 'silver' as const,
    lastChecked: '2026-11-01',
  })),
  { player: 'old-wild', format: 'wild', league: 'diamond', lastChecked: null },
  { player: 'old-modern', format: 'modern', league: 'gold', lastChecked: null },
]
test('collection favors the least-covered cap while reserving exploration and avoiding duplicate targets', () => {
  const plan = prioritizeTargets(
    targets,
    [
      { format: 'modern', league: 'silver', battles: 10 },
      { format: 'modern', league: 'gold', battles: 1000 },
      { format: 'wild', league: 'diamond', battles: 2000 },
    ],
    10,
  )
  assert.equal(plan[0].league, 'silver')
  assert.equal(plan[4].player, 'old-modern')
  assert.equal(plan[9].player, 'old-wild')
  assert.equal(
    new Set(plan.map((p) => `${p.player}:${p.format}`)).size,
    plan.length,
  )
})
test('unknown targets prefer the underserved format, rotate by last check and spread planned requests', () => {
  const unknown: CollectionTarget[] = [
    { player: 'a', format: 'wild', league: null, lastChecked: null },
    { player: 'a', format: 'modern', league: null, lastChecked: null },
    { player: 'b', format: 'modern', league: null, lastChecked: '2026-11-01' },
  ]
  const plan = prioritizeTargets(unknown, [
    { format: 'wild', league: 'diamond', battles: 1000 },
  ])
  assert.deepEqual(
    plan.map((p) => `${p.player}:${p.format}`),
    ['a:modern', 'b:modern', 'a:wild'],
  )
  const spread = prioritizeTargets(
    [
      { player: 'a', format: 'modern', league: 'bronze', lastChecked: null },
      { player: 'b', format: 'modern', league: 'bronze', lastChecked: null },
      { player: 'c', format: 'modern', league: 'silver', lastChecked: null },
    ],
    [{ format: 'modern', league: 'silver', battles: 10 }],
  )
  assert.equal(spread[1].league, 'silver')
  assert.deepEqual(prioritizeTargets([], []), [])
})
