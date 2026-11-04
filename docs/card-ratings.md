# Card and ability ratings

Ratings combine curated mechanic-based scores with daily ranked-battle evidence.
The current engine is `practical-3.0`. Cards, abilities, admin previews, publication,
tier references and public APIs all use the same engine and summary reads.

## Storage and collection

The hourly collector parses ranked history and public queue replays in memory.
Only eligible, mapped matches enter storage. Shared/manual research captures are
ignored and no longer fetched. No raw replay or per-battle feature/usage rows are
retained. Parser changes apply to future samples, not already accepted battles.

Each accepted battle updates these tables in one SQL statement:

- `rating_seen`: hashed canonical battle ID, UTC day and queue IDs for deduplication.
- `rating_daily_evidence`: non-mirrored feature appearances, wins, draws, expected
  outcomes and standard-ruleset counts per UTC day/kind/subject/league/format.
- `rating_daily_usage`: distinct matches containing each card per day and scope.
- `rating_daily_totals`: qualifying matches per day and scope.
- `rating_lifetime_usage`: lifetime uses/wins/losses/draws per card and scope.
- `rating_totals`: lifetime accepted count, latest match and maintenance date.

All increments depend on the deduplication insert returning a row. Duplicate or
concurrent submissions therefore cannot inflate evidence or counters. Mirrored
cards count once for match share, twice for lifetime team appearances and never
for strength evidence. Underlevelled cards count for usage but not cap-level strength.

Daily evidence, usage, scope totals and deduplication IDs retain today plus the
previous 89 UTC days. The same boundary gates ingestion and reads, so an expired
ID cannot be reinserted with an old battle timestamp. Pending work expires after
two days or 12 attempts. Job logs retain 30 days. Maintenance runs once daily.
Lifetime counters remain when daily detail expires. Counter updates are atomic,
but historical corrections requiring replay detail need a new collection epoch
or separately supplied evidence; there is no replay archive to rebuild from.

Collection rotates account/format targets and favors scopes with less evidence.
A lease prevents overlapping scheduled runs. Optional authenticated history uses
server-only game credentials. Public queues remain usable without game login.
The hourly GitHub Actions job calls `/api/cron/collect-battles` using verified
OIDC identity. Admin calls use the existing authenticated admin route.

## Scoring

The practical baseline evaluates usable attacks, durability, support and affordable
partners across ten bounded situations. See [scoring-methodology.md](scoring-methodology.md)
for coefficients and [the score review](scoring-review-2026-11-04.md) for comparisons.
Situation summaries live only in the current replaceable score JSON, not a growing
history table. The daily evidence and collection model below is unchanged.

Curated mechanics, ability weights, conditional team contributions and league
caps remain configurable. The collector stores sufficient statistics to change
weights, decay and confidence thresholds without retaining individual matches.

For each daily bucket, weight = `0.5 ** (UTC day age / 30)` over the retained
90 calendar days. Effective samples sum `appearances * weight`. Adjusted result
rate is `clamp(0.5 + sum(weight * (wins + 0.5*draws - expected)) / effective, 0, 1)`.
Expected outcomes use the parser's pre-battle player-rating baseline, never
current account ratings. Raw rate counts draws as half wins.

Card strength needs 20 appearances, 15 effective samples and two days. Ability
strength needs 30 appearances, 20 effective samples and two days. Card weight is
`0.8 * effective/(effective+75) * min(1,days/3)`; abilities use `0.65`, `150` and
seven days. Five percentage points above/below expectation imply one potential
rating point before that confidence weighting. No usable evidence preserves the prior.

Card usage adds at most one point before confidence weighting, saturating at
20% decayed match share. It needs 20 card matches, 15 effective card matches,
50 effective scope matches and two days. Weight is
`totalEffective/(totalEffective+100) * effective/(effective+30) * min(1,days/3)`.
Cards never receive a penalty for being unobserved. Abilities have no usage bonus.
Final scores are bounded to 0–10.

Confidence is curated, early, moderate (150 effective strength samples and seven
days) or strong (500 and 14 days). Distinct-player counts and account-volume caps
are deliberately omitted. Repeated accounts, bots, ownership and correlated
lineups can bias estimates. Confidence measures sample size/time coverage, not
causal certainty or player diversity.

## Reads, publication and retention

Public lifetime statistics read the small counter table. Rating refreshes read
SQL-aggregated daily summaries. Public score APIs and card pages retain their
score shapes except removal of `evidence.players` and `evidence.usage.players`.
The UI reports sample days and no longer claims player-diversity protection.

Only the active score snapshot is retained. Publication swaps it atomically,
prunes previous scores and invalidates caches. Published profile configurations
remain for audit and draft restoration. Restoring a profile restores weights;
it does not restore historical scores. Collection refreshes at most daily unless
an admin requests a refresh. Deploying a new engine refreshes once.

Migrations 009–010 aggregate existing production detail before dropping the raw,
observation and usage tables. Existing lifetime counts are retained. The score
table is rebuilt once to reclaim obsolete snapshot storage. Old application
versions are incompatible with this schema: deploy the new app with the migration.

## Verification

```
npm test
npm run typecheck
npm run lint
npm run build
npm run db:migrate
npm run ratings:init
# Disposable migrated database only; resets rating evidence:
ALLOW_LEAN_DB_TEST=1 npm run test:lean-db
# Local app connected to a development database:
npm run test:ratings-db
```

The lean database suite checks concurrent deduplication, transaction rollback,
mirror semantics, scope isolation, expected outcomes, retention boundaries,
current-only snapshots, stale publication and sparse price observations.
