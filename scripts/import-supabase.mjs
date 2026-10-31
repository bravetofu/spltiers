import { mkdir, writeFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { database } from './database.mjs'

const sql = database()
const once = process.argv.includes('--once')
const marker = 'supabase-data-import'
if (once && (await sql`SELECT version FROM app_migrations WHERE version = ${marker}`).length) {
  console.log('Supabase import already completed; no source credentials needed')
  process.exit(0)
}
const base = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!base || !key) throw new Error('Source NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the one-time import')
const tables = ['card_sets', 'tier_entries']

async function readSource(table) {
  const rows = []
  let expected
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${base}/rest/v1/${table}?select=*&order=id&offset=${offset}&limit=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error(`Source ${table}: HTTP ${response.status}`)
    const total = Number(response.headers.get('content-range')?.split('/')[1])
    if (!Number.isSafeInteger(total)) throw new Error(`Missing source count for ${table}`)
    if (expected !== undefined && expected !== total) throw new Error(`Source ${table} changed during export; retry while admin editing is paused`)
    expected = total
    const page = await response.json()
    rows.push(...page)
    if (rows.length >= expected || page.length === 0) break
  }
  if (rows.length !== expected) throw new Error(`Incomplete export of ${table}`)
  return rows
}

function normalize(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key, key.endsWith('_at') && value ? new Date(value).toISOString().replace(/\.\d{3}Z$/, `.${(String(value).match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0')}Z`) : value,
  ]))).sort((a, b) => a.id.localeCompare(b.id))
}

const source = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await readSource(table)])))
const verifyOnly = process.argv.includes('--verify')
if (!verifyOnly) {
  const [counts] = await sql`SELECT (SELECT count(*) FROM card_sets)::int AS sets, (SELECT count(*) FROM tier_entries)::int AS entries`
  if (counts.sets || counts.entries) throw new Error('Destination is not empty. Refusing to overwrite existing data; use --verify to compare it.')
  await mkdir('.migration-backups', { recursive: true, mode: 0o700 })
  await writeFile(`.migration-backups/supabase-${Date.now()}.json`, JSON.stringify(source, null, 2), { mode: 0o600 })
  await sql.transaction([
    sql`INSERT INTO card_sets SELECT * FROM jsonb_populate_recordset(NULL::card_sets, ${JSON.stringify(source.card_sets)}::jsonb)`,
    sql`INSERT INTO tier_entries SELECT * FROM jsonb_populate_recordset(NULL::tier_entries, ${JSON.stringify(source.tier_entries)}::jsonb)`,
  ])
}
for (const table of tables) {
  // Identifiers come from the fixed list above, never user input.
  const destination = (await sql.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY id`)).map((result) => result.row)
  if (!isDeepStrictEqual(normalize(source[table]), normalize(destination))) throw new Error(`${table}: source/destination mismatch`)
  console.log(`${table}: all ${destination.length} rows match (IDs, values and timestamps)`)
}
if (!verifyOnly) await sql`INSERT INTO app_migrations (version) VALUES (${marker}) ON CONFLICT DO NOTHING`
console.log(verifyOnly ? 'Verification complete' : 'Import and verification complete; source was not changed')
