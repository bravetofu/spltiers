# Combat card and ability ratings

The public catalogue has 0–10 ratings for units and summoners. `/abilities`
lists ability strength, `/ability/[slug]` explains each mechanic and pairing,
and `/ratings/methodology` describes the published model and collection status.
Land has no combat rating. Tier lists remain separately curated.

## Context and model

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
preserve that baseline. The estimate is bounded to 0–10, then confidence-limited:

```
weight = 0.65 × effective / (effective + 150)
         × min(players / 20, 1) × min(days / 7, 1)
score = curated + weight × (estimatedBattleScore - curated)
```

No adjustment applies before 30 matches, five players and 20 effective samples.
Only the last 90 days count, with a 30-day half-life and at most ten appearances
per player, feature, scope and UTC day. Effective sample mass is the sum of
decayed weights, so an old cohort loses influence even without new matches.
Mirrored cards/abilities are excluded. Underlevelled card appearances cannot
represent strength at the cap. Moderate confidence requires 150 effective
samples, 15 players and seven days; strong requires 500, 30 and 14 respectively.

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
version 2. Cached public totals invalidate after collection, independently of
the daily rating snapshots. Rating evidence retains its stricter filters.

### Collection schedule

GitHub Actions calls `/api/cron/collect-battles` every three hours at minute 7 (00:07, 03:07, …, 21:07 UTC; eight scheduled runs per day); scheduled Actions can be delayed. The public repository uses a minimal runner without checkout. The GitHub job authenticates with a short-lived OIDC identity verified against the issuer, audience, repository and owner IDs, main branch, exact workflow path, and allowed event. No shared GitHub secret is needed. Manual server triggers can also use `Authorization: Bearer <CRON_SECRET>`; invalid identities fail closed. A database
lease prevents overlapping runs. Each run has request, time and replay limits;
pending IDs and a rotating player roster persist between runs. The admin can
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

Neon migrations 002–004 add profiles, score snapshots, a singleton workspace,
raw battles, normalized observations, player/pending queues, job runs and a
lease. Canonical IDs join the two sorted queue IDs. Ingestion is idempotent;
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
```

The Vercel build command applies additive migrations and initializes only an
empty ratings workspace, preserving published curation on later deployments.
The first production deployment starts one bounded collection run. Subsequent
collection is scheduled or initiated by an admin. To increase collection
frequency, adjust the cron schedule to the hosting plan's supported interval.

The database integration test checks authorization, validation, private drafts,
preview, publication/cache invalidation, concurrent publication, restore,
source bias, idempotent ingestion and parser upgrades; it restores test changes.
The unit fixture is a real ranked replay with the large round log omitted.

## Engine 1.1 and collection storage

Bloodline Tribute models up to three compatible beneficiaries, one death trigger
or two with Rebirth, higher trigger reliability with Taunt, and mana affordability.
The existing ability contribution is subtracted to avoid counting the same base
benefit twice. Matching bloodline and Shapeshift allies are drawn from the legal
format catalogue at the selected cap. Bloodline Dominion and Scavenger partnerships
are conditional team-building priors; no card name or ID is special-cased. This
is an approximate team model and assumes appropriate active splinters/rulesets,
not a simulation or an observed win-rate claim.

Collection recomputes ratings only when the active snapshot is at least 24 hours
old (or explicitly forced). Admin publication/refresh remains immediate. Each
profile retains its first snapshot and two most recent snapshots; redundant
automatic snapshots are pruned transactionally. Raw replay archives and published
curation history are preserved. A scoring-engine deployment refreshes the
published profile once without overwriting the draft or its curation.
