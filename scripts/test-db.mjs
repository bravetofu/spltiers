import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { SignJWT } from 'jose'
import { database } from './database.mjs'

const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local test server connected to a development database')
const sql = database()
const secret = new TextEncoder().encode(process.env.JWT_SECRET)
const token = await new SignJWT({ account: process.env.NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT ?? 'brave.sps' })
  .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('5m').sign(secret)
const slug = `migration-test-${randomUUID()}`
let setId
async function request(path, method = 'GET', body, cookie = token) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: `admin_token=${cookie}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  })
}
async function eventually(check) {
  for (let attempt = 0; attempt < 10; attempt++) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.fail('ISR did not refresh within 5 seconds')
}
try {
  assert.equal((await request('/api/admin/card-sets', 'POST', { name: 'No auth', slug }, null)).status, 401)
  const wrongAccount = await new SignJWT({ account: 'not-the-admin' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('5m').sign(secret)
  assert.equal((await request('/api/admin/card-sets', 'POST', { name: 'Wrong auth', slug }, wrongAccount)).status, 401)
  const created = await request('/api/admin/card-sets', 'POST', { name: 'Migration test', slug, sort_order: 10000 })
  assert.equal(created.status, 201)
  const set = await created.json()
  setId = set.id
  assert.equal(typeof set.created_at, 'string')
  const entry = {
    set_id: setId, card_id: 2000000000, card_name: "Test's parameterized card", edition: 'Migration test',
    cdn_slug: 'beta', rarity: 1, tier: 'S', role: 'test role', notes: "Quoted 'notes'; SELECT 1;", is_soulbound: false,
  }
  const save = (entries, id = setId) => request('/api/admin/save-tiers', 'POST', { set_id: id, entries })
  assert.equal((await request('/api/admin/save-tiers', 'POST', { set_id: setId, entries: [entry] }, null)).status, 401)
  assert.equal((await save([entry])).status, 200)
  let rows = await sql`SELECT * FROM tier_entries WHERE set_id = ${setId}`
  assert.equal(rows.length, 1)
  assert.equal(rows[0].notes, entry.notes)
  const beforeFailureId = rows[0].id
  const deck = await (await request('/api/tier-entries')).json()
  assert.equal(deck.find((row) => row.card_id === entry.card_id)?.tier, 'S')
  assert.equal((await request(`/tier-list/${slug}`)).status, 200)
  assert.ok((await (await request('/tier-list/all')).text()).includes("Test&#x27;s parameterized card"))
  await eventually(async () => (await (await request('/sitemap.xml')).text()).includes(`/tier-list/${slug}`))
  assert.equal((await save([{ ...entry, set_id: randomUUID() }])).status, 400)
  assert.equal((await save([entry, entry])).status, 400)
  // A safe JS integer outside Postgres int4 range fails after the transaction's delete.
  assert.equal((await save([{ ...entry, card_id: 2147483648 }])).status, 500)
  rows = await sql`SELECT * FROM tier_entries WHERE set_id = ${setId}`
  assert.equal(rows[0].id, beforeFailureId, 'Failed replacement must roll back its delete')
  assert.equal(rows[0].notes, entry.notes)
  assert.equal((await request('/api/admin/card-sets', 'PATCH', { id: setId, is_active: false })).status, 200)
  await eventually(async () => (await (await request(`/tier-list/${slug}`)).text()).includes('content="noindex"'))
  await eventually(async () => !(await (await request('/sitemap.xml')).text()).includes(`/tier-list/${slug}`))
  assert.equal((await request('/api/admin/card-sets', 'PATCH', { id: setId, is_active: true })).status, 200)
  await eventually(async () => !(await (await request(`/tier-list/${slug}`)).text()).includes('content="noindex"'))
  assert.equal((await save([{ ...entry, tier: 'A', notes: 'Updated notes' }])).status, 200)
  await eventually(async () => (await (await request(`/tier-list/${slug}`)).text()).includes('Updated notes'))
  assert.equal((await save([])).status, 200)
  assert.equal((await sql`SELECT id FROM tier_entries WHERE set_id = ${setId}`).length, 0)
  assert.equal((await save([], randomUUID())).status, 404)
  console.log('PASS: auth, create, save/read, parameterization, validation, transaction rollback, publication, ISR, sitemap, clear')
} finally {
  if (setId) {
    await request('/api/admin/card-sets', 'PATCH', { id: setId, is_active: false }).catch(() => {})
    await sql`DELETE FROM card_sets WHERE id = ${setId}`
  }
}
