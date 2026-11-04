/** Run only on an isolated, disposable migrated database. Resets rating evidence. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { parseBattle } from '../lib/ratings/battles'
import {
  saveCollectedBattle,
  maintainRatingHistory,
} from '../lib/ratings/ingest'
import {
  ratingDatabase,
  readEvidence,
  readCardBattleStats,
  writeSnapshot,
  publishedConfig,
} from '../lib/ratings/store'
import { saveDailyPrices, readPriceHistory } from '../lib/market/store'
import { collectDailyPrices } from '../lib/market/collector'
import { allRatings } from '../lib/ratings/engine'
import fixture from '../tests/fixtures/modern-ranked-battle.json'
import catalogue from '../data/card-catalogue.json'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
if (process.env.ALLOW_LEAN_DB_TEST !== '1')
  throw new Error('Set ALLOW_LEAN_DB_TEST=1 only on a disposable test database')
const sql = ratingDatabase(),
  cards = catalogue as unknown as CatalogueCard[]
await sql`TRUNCATE rating_seen,rating_daily_evidence,rating_daily_usage,rating_daily_totals,rating_lifetime_usage`
await sql`UPDATE rating_totals SET battles=0,latest=NULL,maintained_on=NULL`
const [{ today }] =
  await sql`SELECT (now() AT TIME ZONE 'UTC')::date::text AS today`
const details = JSON.parse(fixture.details)
details.team2 = structuredClone(details.team1)
details.team2.player = fixture.player_2
const raw = {
  ...fixture,
  details: JSON.stringify(details),
  created_date: `${today}T00:00:00Z`,
  battle_queue_id_1: `test_${randomUUID()}`,
  battle_queue_id_2: `test_${randomUUID()}`,
}
const battle = parseBattle(raw, cards)!
assert.ok(battle.eligible)
assert.equal(
  (await saveCollectedBattle(battle, 'manual-replay')).inserted,
  false,
)
const results = await Promise.all(
  Array.from({ length: 8 }, () => saveCollectedBattle(battle, 'history')),
)
assert.equal(
  results.filter((r) => r.inserted).length,
  1,
  'Concurrent duplicates count once',
)
let evidence = await readEvidence()
const uniqueCards = Array.from(new Set(battle.cardUsage.map((u) => u.cardId)))
for (const card of uniqueCards) {
  const row = evidence[`card:${card}:${battle.league}:${battle.format}`]
  assert.equal(row.battles, 0, 'Mirrors do not supply strength evidence')
  assert.equal(row.usage!.battles, 1, 'Mirrors count once for match share')
  assert.equal(row.usage!.weightedRate, 1)
}
const stats = await readCardBattleStats()
assert.ok(
  stats.every((r) => r.uses === 2),
  'Mirrors contribute two lifetime appearances',
)
assert.equal((await sql`SELECT battles::int FROM rating_totals`)[0].battles, 1)
assert.equal(
  (
    await sql`SELECT count(*)::int AS n FROM rating_collection_targets WHERE player=ANY(${battle.players}::text[]) AND format=${battle.format}`
  )[0].n,
  2,
)
assert.equal(
  (await saveCollectedBattle({ ...battle, parserVersion: 99 }, 'history'))
    .inserted,
  false,
  'Parser changes cannot double count accepted matches',
)
const [{ old_day, edge_day }] =
  await sql`SELECT ((now() AT TIME ZONE 'UTC')::date-90)::text AS old_day,((now() AT TIME ZONE 'UTC')::date-89)::text AS edge_day`
const old = { ...battle, id: randomUUID(), playedAt: `${old_day}T12:00:00Z` }
assert.equal((await saveCollectedBattle(old, 'history')).inserted, false)
const edge = {
  ...battle,
  id: randomUUID(),
  queueIds: [`test_${randomUUID()}`, `test_${randomUUID()}`],
  playedAt: `${edge_day}T12:00:00Z`,
}
assert.equal(
  (await saveCollectedBattle(edge, 'history')).inserted,
  true,
  'Oldest retained UTC day is included',
)
await sql`INSERT INTO rating_seen VALUES(md5(${old.id})::uuid,${old_day}::date,ARRAY['stale-queue'])`
await sql`INSERT INTO rating_daily_totals VALUES(${old_day}::date,'bronze','modern',123)`
await maintainRatingHistory()
assert.equal(
  (await sql`SELECT * FROM rating_seen WHERE id=md5(${old.id})::uuid`).length,
  0,
)
assert.equal(
  (await saveCollectedBattle(old, 'history')).inserted,
  false,
  'Expired IDs cannot be counted again',
)
assert.equal(
  (await sql`SELECT * FROM rating_daily_totals WHERE day=${old_day}::date`)
    .length,
  0,
)
// Non-mirrored strength statistics, draws, expected baseline, scope isolation.
const nonmirror = {
  ...battle,
  id: randomUUID(),
  queueIds: [`test_${randomUUID()}`, `test_${randomUUID()}`],
  observations: [
    {
      battleId: 'unused',
      side: 1 as const,
      kind: 'card' as const,
      subject: String(uniqueCards[0]),
      level: 1,
      player: battle.players[0],
      outcome: 0.5,
      expected: 0.25,
      mirrored: false,
    },
  ],
}
await saveCollectedBattle(nonmirror, 'history')
evidence = await readEvidence()
const key = `card:${uniqueCards[0]}:${battle.league}:${battle.format}`
assert.equal(evidence[key].battles, 1)
assert.equal(evidence[key].draws, 1)
assert.equal(evidence[key].adjustedWinRate, 0.75)
const other = {
  ...nonmirror,
  id: randomUUID(),
  format: 'wild' as const,
  queueIds: [`test_${randomUUID()}`, `test_${randomUUID()}`],
}
await saveCollectedBattle(other, 'history')
assert.equal((await readEvidence())[key].battles, 1)
// A failed increment must roll back its dedup record and every other counter.
const broken = {
  ...nonmirror,
  id: randomUUID(),
  observations: [{ ...nonmirror.observations[0], kind: 'invalid' as 'card' }],
}
await assert.rejects(saveCollectedBattle(broken, 'history'))
assert.equal(
  (await sql`SELECT * FROM rating_seen WHERE id=md5(${broken.id})::uuid`)
    .length,
  0,
)
// Current scores survive replacement, stale publication cannot replace/prune them.
const profile = await publishedConfig()
assert.ok(profile, 'Run ratings:init before integration tests')
const scores = allRatings(cards, profile.config, await readEvidence())
for (let i = 0; i < 3; i++)
  assert.notEqual(await writeSnapshot(profile.id, scores), undefined)
assert.equal((await sql`SELECT * FROM rating_snapshots`).length, 1)
assert.equal(
  (await sql`SELECT count(*)::int AS n FROM rating_scores`)[0].n,
  scores.cards.length + scores.abilities.length,
)
const active = (await sql`SELECT active_snapshot_id FROM rating_workspace`)[0]
  .active_snapshot_id
assert.equal(
  await writeSnapshot(randomUUID(), scores, {
    config: profile.config,
    revision: -1,
    label: 'stale',
    notes: 'test',
    author: 'test',
  }),
  undefined,
)
assert.equal(
  (await sql`SELECT active_snapshot_id FROM rating_workspace`)[0]
    .active_snapshot_id,
  active,
)
// Sparse prices reconstruct empty markets without inventing missing observations.
const owner = randomUUID(),
  cardId = 2147483000
await sql`DELETE FROM card_price_history WHERE card_id=${cardId}`
await sql`DELETE FROM card_price_targets WHERE card_id=${cardId}`
await sql`INSERT INTO card_price_days(day,initialized_by) VALUES(${today}::date,${owner}::uuid) ON CONFLICT DO NOTHING`
await sql`INSERT INTO card_price_targets(day,card_id,edition) VALUES(${today}::date,${cardId},1) ON CONFLICT DO NOTHING`
const prices = Array.from({ length: 5 }, (_, foil) => ({
  foil,
  perBcx: foil === 0 ? 2 : null,
  singleBcx: foil === 0 ? 3 : null,
  listings: foil === 0 ? 4 : 0,
}))
await saveDailyPrices(today, cardId, 1, prices, `${today}T00:00:00Z`)
assert.equal(
  (await sql`SELECT * FROM card_price_history WHERE card_id=${cardId}`).length,
  1,
)
let history = await readPriceHistory(cardId, 1)
assert.equal(history.points.length, 5)
assert.equal(history.points.find((p) => p.foil === 1)!.listings, 0)
assert.equal(history.points.find((p) => p.foil === 0)!.perBcx, 2)
await saveDailyPrices(
  today,
  cardId,
  1,
  prices.map((p) => ({ ...p, perBcx: 9, singleBcx: 9, listings: 1 })),
  `${today}T01:00:00Z`,
)
history = await readPriceHistory(cardId, 1)
assert.equal(
  history.points.find((p) => p.foil === 1)!.listings,
  0,
  'Retries never replace an initial empty observation',
)
assert.equal(history.points.find((p) => p.foil === 0)!.perBcx, 2)
assert.equal((await readPriceHistory(cardId - 1, 1)).points.length, 0)
await sql`UPDATE card_price_days SET completed_at=now() WHERE day=${today}::date`
const completed = await collectDailyPrices(cards, {
  fetcher: async () => {
    throw new Error('Completed days must not fetch')
  },
})
assert.equal(completed.status, 'completed')
console.log(
  'PASS: atomic concurrent ingestion, mirror semantics, daily evidence, scope isolation, retention, rollback, snapshot replacement and sparse price history',
)

await assert.rejects(
  saveDailyPrices(
    today,
    cardId,
    1,
    prices.map((p) => ({ ...p, perBcx: null, singleBcx: null, listings: 0 })),
    `${old_day}T00:00:00Z`,
  ),
  'Empty observations still enforce UTC day integrity',
)
