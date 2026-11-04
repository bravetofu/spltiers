/** Development database only: ALLOW_PRICE_DB_TEST=1 node --import tsx scripts/test-price-history.mts */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import {
  priceDatabase,
  saveDailyPrices,
  readPriceHistory,
} from '../lib/market/store'
import { collectDailyPrices } from '../lib/market/collector'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
if (process.env.ALLOW_PRICE_DB_TEST !== '1')
  throw new Error('Development database only')
const sql = priceDatabase(),
  day = new Date().toISOString().slice(0, 10),
  cardId = 2000000000,
  edition = 17
const [{ n }] =
  await sql`SELECT count(*)::int AS n FROM card_price_days WHERE day=${day}::date`
if (n)
  throw new Error('Use a development branch with no price collection for today')
const cards = [
  { id: cardId, editions: [edition] },
  { id: cardId - 1, editions: [edition] },
  { id: 505, editions: [0] },
] as CatalogueCard[]
let calls = 0
const fetcher = (async (input) => {
  calls++
  const url = new URL(String(input))
  const id = Number(url.searchParams.get('card_detail_id'))
  return Response.json(
    id === cardId && url.searchParams.get('gold') === 'false'
      ? [
          {
            card_detail_id: id,
            edition,
            foil: 0,
            buy_price: 8,
            bcx: 4,
            uid: 'one',
            currency: 'USD',
          },
        ]
      : [],
  )
}) as typeof fetch
try {
  let result = await collectDailyPrices(cards, { batchSize: 1, fetcher })
  assert.equal(result.status, 'pending')
  assert.equal(result.collected, 1)
  const history = await readPriceHistory(cardId, edition)
  assert.equal(history.points.length, 5)
  assert.deepEqual(history.points[0].perBcx, 2)
  assert.equal(history.points[0].singleBcx, null)
  assert.equal(history.points[1].perBcx, null)
  assert.equal(history.points[1].listings, 0)
  await saveDailyPrices(
    day,
    cardId,
    edition,
    [0, 1, 2, 3, 4].map((foil) => ({
      foil,
      perBcx: 9,
      singleBcx: 9,
      listings: 1,
    })),
    new Date().toISOString(),
  )
  assert.equal(
    (await readPriceHistory(cardId, edition)).points[0].perBcx,
    2,
    'Same-day reruns cannot overwrite the first point',
  )
  result = await collectDailyPrices(cards, { batchSize: 1, fetcher })
  assert.equal(result.status, 'completed')
  assert.equal(result.total, 2, 'Runi is excluded from BCX snapshots')
  assert.equal(calls, 4)
  result = await collectDailyPrices(cards, { fetcher })
  assert.equal(result.status, 'completed')
  assert.equal(calls, 4, 'Completed daily jobs do not fetch again')
  const other = cardId - 2
  await sql`INSERT INTO card_price_targets(day,card_id,edition) VALUES(${day}::date,${other},${edition})`
  await sql`UPDATE card_price_days SET completed_at=NULL WHERE day=${day}::date`
  const failed = (async () => new Response('', { status: 503 })) as typeof fetch
  for (let i = 0; i < 3; i++)
    result = await collectDailyPrices(cards, { fetcher: failed })
  assert.equal(result.status, 'partial')
  assert.equal(
    (await readPriceHistory(other, edition)).points.length,
    0,
    'Failure must not create a false zero',
  )
  result = await collectDailyPrices(cards, { fetcher, retryFailed: true })
  assert.equal(result.status, 'completed')
  assert.equal((await readPriceHistory(other, edition)).points.length, 5)
  await sql`INSERT INTO card_price_targets(day,card_id,edition) VALUES(${day}::date,${cardId - 3},${edition})`
  await sql`UPDATE card_price_days SET completed_at=NULL WHERE day=${day}::date`
  result = await collectDailyPrices(cards, {
    fetcher: (async () =>
      new Response('', {
        status: 429,
        headers: { 'retry-after': '120' },
      })) as typeof fetch,
  })
  assert.equal(result.status, 'rate-limited')
  const cooldown = (
    await sql`SELECT extract(epoch FROM expires_at-now())::float AS seconds,owner FROM card_price_lease WHERE singleton`
  )[0]
  assert.ok(cooldown.seconds > 110)
  assert.equal(cooldown.owner, null)
  assert.equal((await collectDailyPrices(cards, { fetcher })).status, 'busy')
  assert.equal(
    (
      await sql`SELECT attempts FROM card_price_targets WHERE day=${day}::date AND card_id=${cardId - 3}`
    )[0].attempts,
    0,
  )
  await sql`UPDATE card_price_lease SET owner=NULL,expires_at=NULL WHERE singleton`
  const busy = randomUUID()
  await sql`UPDATE card_price_lease SET owner=${busy}::uuid,expires_at=now()+interval '1 minute' WHERE singleton`
  assert.equal((await collectDailyPrices(cards, { fetcher })).status, 'busy')
  await sql`UPDATE card_price_lease SET owner=NULL,expires_at=NULL WHERE singleton AND owner=${busy}::uuid`
  console.log(
    'PASS: resumable daily batches, five foils, true empty markets, null single-BCX prices, duplicate protection, failed-request gaps, retry recovery and job lease',
  )
} finally {
  await sql`DELETE FROM card_price_history WHERE day=${day}::date`
  await sql`DELETE FROM card_price_targets WHERE day=${day}::date`
  await sql`DELETE FROM card_price_days WHERE day=${day}::date`
}
