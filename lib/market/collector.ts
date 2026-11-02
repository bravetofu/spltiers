import { randomUUID } from 'node:crypto'
import type { CatalogueCard } from '../splinterlands/catalogue'
import { priceDatabase, saveDailyPrices } from './store'
import { fetchDailyPrices, MarketError } from './listings'

export async function collectDailyPrices(
  cards: CatalogueCard[],
  options: {
    batchSize?: number
    durationMs?: number
    fetcher?: typeof fetch
    retryFailed?: boolean
  } = {},
) {
  const sql = priceDatabase(),
    owner = randomUUID()
  const lease =
    await sql`UPDATE card_price_lease SET owner=${owner}::uuid, expires_at=now()+interval '5 minutes'
    WHERE singleton AND (expires_at IS NULL OR expires_at<now()) RETURNING owner`
  if (!lease.length) return { status: 'busy', collected: 0 }
  const deadline = Date.now() + Math.min(210000, options.durationMs ?? 160000)
  let collected = 0,
    rateLimited = false
  try {
    const [{ day }] =
      await sql`SELECT (now() AT TIME ZONE 'UTC')::date::text AS day`
    const targets = cards
      .filter((c) => c.id !== 505)
      .flatMap((c) => c.editions.map((edition) => ({ card_id: c.id, edition })))
    await sql.transaction([
      sql`INSERT INTO card_price_days(day,initialized_by) VALUES (${day}::date,${owner}::uuid) ON CONFLICT DO NOTHING`,
      sql`INSERT INTO card_price_targets(day,card_id,edition)
        SELECT ${day}::date, card_id, edition FROM jsonb_to_recordset(${JSON.stringify(targets)}::jsonb) AS t(card_id integer,edition integer)
        WHERE EXISTS(SELECT 1 FROM card_price_days WHERE day=${day}::date AND initialized_by=${owner}::uuid)
        ON CONFLICT DO NOTHING`,
    ])
    if (options.retryFailed)
      await sql`UPDATE card_price_targets SET attempts=0,last_error=NULL
        WHERE day=${day}::date AND completed_at IS NULL AND attempts>=3`
    const batch =
      await sql`SELECT card_id,edition FROM card_price_targets WHERE day=${day}::date AND completed_at IS NULL AND attempts<3
      ORDER BY attempts,card_id DESC,edition LIMIT ${Math.max(1, Math.min(100, options.batchSize ?? 80))}`
    let index = 0
    const worker = async () => {
      while (
        index < batch.length &&
        Date.now() < deadline - 22000 &&
        !rateLimited
      ) {
        // UTC dates describe when the observation was made, never a backfilled date.
        if (new Date().toISOString().slice(0, 10) !== day) break
        const item = batch[index++]
        await sql`UPDATE card_price_targets SET attempts=attempts+1 WHERE day=${day}::date AND card_id=${item.card_id} AND edition=${item.edition}`
        try {
          const prices = await fetchDailyPrices(
            item.card_id,
            item.edition,
            options.fetcher,
          )
          const observedAt = new Date().toISOString()
          if (observedAt.slice(0, 10) !== day) break
          await saveDailyPrices(
            day,
            item.card_id,
            item.edition,
            prices,
            observedAt,
          )
          collected++
        } catch (error) {
          const reason =
            error instanceof MarketError ? error.message : 'collection_failed'
          if (reason === 'rate_limited') rateLimited = true
          await sql`UPDATE card_price_targets SET last_error=${reason}, attempts=attempts-${reason === 'rate_limited' ? 1 : 0}
            WHERE day=${day}::date AND card_id=${item.card_id} AND edition=${item.edition}`
        }
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    }
    const results = await Promise.allSettled([worker(), worker(), worker()])
    if (results.some((result) => result.status === 'rejected'))
      throw new Error('Price collection storage unavailable')
    const [counts] =
      await sql`SELECT count(*)::int AS total, count(*) FILTER(WHERE completed_at IS NOT NULL)::int AS completed,
      count(*) FILTER(WHERE completed_at IS NULL AND attempts>=3)::int AS failed
      FROM card_price_targets WHERE day=${day}::date`
    if (counts.completed === counts.total)
      await sql`UPDATE card_price_days SET completed_at=coalesce(completed_at,now()) WHERE day=${day}::date`
    const status =
      counts.completed === counts.total
        ? 'completed'
        : rateLimited
          ? 'rate-limited'
          : counts.completed + counts.failed === counts.total
            ? 'partial'
            : 'pending'
    return { status, day, collected, ...counts }
  } finally {
    await sql`UPDATE card_price_lease SET owner=NULL,expires_at=NULL WHERE singleton AND owner=${owner}::uuid`
  }
}
