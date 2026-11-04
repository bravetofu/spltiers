import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import nextEnv from '@next/env'
import { SignJWT } from 'jose'
import { ratingDatabase, readWorkspace } from '../lib/ratings/store'
import { runCollector } from '../lib/ratings/collector'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
nextEnv.loadEnvConfig(process.cwd())
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Use a local server connected to a development database')
const sql = ratingDatabase(),
  original = await readWorkspace(),
  marker = `ratings-test-${randomUUID()}`
assert.ok(original.workspace)
const admin = process.env.NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT ?? 'brave.sps'
const sign = (account: string) =>
  new SignJWT({ account })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET))
const token = await sign(admin),
  wrong = await sign('not-admin')
async function request(
  path: string,
  body?: unknown,
  cookie: string | null = token,
  headers: Record<string, string> = {},
) {
  return fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: `admin_token=${cookie}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(180000),
  })
}
const publicAbility = async () =>
  (
    (
      await (
        await request('/api/ratings?kind=ability&league=diamond&format=modern')
      ).json()
    ).items as { name: string; score: number }[]
  ).find((r) => r.name === 'Heal')!.score
const testProfiles: string[] = [],
  testBattles: string[] = []
try {
  assert.equal(
    (await request('/api/admin/ratings', undefined, null)).status,
    401,
  )
  assert.equal(
    (await request('/api/admin/ratings', undefined, wrong)).status,
    401,
  )
  assert.equal(
    (
      await request(
        '/api/admin/ratings',
        { action: 'preview', config: {} },
        null,
      )
    ).status,
    401,
  )
  assert.equal((await request('/api/ratings?league=nonsense')).status, 400)
  assert.equal(
    (await request('/api/cron/collect-battles', undefined, null)).status,
    401,
  )
  const originalScore = await publicAbility(),
    config = structuredClone(original.workspace!.draft)
  config.abilities.Heal.standard = 1
  config.abilities.Heal.nonStandard = 1
  config.abilities.Heal.multiplier = 1
  config.abilities.Heal.notes = 'Integration test; restored in finally.'
  const invalid = structuredClone(config)
  invalid.abilities.Heal.standard = 20
  assert.equal(
    (
      await request('/api/admin/ratings', {
        action: 'save',
        config: invalid,
        revision: original.workspace!.revision,
      })
    ).status,
    400,
  )
  const saved = await request('/api/admin/ratings', {
    action: 'save',
    config,
    revision: original.workspace!.revision,
  })
  assert.equal(saved.status, 200)
  let revision = (await saved.json()).revision
  assert.equal(await publicAbility(), originalScore, 'Draft must stay private')
  assert.equal(
    (
      await request('/api/admin/ratings', {
        action: 'save',
        config,
        revision: original.workspace!.revision,
      })
    ).status,
    409,
  )
  const preview = await request('/api/admin/ratings', {
    action: 'preview',
    config,
  })
  assert.equal(preview.status, 200)
  assert.ok((await preview.json()).count > 5000)
  assert.equal(await publicAbility(), originalScore, 'Preview must not publish')
  const publish = {
    action: 'publish',
    revision,
    label: marker,
    notes: 'Integration test publication; removed after verification.',
  }
  const concurrent = await Promise.all([
    request('/api/admin/ratings', publish),
    request('/api/admin/ratings', publish),
  ])
  assert.deepEqual(
    concurrent.map((r) => r.status).sort(),
    [200, 409],
    'Concurrent publication must have one winner',
  )
  for (const response of concurrent)
    if (response.status === 200) revision = (await response.json()).revision
  const versions =
    await sql`SELECT id::text FROM rating_profiles WHERE label = ${marker}`
  testProfiles.push(...versions.map((r) => r.id))
  assert.equal(versions.length, 1)
  assert.equal(
    await publicAbility(),
    1,
    'Published ability prior must be visible after cache invalidation',
  )
  const count =
    await sql`SELECT count(*)::int AS n FROM rating_scores s JOIN rating_workspace w ON w.active_snapshot_id=s.snapshot_id WHERE w.singleton`
  assert.ok(
    count[0].n > 6000,
    'Publication must include the whole score snapshot',
  )
  for (let i = 0; i < 4; i++)
    assert.equal(
      (await request('/api/admin/ratings', { action: 'refresh' })).status,
      200,
    )
  assert.equal(
    (await sql`SELECT id FROM rating_snapshots`).length,
    1,
    'Only the current snapshot is retained',
  )
  const restored = await request('/api/admin/ratings', {
    action: 'restore',
    profileId: original.workspace!.active_profile_id,
    revision,
  })
  assert.equal(restored.status, 200)
  assert.equal(
    await publicAbility(),
    1,
    'Restoring a draft must not publish it',
  )

  const cards = JSON.parse(
    await readFile(
      new URL('../data/card-catalogue.json', import.meta.url),
      'utf8',
    ),
  ) as CatalogueCard[]
  const snapshotBefore = (
    await sql`SELECT active_snapshot_id::text FROM rating_workspace WHERE singleton`
  )[0].active_snapshot_id
  const collection = await runCollector(cards, {
    maxRequests: 0,
    durationMs: 0,
  })
  assert.equal(
    'ratingsRefreshed' in collection && collection.ratingsRefreshed,
    false,
  )
  assert.equal(
    (
      await sql`SELECT active_snapshot_id::text FROM rating_workspace WHERE singleton`
    )[0].active_snapshot_id,
    snapshotBefore,
    'Frequent collection must reuse a fresh score snapshot',
  )
  const lease = randomUUID()
  const claimed =
    await sql`UPDATE rating_job_lease SET owner=${lease}::uuid,expires_at=now()+interval '1 minute' WHERE singleton AND (expires_at IS NULL OR expires_at<now()) RETURNING owner`
  if (claimed.length && process.env.CRON_SECRET)
    try {
      assert.equal(
        (
          await request('/api/cron/collect-battles', undefined, null, {
            Authorization: `Bearer ${'é'.repeat(process.env.CRON_SECRET.length)}`,
          })
        ).status,
        401,
      )
      const busy = await request('/api/cron/collect-battles', undefined, null, {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      })
      assert.equal(busy.status, 200)
      assert.equal((await busy.json()).status, 'busy')
    } finally {
      await sql`UPDATE rating_job_lease SET owner=NULL,expires_at=NULL WHERE singleton AND owner=${lease}::uuid`
    }
  else if (claimed.length)
    await sql`UPDATE rating_job_lease SET owner=NULL,expires_at=NULL WHERE singleton AND owner=${lease}::uuid`
  console.log(
    'PASS: authorization, validation, private drafts, preview, optimistic concurrency, atomic publication, cache invalidation, curation history, bounded snapshots and cron lease/auth',
  )
} finally {
  await sql`UPDATE rating_workspace SET draft=${JSON.stringify(original.workspace!.draft)}::jsonb,revision=${original.workspace!.revision},active_profile_id=${original.workspace!.active_profile_id}::uuid,active_snapshot_id=NULL WHERE singleton`
  const cleanupProfiles =
    await sql`SELECT id::text FROM rating_profiles WHERE label=${marker}`
  for (const { id } of cleanupProfiles) {
    await sql`DELETE FROM rating_snapshots WHERE profile_id=${id}::uuid`
    await sql`DELETE FROM rating_profiles WHERE id=${id}::uuid`
  }
  await request('/api/admin/ratings', { action: 'refresh' })
}
