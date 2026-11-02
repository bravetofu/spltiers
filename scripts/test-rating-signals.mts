/** Development database only: ALLOW_USAGE_DB_TEST=1 node --import tsx scripts/test-rating-signals.mts */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import nextEnv from '@next/env'
import fixture from '../tests/fixtures/modern-ranked-battle.json'
import catalogue from '../data/card-catalogue.json'
import { parseBattle } from '../lib/ratings/battles'
import { saveCollectedBattle } from '../lib/ratings/collector'
import { ratingDatabase, readEvidence } from '../lib/ratings/store'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
nextEnv.loadEnvConfig(process.cwd())
if (process.env.ALLOW_USAGE_DB_TEST !== '1')
  throw new Error('Development database only')
const sql = ratingDatabase()
const cards = catalogue as unknown as CatalogueCard[]
const suffix = randomUUID().slice(0, 8)
const players = [`test-a${suffix}`, `test-b${suffix}`]
const details = JSON.parse(fixture.details)
details.team1.player = players[0]
details.team1.summoner.level = 1
details.team2 = structuredClone(details.team1)
details.team2.player = players[1]
const raw = {
  ...fixture,
  player_1: players[0],
  player_2: players[1],
  winner: players[0],
  details: JSON.stringify(details),
  created_date: new Date(Date.now() - 60000).toISOString(),
  battle_queue_id_1: `test_${randomUUID().replaceAll('-', '')}`,
  battle_queue_id_2: `test_${randomUUID().replaceAll('-', '')}`,
}
const battle = parseBattle(raw, cards)!
assert.ok(battle.eligible)
const ids: string[] = []
const before = await readEvidence()
try {
  ids.push(battle.id)
  await saveCollectedBattle(battle, 'manual-replay')
  assert.deepEqual(
    await sql`SELECT * FROM rating_collection_targets WHERE player=ANY(${players})`,
    [],
  )
  let evidence = await readEvidence()
  for (const u of battle.cardUsage) {
    const key = `card:${u.cardId}:${battle.league}:modern`
    assert.equal(
      evidence[key]?.usage?.battles,
      before[key]?.usage?.battles,
      'Research must not affect selection evidence',
    )
  }
  await saveCollectedBattle(battle, 'history')
  await saveCollectedBattle(battle, 'history')
  evidence = await readEvidence()
  for (const u of battle.cardUsage) {
    const key = `card:${u.cardId}:${battle.league}:modern`
    const prior = before[key]?.usage
    const current = evidence[key].usage!
    assert.equal(
      current.battles,
      (prior?.battles ?? 0) + 1,
      'Mirrors and duplicates count once per match',
    )
    assert.ok(
      Math.abs(current.rate - current.battles / current.totalBattles) < 1e-9,
    )
    assert.ok(current.weightedRate <= 1)
    assert.equal(
      evidence[key].battles,
      before[key]?.battles ?? 0,
      'Mirrors must not change win strength evidence',
    )
    if (prior) assert.equal(current.totalBattles, prior.totalBattles + 1)
  }
  const summonerKey = `card:${details.team1.summoner.card_detail_id}:${battle.league}:modern`
  assert.ok(
    evidence[summonerKey].usage!.battles > 0,
    'Underlevelled selection still counts',
  )
  const known =
    await sql`SELECT format, league FROM rating_collection_targets WHERE player=ANY(${players})`
  assert.equal(known.length, 2)
  assert.ok(
    known.every((r) => r.format === 'modern' && r.league === battle.league),
  )
  const wild = parseBattle(
    {
      ...raw,
      format: 'wild',
      settings: JSON.stringify({ rating_level: 4 }),
      battle_queue_id_1: `test_${randomUUID().replaceAll('-', '')}`,
      battle_queue_id_2: `test_${randomUUID().replaceAll('-', '')}`,
    },
    cards,
  )!
  ids.push(wild.id)
  await saveCollectedBattle(wild, 'history')
  const next = await readEvidence()
  assert.equal(
    next[summonerKey].usage!.totalBattles,
    evidence[summonerKey].usage!.totalBattles,
    'Wild must not change the Modern denominator',
  )
  const wildKey = `card:${details.team1.summoner.card_detail_id}:diamond:wild`
  assert.equal(
    next[wildKey].usage!.battles,
    (before[wildKey]?.usage?.battles ?? 0) + 1,
  )
  const aged = parseBattle(
    {
      ...raw,
      created_date: '2020-01-01T00:00:00Z',
      battle_queue_id_1: `test_${randomUUID().replaceAll('-', '')}`,
      battle_queue_id_2: `test_${randomUUID().replaceAll('-', '')}`,
    },
    cards,
  )!
  ids.push(aged.id)
  await saveCollectedBattle(aged, 'history')
  assert.equal(
    (await readEvidence())[summonerKey].usage!.totalBattles,
    evidence[summonerKey].usage!.totalBattles,
    'Old archives must not affect current use rate',
  )
  assert.ok(
    (
      await sql`SELECT last_seen FROM rating_collection_targets WHERE player=ANY(${players})`
    ).every((r) => new Date(r.last_seen).getTime() > Date.parse('2020-01-01')),
    'Older matches must not overwrite recent scope discovery',
  )
  // A prolific pair cannot buy twenty-one effective votes in one UTC day.
  for (let i = 0; i < 20; i++) {
    const repeated = parseBattle(
      {
        ...raw,
        battle_queue_id_1: `test_${randomUUID().replaceAll('-', '')}`,
        battle_queue_id_2: `test_${randomUUID().replaceAll('-', '')}`,
      },
      cards,
    )!
    ids.push(repeated.id)
    await saveCollectedBattle(repeated, 'history')
  }
  const concentrated = (await readEvidence())[summonerKey].usage!
  const addedMass =
    concentrated.effective - (before[summonerKey]?.usage?.effective ?? 0)
  assert.ok(
    addedMass <= 10 && addedMass > 9.9,
    'Per-player daily volume must cap effective match mass at ten',
  )
  assert.equal(
    concentrated.battles,
    (before[summonerKey]?.usage?.battles ?? 0) + 21,
  )
  console.log(
    'PASS: scoped match denominators, mirrors, deduplication, underlevelled usage, research exclusion, time window and account/cap discovery',
  )
} finally {
  await sql`DELETE FROM rating_battles WHERE id=ANY(${ids})`
  await sql`DELETE FROM rating_collection_accounts WHERE player=ANY(${players})`
}
