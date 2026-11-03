import nextEnv from '@next/env'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  ratingDatabase,
  readWorkspace,
  writeSnapshot,
  publishedConfig,
  readEvidence,
} from '../lib/ratings/store'
import { allRatings } from '../lib/ratings/engine'
import { checkedProfile } from '../lib/ratings/validation'
import {
  ABILITY_REVIEW,
  applyAbilityReview,
} from '../lib/ratings/curation-review'
import { ENGINE_VERSION } from '../lib/ratings/types'
import type { CatalogueCard } from '../lib/splinterlands/catalogue'
import { backfillBattleUsage } from '../lib/ratings/backfill'
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
console.log(
  `Reprocessed ${await backfillBattleUsage(cards)} stored battles for usage statistics.`,
)
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

// One-time, versioned player review. Merge only unchanged provisional weights;
// preserve custom published curation and independently merge the private draft.
if (
  !(
    await sql`SELECT id FROM rating_profiles WHERE label = ${ABILITY_REVIEW.label} LIMIT 1`
  ).length
) {
  const state = await readWorkspace()
  const published = await publishedConfig()
  if (published && state.workspace) {
    const reviewed = applyAbilityReview(published.config)
    const draft = applyAbilityReview(checkedProfile(state.workspace.draft))
    const revision = await writeSnapshot(
      randomUUID(),
      allRatings(cards, reviewed.config, await readEvidence()),
      {
        config: checkedProfile(reviewed.config),
        draft: checkedProfile(draft.config),
        revision: state.workspace.revision,
        label: ABILITY_REVIEW.label,
        notes:
          ABILITY_REVIEW.notes +
          (reviewed.preserved.length
            ? ` Preserved custom weights: ${reviewed.preserved.join(', ')}.`
            : ''),
        author: 'player-requested methodology review',
      },
    )
    if (!revision)
      throw new Error(
        'Concurrent curation changed during ability review; rerun initialization.',
      )
    console.log(
      `Published ability review: ${reviewed.changed.length} provisional weights updated; ${reviewed.preserved.length} custom weights preserved. Private draft changes retained.`,
    )
  }
}

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

// Recompute existing curation once when the scoring engine changes.
const active =
  await sql`SELECT engine_version FROM rating_snapshots WHERE id = (SELECT active_snapshot_id FROM rating_workspace WHERE singleton)`
if (active[0]?.engine_version !== ENGINE_VERSION) {
  const profile = await publishedConfig()
  if (profile)
    await writeSnapshot(
      profile.id,
      allRatings(cards, profile.config, await readEvidence()),
    )
}
