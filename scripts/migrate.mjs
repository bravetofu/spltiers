import { readdir, readFile } from 'node:fs/promises'
import { database } from './database.mjs'

const sql = database()
await sql`CREATE TABLE IF NOT EXISTS app_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
for (const name of (await readdir(new URL('../db/migrations/', import.meta.url))).filter((name) => name.endsWith('.sql')).sort()) {
  if ((await sql`SELECT version FROM app_migrations WHERE version = ${name}`).length) continue
  const text = await readFile(new URL(`../db/migrations/${name}`, import.meta.url), 'utf8')
  // Initial migrations contain plain DDL, without function bodies or embedded semicolons.
  const statements = text.split(';').map((s) => s.trim()).filter(Boolean)
  await sql.transaction([
    ...statements.map((statement) => sql.query(statement)),
    sql`INSERT INTO app_migrations (version) VALUES (${name})`,
  ])
  console.log(`Applied ${name}`)
}
console.log('Schema is up to date')
