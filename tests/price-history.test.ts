import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  dailyPoints,
  lineSegments,
  type PricePoint,
} from '../lib/market/history'
import { fetchDailyPrices, retryDelay } from '../lib/market/listings'
import { isCollectorWorkflow } from '../lib/ratings/collector-auth'
const point = (
  day: string,
  foil = 0,
  price: number | null = 1,
): PricePoint => ({
  day,
  foil,
  perBcx: price,
  singleBcx: price,
  listings: price === null ? 0 : 1,
  observedAt: `${day}T02:17:00Z`,
})
test('daily chart isolates foils, fills calendar gaps with unknowns, and preserves real empty markets', () => {
  const rows = dailyPoints(
    [
      point('2026-11-01'),
      point('2026-11-01', 1, 99),
      point('2026-11-03', 0, null),
    ],
    0,
    30,
    '2026-11-03',
  )
  assert.equal(rows.length, 3)
  assert.equal(rows[1].perBcx, null)
  assert.equal(rows[1].listings, null)
  assert.equal(rows[2].perBcx, null)
  assert.equal(rows[2].listings, 0)
  assert.equal(rows[0].perBcx, 1)
  assert.deepEqual(dailyPoints([], 0, 30, '2026-11-03'), [])
  assert.equal(dailyPoints([point('2026-11-01')], 0, 1, '2026-11-03').length, 1)
  assert.equal(
    dailyPoints([point('2026-11-01')], 1, 30, '2026-11-03').length,
    0,
  )
})
test('each line breaks at its own missing prices and isolated snapshots still have a point', () => {
  const rows = [
    point('2026-11-01'),
    point('2026-11-02', 0, null),
    point('2026-11-03'),
  ]
  rows[1].singleBcx = 2
  assert.deepEqual(
    lineSegments(
      rows,
      'perBcx',
      (i) => i,
      (v) => v,
    ),
    ['M0,1', 'M2,1'],
  )
  assert.deepEqual(
    lineSegments(
      rows,
      'singleBcx',
      (i) => i,
      (v) => v,
    ),
    ['M0,1 L1,2 L2,1'],
  )
  assert.deepEqual(
    lineSegments(
      [point('2026-11-01', 0, null)],
      'perBcx',
      (i) => i,
      (v) => v,
    ),
    [],
  )
})
const listing = (foil: number, price: number, bcx: number, uid: string) => ({
  card_detail_id: 780,
  edition: 17,
  foil,
  buy_price: price,
  bcx,
  currency: 'USD',
  uid,
})
test('daily prices distinguish per-BCX, actual singles, all five foils and unique available copies', async () => {
  const rows = [
    listing(0, 12, 4, 'combined'),
    listing(0, 5, 1, 'single'),
    listing(3, 30, 4, 'black'),
    listing(4, 50, 4, 'black-arcane'),
  ]
  const fetcher = (async (input) =>
    Response.json(
      String(input).includes('gold=true')
        ? [listing(1, 20, 1, 'gold'), listing(2, 40, 4, 'arcane'), rows[0]]
        : rows,
    )) as typeof fetch
  const result = await fetchDailyPrices(780, 17, fetcher)
  assert.deepEqual(result[0], { foil: 0, perBcx: 3, singleBcx: 5, listings: 2 })
  assert.deepEqual(result[2], {
    foil: 2,
    perBcx: 10,
    singleBcx: null,
    listings: 1,
  })
  assert.equal(result[3].listings, 1)
  assert.equal(result[4].listings, 1)
  const empty = await fetchDailyPrices(780, 17, (async () =>
    Response.json([])) as typeof fetch)
  assert.ok(
    empty.every(
      (p) => p.perBcx === null && p.singleBcx === null && p.listings === 0,
    ),
  )
})
test('failed, malformed and cross-edition responses never become zero-listing snapshots', async () => {
  for (const payload of [
    { error: 'down' },
    [listing(0, 0, 1, 'bad')],
    [{ ...listing(0, 5, 1, 'other'), edition: 1 }],
    [{ ...listing(0, 5, 1, 'other'), card_detail_id: 1 }],
  ])
    await assert.rejects(
      fetchDailyPrices(780, 17, (async () =>
        Response.json(payload)) as typeof fetch),
    )
  await assert.rejects(
    fetchDailyPrices(780, 17, (async (input) =>
      String(input).includes('gold=true')
        ? new Response('', { status: 429 })
        : Response.json([])) as typeof fetch),
    /rate_limited/,
  )
})
test('price and battle workflows cannot impersonate one another', () => {
  const payload = {
    repository_id: '1181334053',
    repository_owner_id: '221731944',
    ref: 'refs/heads/main',
    workflow_ref:
      'bravetofu/spltiers/.github/workflows/collect-prices.yml@refs/heads/main',
    event_name: 'schedule',
  }
  assert.equal(isCollectorWorkflow(payload, 'prices'), true)
  assert.equal(isCollectorWorkflow(payload, 'battles'), false)
  assert.equal(
    isCollectorWorkflow(
      {
        ...payload,
        workflow_ref: payload.workflow_ref.replace(
          'collect-prices',
          'collect-battles',
        ),
      },
      'prices',
    ),
    false,
  )
  assert.equal(
    isCollectorWorkflow({ ...payload, event_name: 'pull_request' }, 'prices'),
    false,
  )
})

test('rate-limit cooldown accepts seconds or HTTP dates and rejects malformed hints', () => {
  const now = Date.parse('2026-11-02T02:00:00Z')
  assert.equal(retryDelay('300', now), 300)
  assert.equal(retryDelay('Mon, 02 Nov 2026 02:05:00 GMT', now), 300)
  assert.equal(retryDelay(null, now), 60)
  assert.equal(retryDelay('invalid', now), 60)
  assert.equal(retryDelay('0', now), 60)
})
