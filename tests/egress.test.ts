import assert from 'node:assert/strict'
import { test } from 'node:test'
import Module from 'node:module'
import { AsyncLocalStorage } from 'node:async_hooks'
import { neonConfig } from '@neondatabase/serverless'
import { expandScoreParts, SCORE_NOTES } from '../lib/ratings/score-notes'
import { readCardBattleStats } from '../lib/ratings/store'
import { priceHistoryTag } from '../lib/market/cache'

const reference = Object.keys(SCORE_NOTES)[0]
test('compact explanations expand losslessly and retain arbitrary curator notes', () => {
  const original = [
    { label: 'Known', value: 1, note: SCORE_NOTES[reference] },
    { label: 'Custom', value: -0.3, note: "Curator's new explanation 🐉" },
    { label: 'No note', value: 0 },
  ]
  const wire = [
    { label: 'Known', value: 1, noteRef: reference },
    ...original.slice(1),
  ]
  assert.deepEqual(expandScoreParts(wire), original)
  assert.deepEqual(expandScoreParts(original), original)
  assert.throws(() =>
    expandScoreParts([{ label: 'Missing', value: 1, noteRef: 'unknown' }]),
  )
})

test('score caches survive collection updates while scoped statistics refresh independently', async () => {
  // server-only is a build boundary marker; this test runs the real Next cache.
  const moduleLoader = Module as unknown as {
    _load: (name: string, ...args: unknown[]) => unknown
  }
  const load = moduleLoader._load
  moduleLoader._load = function (name, ...args) {
    return name === 'server-only' ? {} : load.call(this, name, ...args)
  }
  Object.assign(globalThis, { AsyncLocalStorage })
  const priorUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://test:test@database.invalid/test'
  const oldFetch = neonConfig.fetchFunction
  const globalCache = globalThis as unknown as { __incrementalCache?: unknown }
  const oldCache = globalCache.__incrementalCache
  let clock = 0,
    uses = 10,
    score = 7
  const entries = new Map<
    string,
    { value: unknown; at: number; revalidate: number; tags: string[] }
  >()
  const expire = (tag: string) => {
    for (const [key, entry] of Array.from(entries))
      if (entry.tags.includes(tag)) entries.delete(key)
  }
  globalCache.__incrementalCache = {
    fetchCacheKey: async (key: string) => key,
    get: async (key: string) => {
      const entry = entries.get(key)
      return entry
        ? { value: entry.value, isStale: clock - entry.at >= entry.revalidate }
        : null
    },
    set: async (
      key: string,
      value: unknown,
      options: { revalidate: number; tags: string[] },
    ) => {
      entries.set(key, { value, at: clock, ...options })
    },
  }
  const calls: { query: string; params: unknown[] }[] = []
  neonConfig.fetchFunction = async (_input: unknown, init?: RequestInit) => {
    const query = JSON.parse(String(init?.body))
    calls.push(query)
    assert.equal(
      init?.cache,
      'no-store',
      'No untagged HTTP cache under the data cache',
    )
    let rows: Record<string, unknown>[]
    if (query.query.includes('rating_lifetime_usage')) {
      const [id, , league, , format] = query.params
      assert.ok(
        id !== null || league !== null,
        'Public pages cannot request the entire lifetime table',
      )
      rows = [
        {
          card_id: id ?? 512,
          league: league ?? 'diamond',
          format: format ?? 'wild',
          uses,
          wins: 6,
          losses: 4,
          draws: 0,
        },
      ]
    } else if (query.query.includes('DISTINCT ON')) {
      rows = [
        {
          subject: '512',
          score,
          confidence: 'early',
          battles: 20,
          format: 'wild',
        },
      ]
    } else {
      assert.ok(query.query.includes('jsonb_agg'))
      assert.ok(query.query.includes('ORDER BY part.ordinality'))
      rows = [
        {
          data: { cardId: 512, league: 'diamond', format: 'wild', score },
          parts: [{ label: 'Known', value: 1, noteRef: reference }],
          label: 'Published',
          id: 'test',
          scored_at: '2026-11-05',
          engine_version: 'practical-3.1',
        },
      ]
    }
    const keys = Object.keys(rows[0])
    return Response.json({
      fields: keys.map((name) => ({ name, dataTypeID: 3802 })),
      rows: rows.map((r) => keys.map((k) => JSON.stringify(r[k]))),
      rowCount: rows.length,
      command: 'SELECT',
    })
  }
  try {
    const server = await import('../lib/ratings/server')
    const first = await server.getCardRatings(512)
    assert.equal(first.ratings[0].parts[0].note, SCORE_NOTES[reference])
    assert.equal(first.battleStats![0].uses, 10)
    assert.equal(calls.length, 2)
    clock = 600
    await server.getCardRatings(512)
    assert.equal(calls.length, 2, 'No five-minute refill')
    uses = 20
    score = 8
    expire('rating-collection')
    const collected = await server.getCardRatings(512)
    assert.equal(collected.battleStats![0].uses, 20)
    assert.equal(collected.ratings[0].score, 7)
    assert.equal(calls.length, 3, 'Collection refills only stats')
    expire('ratings')
    assert.equal((await server.getCardRatings(512)).ratings[0].score, 8)
    assert.equal(calls.length, 4, 'Publication refills only scores')
    const index = await server.getRatingIndex('diamond', 'wild')
    assert.equal(index['512'][0], 8)
    assert.equal(index['512'][4]!.uses, 20)
    assert.deepEqual(calls.at(-1)!.params, [
      null,
      null,
      'diamond',
      'diamond',
      'wild',
      'wild',
    ])
    await server.getRatingIndex('diamond', 'auto')
    assert.deepEqual(calls.at(-1)!.params, [
      null,
      null,
      'diamond',
      'diamond',
      null,
      null,
    ])
    await readCardBattleStats(false, { cardId: 777 })
    assert.deepEqual(calls.at(-1)!.params, [
      '777',
      '777',
      null,
      null,
      null,
      null,
    ])
  } finally {
    moduleLoader._load = load
    neonConfig.fetchFunction = oldFetch
    globalCache.__incrementalCache = oldCache
    if (priorUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = priorUrl
  }
})

test('price history invalidation isolates both card and edition', () => {
  assert.notEqual(priceHistoryTag(1, 2), priceHistoryTag(2, 2))
  assert.notEqual(priceHistoryTag(1, 2), priceHistoryTag(1, 3))
})

test('price collection invalidates committed observations even if another target fails', async () => {
  const { collectDailyPrices } = await import('../lib/market/collector')
  const priorUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://test:test@database.invalid/test'
  const oldFetch = neonConfig.fetchFunction
  let committed = false
  const notices: string[] = []
  const response = (rows: Record<string, unknown>[]) => {
    const keys = Object.keys(rows[0] ?? {})
    return {
      fields: keys.map((name) => ({ name, dataTypeID: 3802 })),
      rows: rows.map((r) => keys.map((k) => JSON.stringify(r[k]))),
      rowCount: rows.length,
      command: 'SELECT',
    }
  }
  neonConfig.fetchFunction = async (_input: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body))
    if (request.queries) {
      committed = true
      return Response.json({ results: request.queries.map(() => response([])) })
    }
    const q = request.query as string
    const rows = q.includes('RETURNING owner')
      ? [{ owner: 'test' }]
      : q.includes('AS day')
        ? [{ day: new Date().toISOString().slice(0, 10) }]
        : q.includes('SELECT completed_at')
          ? [{ completed_at: null }]
          : q.includes('ORDER BY attempts')
            ? [
                { card_id: 11, edition: 14 },
                { card_id: 12, edition: 14 },
              ]
            : q.includes('AS total')
              ? [{ total: 2, completed: 1, failed: 1 }]
              : []
    return Response.json(response(rows))
  }
  try {
    const result = await collectDailyPrices([], {
      fetcher: (async (input) =>
        new URL(String(input)).searchParams.get('card_detail_id') === '12'
          ? new Response('', { status: 500 })
          : Response.json([])) as typeof fetch,
      onSaved: (id, edition) => {
        assert.ok(committed, 'Invalidate only after the atomic write succeeds')
        notices.push(priceHistoryTag(id, edition))
      },
    })
    assert.equal(result.status, 'partial')
    assert.deepEqual(notices, [priceHistoryTag(11, 14)])
  } finally {
    neonConfig.fetchFunction = oldFetch
    if (priorUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = priorUrl
  }
})
