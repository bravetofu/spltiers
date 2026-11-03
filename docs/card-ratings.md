# Combat card and ability ratings

The public catalogue has 0–10 ratings for units and summoners. `/abilities`
lists ability strength, `/ability/[slug]` explains each mechanic and pairing,
and `/ratings/methodology` describes the published model and collection status.
Land has no combat rating. Tier lists remain separately curated.

## Context and model

[Scoring methodology](scoring-methodology.md) is the maintained reference for
ability/card interactions, coefficients, feedback, counterexamples and review
process. This document covers evidence, storage and collection operations.

Scores are separate for ranked Modern and Wild, at Bronze, Silver, Gold and
Diamond/Champion rarity caps. Wild battle ratings include Modern cards; the
catalogue's Wild filter still means Wild-exclusive cards.

`data/rating-profile.json` is the initial provisional profile, not a continuing
source of truth after publication. The pure engine in `lib/ratings/engine.ts`
uses cap-level stats, unlocked abilities, positive/negative pairings, stat and
ability interactions, attack flexibility and splinter versatility. Summoners
have separate team-effect weights and calibration; tactics use the strongest
alternative instead of adding mutually exclusive options. Initial weights are
inspired by the supplied SplinterGuide reference, without copying historical
card fudge factors. These starting numbers require player review and eventual
out-of-sample evaluation.

The raw subtotal uses a smooth fixed sigmoid calibration (unit center 5,
summoner center 2.5, scale 2). Curator adjustments apply in rating points after
calibration, with a combined ±2 limit for each card/scope. Notes are required.

Battle evidence estimates performance above/below a pre-battle Elo expectation
(400-point scale). Five percentage points of residual performance estimate one
rating point of adjustment around the curated baseline. Results at expectation
preserve that baseline. The current engine retains the separate win and usage contributions introduced in 1.2:

```
winWeight = 0.8 × effective / (effective + 75)
            × min(players / 15, 1) × min(days / 3, 1)
winAdjustment = winWeight × (clamp(curated + 20 × (adjustedRate - 0.5), 0, 10) - curated)
useWeight = totalEffective / (totalEffective + 100)
            × cardEffective / (cardEffective + 30)
            × min(cardPlayers / 15, 1) × min(cardDays / 3, 1)
useBonus = useWeight × min(weightedUseRate / 0.2, 1)
score = clamp(curated + winAdjustment + useBonus, 0, 10)
```

Card win adjustments require 20 non-mirrored cap-level appearances, five players
and 15 effective samples. Only the last 90 days count, with a 30-day half-life
and at most ten appearances per player, feature, scope and UTC day. Effective
sample mass is the sum of decayed weights. Underlevelled appearances and mirrors
cannot establish cap-level performance. Ability ratings retain the previous
30/5/20 gates, 0.65 × effective/(effective+150) × min(players/20,1) × min(days/7,1)
weight, and no usage bonus.

Use rate is distinct matches containing the card on either team divided by all
eligible matches in that format/cap in the last 90 days. A mirror counts once.
Underlevelled appearances count as selection evidence only. Both numerator and
denominator use identical match weights: time decay × min(1, 10 / maximum of
the two players’ daily match counts in this scope). Thus prolific accounts cannot
contribute more than ten effective matches per day. The UI shows the raw match
share, counts and weighted share. A bonus needs 20 card matches, five card users,
15 effective card matches and 50 effective scope matches. It is capped at one
point before confidence weighting, saturates at 20% match share and never
penalizes unobserved cards. Sampling, ownership and affordability confound usage.
The final breakdown separates baseline, win adjustment, usage bonus and bounds.

Moderate confidence requires 150 effective win samples, 15 players and seven
days; strong requires 500, 30 and 14. Usage alone can establish early confidence.
Both signals use the selected format and level cap; there is no cross-scope
borrowing. All daily refresh, admin preview/publication and deploy-init paths
read both evidence streams together. The engine version triggers a deployment
refresh without replacing published curation.

