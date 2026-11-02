import test from 'node:test'
import assert from 'node:assert/strict'
import {
  summarizeTierRatings,
  tierForScore,
  tierMismatch,
  type ScopeScore,
} from '../lib/ratings/tier-reference'
import { LEAGUES } from '../lib/ratings/types'
const row = (
  score: number,
  league: ScopeScore['league'] = 'bronze',
  format: ScopeScore['format'] = 'modern',
): ScopeScore => ({ cardId: 1, score, league, format })

test('tier boundaries are inclusive on the higher tier and use the actual average', () => {
  for (const [score, tier] of [
    [10, 'S'],
    [9, 'S'],
    [8.999, 'A'],
    [8, 'A'],
    [7.999, 'B'],
    [6.5, 'B'],
    [6.499, 'C'],
    [5, 'C'],
    [4.999, 'D'],
    [0, 'D'],
  ] as const)
    assert.equal(tierForScore(score), tier)
  const summary = summarizeTierRatings([row(9), row(8.999, 'silver')])[1]
  assert.equal(summary.average, 8.9995)
  assert.equal(summary.tier, 'A')
})
test('averages available scopes equally and excludes missing formats', () => {
  const wildOnly = summarizeTierRatings([
    row(9, 'bronze', 'wild'),
    row(7, 'silver', 'wild'),
  ])[1]
  assert.equal(wildOnly.average, 8)
  assert.equal(wildOnly.scopes.length, 2)
  const full = summarizeTierRatings(
    LEAGUES.flatMap((league, i) => [
      row(i + 2, league),
      row(i + 6, league, 'wild'),
    ]),
  )[1]
  assert.equal(full.average, 5.5)
  assert.equal(full.scopes.length, 8)
})
test('invalid scores are ignored, duplicate scopes count once, and warnings follow current placement', () => {
  const summary = summarizeTierRatings([
    row(7),
    row(8),
    row(NaN, 'silver'),
    row(-1, 'gold'),
    row(11, 'diamond'),
  ])[1]
  assert.equal(summary.average, 8)
  assert.equal(summary.scopes.length, 1)
  assert.equal(tierMismatch('S', summary), true)
  assert.equal(tierMismatch('A', summary), false)
  assert.equal(tierMismatch(null, summary), false)
  assert.equal(tierMismatch('D', undefined), false)
  assert.equal(summarizeTierRatings([row(0)])[1].tier, 'D')
})
