/** Run against a development database: ALLOW_USAGE_DB_TEST=1 node --import tsx scripts/test-battle-usage.mts */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import nextEnv from '@next/env'
import { readFile } from 'node:fs/promises'
import { parseBattle } from '../lib/ratings/battles'
import { saveCollectedBattle } from '../lib/ratings/collector'
import { backfillBattleUsage } from '../lib/ratings/backfill'
import {
  ratingDatabase,
  readCardBattleStats,
  readEvidence,
} from '../lib/ratings/store'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
import type { CardBattleStats } from '../lib/ratings/battle-stats'
import { PARSER_VERSION } from '../lib/ratings/types'

nextEnv.loadEnvConfig(process.cwd())
if (process.env.ALLOW_USAGE_DB_TEST !== '1')
  throw new Error('Set ALLOW_USAGE_DB_TEST=1 only with a development database')
const cards = JSON.parse(
  await readFile(
    new URL('../data/card-catalogue.json', import.meta.url),
    'utf8',
  ),
) as CatalogueCard[]
const fixture = JSON.parse(
  await readFile(
    new URL('../tests/fixtures/modern-ranked-battle.json', import.meta.url),
    'utf8',
  ),
)
const sql = ratingDatabase()
const ids: string[] = []
await backfillBattleUsage(cards)
const before = await readCardBattleStats()
const evidenceBefore = await readEvidence()
const key = (s: CardBattleStats) => `${s.cardId}:${s.league}:${s.format}`
const baseline = new Map(before.map((s) => [key(s), s]))
try {
  const details = JSON.parse(fixture.details)
  details.team1.summoner.level = 1
  details.team2 = structuredClone(details.team1)
  details.team2.player = fixture.player_2
  const raw = {
    ...fixture,
    battle_queue_id_1: `test_${randomUUID().replaceAll('-', '')}`,
    battle_queue_id_2: `test_${randomUUID().replaceAll('-', '')}`,
    created_date: '2020-01-01T00:00:00Z',
    details: JSON.stringify(details),
  }
  const battle = parseBattle(raw, cards)!
  assert.ok(battle.eligible)
  ids.push(battle.id)
  await saveCollectedBattle(battle, 'manual-replay')
  assert.deepEqual(
    await readCardBattleStats(),
    before,
    'Research replays must not inflate usage totals',
  )
  await saveCollectedBattle(battle, 'history')
  await saveCollectedBattle(battle, 'history')
  const rows = await readCardBattleStats()
  for (const u of battle.cardUsage.filter((u) => u.side === 1)) {
    const actual = rows.find(
      (r) =>
        r.cardId === u.cardId &&
        r.league === battle.league &&
        r.format === battle.format,
    )!
    const prior = baseline.get(key(actual))
    assert.equal(
      actual.uses - (prior?.uses ?? 0),
      2,
      'Mirrors count two team uses, duplicate replay does not add uses',
    )
    assert.equal(actual.wins - (prior?.wins ?? 0), 1)
    assert.equal(actual.losses - (prior?.losses ?? 0), 1)
  }
  const draw = parseBattle(
    {
      ...raw,
      winner: 'DRAW',
      format: null,
      settings: JSON.stringify({ rating_level: 4 }),
      battle_queue_id_1: `test_${randomUUID().replaceAll('-', '')}`,
      battle_queue_id_2: `test_${randomUUID().replaceAll('-', '')}`,
    },
    cards,
    Date.now(),
    'wild',
  )!
  ids.push(draw.id)
  // Simulate an existing replay saved before the usage table was introduced.
  await saveCollectedBattle(
    { ...draw, parserVersion: PARSER_VERSION - 1, cardUsage: [] },
    'history',
  )
  assert.equal(await backfillBattleUsage(cards), 1)
  assert.equal(
    (
      await sql`SELECT raw->'format' AS original_format, format FROM rating_battles WHERE id=${draw.id}`
    )[0].format,
    'wild',
    'Backfill must retain authenticated history context for null-format Wild replays',
  )
  assert.equal(
    await backfillBattleUsage(cards),
    0,
    'Backfill is resumable and idempotent',
  )
  const after = await readCardBattleStats()
  for (const u of draw.cardUsage.filter((u) => u.side === 1)) {
    const actual = after.find(
      (r) =>
        r.cardId === u.cardId &&
        r.league === draw.league &&
        r.format === 'wild',
    )!
    const prior = baseline.get(key(actual))
    assert.equal(actual.uses - (prior?.uses ?? 0), 2)
    assert.equal(actual.draws - (prior?.draws ?? 0), 2)
    assert.equal(actual.wins, prior?.wins ?? 0)
    assert.equal(actual.losses, prior?.losses ?? 0)
  }
  const counts = (evidence: Awaited<ReturnType<typeof readEvidence>>) =>
    Object.fromEntries(
      Object.entries(evidence).map(([scope, e]) => [
        scope,
        {
          battles: e.battles,
          wins: e.wins,
          draws: e.draws,
          players: e.players,
        },
      ]),
    )
  assert.deepEqual(
    counts(await readEvidence()),
    counts(evidenceBefore),
    'Lifetime usage must not change the 90-day strength sample',
  )
  const newer = {
    ...draw,
    parserVersion: PARSER_VERSION + 1,
    cardUsage: draw.cardUsage.slice(0, 1),
  }
  await saveCollectedBattle(newer, 'history')
  await saveCollectedBattle(draw, 'history')
  assert.equal(
    (
      await sql`SELECT count(*)::int AS n FROM rating_card_usage WHERE battle_id=${draw.id}`
    )[0].n,
    1,
    'Reprocessing replaces usage atomically and older parsers cannot overwrite it',
  )
  console.log(
    'PASS: lifetime usage, mirrors, underlevelled summoners, wins/losses/draws, format scopes, source bias, replay deduplication, backfill and parser concurrency',
  )
} finally {
  for (const id of ids) await sql`DELETE FROM rating_battles WHERE id=${id}`
}