These are associations, not causal estimates. Teammates, bots, ownership,
rulesets and selection of leaderboard accounts remain confounders. Shared and
manual replays are research-only to avoid selective sharing contaminating
strength estimates. Battle data does not automatically rewrite curated weights.
Raw replays and versioned snapshots allow future parser and model improvements.

## Collection and API findings

### Public card battle results

Unit and summoner tables and detail pages show lifetime collected ranked uses,
wins, losses and win rate for the selected format and league cap. Details also
show draws. These are the collected sample, not global game totals. One card
appearance per team counts as a use, including underlevelled cards. A mirror
match contributes two uses (a win and a loss, or two draws). Win rate is
`wins / uses`; draws remain in the denominator, and an empty sample has no rate.
Shared/manual research replays, surrenders, incomplete/unresolved matches and
unmapped caps are excluded using the existing battle eligibility checks.

`rating_card_usage` records descriptive appearances separately from strength
observations. It has no 90-day cutoff, player-volume cap or time weighting.
Collector transactions deduplicate replays and replace derived rows atomically
when reprocessing. Deploy initialization backfills archived replays with parser
version 3. Cached public totals invalidate after collection, independently of
the daily rating snapshots. Rating evidence retains its stricter filters.

Format-filtered history responses supply context for legacy rows whose `format`
is null. Explicit replay formats and allowed-card settings take precedence.
Standalone unlabelled replay responses remain unmapped. The original raw format
is preserved and history context is restored from the stored format on reparse.
Non-ranked history rows are skipped before they can exhaust the ingestion cap.
Account/format selection balances scarce observed caps with exploration of
previously unchecked accounts. Unsupported-format pending replays stop
retrying, and fresh pending IDs precede repeated failures.

The default maxed table rechecks the public API after hydration, just like the
other level filters. A coverage message states how many matching cards have uses
and defaults to uses descending (name ascending breaks ties); an empty sample is identified explicitly.

### Collection schedule

GitHub Actions calls `/api/cron/collect-battles` every hour at minute 7 (24 scheduled runs per day); scheduled Actions can be delayed. The public repository uses a minimal runner without checkout. The GitHub job authenticates with a short-lived OIDC identity verified against the issuer, audience, repository and owner IDs, main branch, exact workflow path, and allowed event. No shared GitHub secret is needed. Manual server triggers can also use `Authorization: Bearer <CRON_SECRET>`; invalid identities fail closed. A database
lease prevents overlapping runs. Each run has request, time and replay limits;
pending IDs and a rotating player roster persist between runs. Migration 006
tracks last check per account/format and the most recent observed cap, seeded
from existing eligible battles. Recent (90-day) scope counts prioritize known
underrepresented caps; unknown accounts use their format’s average coverage.
Every fifth planned history request explores the longest-unchecked target.
Planning adds 20 estimated matches per allocated scope slot to spread the
budget. Cap observations older than 30 days become unknown. Leaderboard labels
are discovery hints, never a substitute for replay eligibility. API availability
and actual match activity determine whether missing scopes can be filled. The admin can
seed accounts, submit research replay IDs, run collection and refresh scores.

Verified against live APIs on 2026-10-31:

| Endpoint                                          | Use / access                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `/settings`                                       | Public previous-season ID and game settings                       |
| `/players/leaderboard?format=...&leaderboard=...` | Public player discovery; previous-season fallback during rollover |
| `/battle/battle_queue?username=...`               | Public active ranked queue IDs and opponent IDs                   |
| `/battle/result?id=...`                           | Public full replay resolution, no access token needed             |
| `/battle/history2?player=...&format=...`          | HTTP 401 anonymously; optional authenticated bulk history         |
| Hive `bridge.get_ranked_posts`                    | Public shared replay research, maximum 20 posts/request           |

The collector has ingested real ranked queue replays without game credentials.
Some live queues are unfinished and are retried later. HTTP 200 error strings
are not treated as battle objects. Public sampling is neither complete nor
random. Current profile ratings are never substituted for historical ratings.
Explicit match level caps are preferred; otherwise conservative lineup
inference is required. Unmappable or incomplete matches remain archived.

