import nextEnv from '@next/env'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  ratingDatabase,
  readWorkspace,
  writeSnapshot,
} from '../lib/ratings/store'
import { allRatings } from '../lib/ratings/engine'
import { checkedProfile } from '../lib/ratings/validation'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
nextEnv.loadEnvConfig(process.cwd())
const config = checkedProfile(
  JSON.parse(
    await readFile(
      new URL('../data/rating-profile.json', import.meta.url),
      'utf8',
    ),
  ),
)
const cards = JSON.parse(
  await readFile(
    new URL('../data/card-catalogue.json', import.meta.url),
    'utf8',
  ),
) as CatalogueCard[]
const sql = ratingDatabase()
await sql`INSERT INTO rating_workspace (singleton, draft) VALUES (true, ${JSON.stringify(config)}::jsonb) ON CONFLICT (singleton) DO NOTHING`
const { workspace } = await readWorkspace()
if (!workspace?.active_profile_id) {
  const scores = allRatings(cards, config)
  const revision = await writeSnapshot(randomUUID(), scores, {
    config,
    revision: workspace!.revision,
    label: 'Beta 1 · initial curated prior',
    notes:
      'Provisional mechanic-based starting weights, inspired by SplinterGuide. No historical card fudge factors were copied. Battle influence remains zero until the evidence gates are met.',
    author: 'initial setup',
  })
  if (revision)
    console.log(
      `Initialized ratings: ${scores.cards.length} card scopes, ${scores.abilities.length} ability scopes`,
    )
} else
  console.log(
    'Published rating profile already exists; preserved all curation.',
  )

// Start the initial production collection once; scheduled and admin runs handle subsequent ingestion.
if (
  process.env.VERCEL_ENV === 'production' &&
  !(await sql`SELECT id FROM rating_job_runs LIMIT 1`).length
) {
  const { runCollector } = await import('../lib/ratings/collector')
  console.log(
    JSON.stringify(
      await runCollector(cards, { maxRequests: 60, durationMs: 60000 }),
    ),
  )
}
