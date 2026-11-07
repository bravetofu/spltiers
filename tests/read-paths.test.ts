import assert from 'node:assert/strict'
import { test } from 'node:test'
import { neonConfig } from '@neondatabase/serverless'
import { readPriceHistory } from '../lib/market/store'
import { runCollector } from '../lib/ratings/collector'
import { publicScores } from '../lib/ratings/store'

type Query = { query: string; params: unknown[] }
const wire = (rows: Record<string, unknown>[]) => {
  const keys = Object.keys(rows[0] ?? {})
  return {
    fields: keys.map((name) => ({ name, dataTypeID: 3802 })),
    rows: rows.map((r) => keys.map((k) => JSON.stringify(r[k]))),
    rowCount: rows.length,
    command: 'SELECT',
  }
}
async function withDatabase(
  respond: (query: Query) => Record<string, unknown>[],
  run: () => Promise<void>,
) {
  const oldFetch = neonConfig.fetchFunction
  const oldUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://test:test@database.invalid/test'
  neonConfig.fetchFunction = async (_input: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body))
    return Response.json(
      request.queries
        ? { results: request.queries.map((q: Query) => wire(respond(q))) }
        : wire(respond(request)),
    )
  }
  try {
    await run()
  } finally {
    neonConfig.fetchFunction = oldFetch
    if (oldUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = oldUrl
  }
}

test('compact price reads preserve all foils, empty markets, gaps and the original first day', async () => {
  const days = [
    {
      day: '2026-11-01',
      observedAt: '2026-11-01 02:17:00+00',
      prices: [
        [0, 0.3, null, 7],
        [4, 50, 60, 2],
      ],
    },
    { day: '2026-11-03', observedAt: '2026-11-03 02:17:00+00', prices: [] },
  ]
  await withDatabase(
    ({ query, params }) => {
      assert.deepEqual(params, ['780', '17'])
      return query.includes('min(day)') ? [{ day: '2025-01-01' }] : days
    },
    async () => {
      const result = await readPriceHistory(780, 17)
      assert.equal(result.firstDay, '2025-01-01')
      assert.deepEqual(
        result.points,
        days.flatMap((day) =>
          Array.from({ length: 5 }, (_, foil) => {
            const p = day.prices.find((p) => p[0] === foil)
            return {
              day: day.day,
              observedAt: day.observedAt,
              foil,
              perBcx: p?.[1] ?? null,
              singleBcx: p?.[2] ?? null,
              listings: p?.[3] ?? 0,
            }
          }),
        ),
      )
      assert.ok(result.points.every((p) => p.day !== '2026-11-02'))
    },
  )
  await withDatabase(
    () => [],
    async () => {
      assert.deepEqual(await readPriceHistory(780, 17), {
        points: [],
        firstDay: null,
      })
    },
  )
})

test('aggregated ability reads retain publication metadata and opt into summaries', async () => {
  const full = {
    name: 'Triage',
    score: 7.5,
    confidence: 'early',
    evidence: { battles: 42, wins: 24 },
  }
  const summary = { ...full, evidence: { battles: 42 } }
  await withDatabase(
    ({ params }) =>
      params.includes('missing')
        ? []
        : [
            {
              items: [
                [true, 'true', 't'].includes(params[0] as string | boolean)
                  ? summary
                  : full,
              ],
              profile_id: 'profile',
              label: 'Published',
              notes: 'Curator notes',
              author: 'curator',
              published_at: '2026-11-01',
              scored_at: '2026-11-07',
            },
          ],
    async () => {
      const result = await publicScores('ability', 'diamond', 'modern')
      assert.deepEqual(result.items, [full])
      assert.deepEqual(result.publication, {
        id: 'profile',
        label: 'Published',
        notes: 'Curator notes',
        author: 'curator',
        publishedAt: '2026-11-01',
      })
      assert.equal(result.scoredAt, '2026-11-07')
      assert.deepEqual(
        (
          await publicScores(
            'ability',
            'diamond',
            'modern',
            undefined,
            true,
            true,
          )
        ).items,
        [summary],
      )
      assert.deepEqual(
        await publicScores('ability', 'diamond', 'modern', 'missing'),
        { items: [], publication: null, scoredAt: undefined },
      )
    },
  )
})

test('collector reads the profile only for due/forced refreshes and reloads it after a publication race', async () => {
  for (const scenario of [
    'fresh',
    'due',
    'missing',
    'forced',
    'race',
  ] as const) {
    let profiles = 0,
      snapshots = 0
    await withDatabase(
      ({ query }) => {
        if (query.includes('RETURNING owner')) return [{ owner: 'test' }]
        if (query.includes('SELECT created_at FROM rating_snapshots'))
          return scenario === 'missing'
            ? []
            : [
                {
                  created_at: new Date(
                    Date.now() - (scenario === 'due' ? 86401000 : 1000),
                  ).toISOString(),
                },
              ]
        if (query.includes('SELECT p.id::text, p.config')) {
          profiles++
          return [{ id: `profile-${profiles}`, config: { abilities: {} } }]
        }
        if (query.includes('UPDATE rating_workspace SET active_snapshot_id')) {
          snapshots++
          return scenario === 'race' && snapshots === 1 ? [] : [{ revision: 1 }]
        }
        return []
      },
      async () => {
        const result = await runCollector([], {
          maxRequests: 0,
          durationMs: 0,
          refreshRatings: ['forced', 'race'].includes(scenario),
        })
        assert.equal(result.status, 'completed', scenario)
        assert.equal(result.ratingsRefreshed, scenario !== 'fresh', scenario)
        const expected = scenario === 'fresh' ? 0 : scenario === 'race' ? 2 : 1
        assert.equal(profiles, expected, scenario)
        assert.equal(snapshots, expected, scenario)
      },
    )
  }
})