Sources: [official API directory](https://support.splinterlands.com/hc/en-us/articles/10038260640916-Available-APIs),
[game Swagger](https://api2.splinterlands.com/doc/),
[VAPI Swagger](https://vapi.splinterlands.com/swagger/).
The live game Swagger and official JavaScript SDK were reviewed. Direct VAPI
schema access was unavailable in the development network; its route inventory
was checked against the public `Silverkazimi/splinterlands-mcp` Swagger drift
baseline dated October 30. That inventory exposes market/land/collector routes,
and no battle history alternative. Live endpoint behavior takes precedence
over historical documentation about authentication.

## Curation and persistence

`/admin/ratings` uses the existing Hive admin session. Edit a draft, save it,
preview, then publish with a version label and reason. Saving and publication
use optimistic revisions; concurrent publication returns 409 to the stale
writer. Restoring a prior version creates a draft and requires publication.
Collection always scores against the published profile, never the draft.

Neon migrations 002–006 add profiles, score snapshots, a singleton workspace,
raw battles, normalized observations, descriptive usage, account/format targets,
player/pending queues, job runs and a lease. Canonical IDs join the two sorted queue IDs. Ingestion is idempotent;
parser upgrades replace observations atomically, guarded against older writers.
Research-only captures can be promoted if later independently discovered from
a ranked queue/history source. Publishing atomically swaps the active snapshot;
the previous snapshots and profile history remain available.

Public reads use five-minute tagged caches and static pages, with compact card
score tuples for client filters. Publication/collection invalidates the rating
tag. Individual card and ability pages read all eight scopes in one query.

## Setup and verification

Required: existing `DATABASE_URL`, `JWT_SECRET`, admin account, and server-only
`CRON_SECRET` for hosted scheduling. Optional authenticated history credentials:
`SPLINTERLANDS_API_USERNAME`, `SPLINTERLANDS_ACCESS_TOKEN`, and
`SPLINTERLANDS_JWT_TOKEN`. No game credentials are needed for public sampling.
Never put these credentials in public variables or logs.

```
npm run db:migrate
npm run ratings:init
npm run ratings:collect
npm test
npm run typecheck
npm run lint
npm run build
# With the local app running, development database only:
npm run test:ratings-db
ALLOW_USAGE_DB_TEST=1 node --import tsx scripts/test-rating-signals.mts
```

The Vercel build command applies additive migrations and initializes an
empty ratings workspace. The versioned November 3 ability review upgrades only
untouched provisional weights, preserving custom curation and private draft edits.
Later deployments do not repeat that review.
The first production deployment starts one bounded collection run. Subsequent
collection is scheduled or initiated by an admin. To increase collection
frequency, adjust the cron schedule to the hosting plan's supported interval.

The database integration test checks authorization, validation, private drafts,
preview, publication/cache invalidation, concurrent publication, restore,
source bias, idempotent ingestion and parser upgrades; it restores test changes.
The unit fixture is a real ranked replay with the large round log omitted.

## Snapshot refresh and retention

Collection recomputes ratings only when the active snapshot is at least 24 hours
old (or explicitly forced). Admin publication/refresh remains immediate. Each
profile retains its first snapshot and two most recent snapshots; redundant
automatic snapshots are pruned transactionally. Raw replay archives and published
curation history are preserved. A scoring-engine deployment refreshes the
published profile once without overwriting the draft or its curation.

## Admin tier reference

The tier editor shows unit ratings from the active published snapshot in one
batched query, cached for five minutes and invalidated on publishing. Hover or
focus a unit to see its equal-weight average and the Modern/Wild score at each
league cap. Only available scores contribute; missing scopes are not zeroes.

Bands are S ≥9, A ≥8 and <9, B ≥6.5 and <8, C ≥5 and <6.5, D <5.
An exclamation mark identifies a placed unit outside its average score band
and updates immediately during editing. Distance is grey for one tier, yellow
for two tiers, and red for three or four tiers. Unranked units and units without
published scores have no warning. These references never alter saved tiers,
apply to summoners/land, or appear on public tier lists.
