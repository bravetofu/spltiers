# Neon transfer reduction — 2026-11-05

This release changes read paths and cache lifetimes, not ratings, evidence,
collection frequency or public response shapes. The scoring engine remains
`practical-3.1`; no schema migration or new database table is needed.

## Cache boundaries

- Score indexes, card breakdowns, ability ratings, published profiles and tier
  reference scores use the `ratings` tag with a 24-hour fallback expiry.
  Existing publication/refresh handlers invalidate that tag when scores change.
- Lifetime battle statistics use separate card/league/format queries, the
  `rating-collection` tag and a one-hour fallback expiry. Collection invalidates
  them independently. Response composition occurs outside both caches, so fresh
  statistics do not force unchanged score data to be fetched again.
- Raw Neon fetches are explicitly `no-store`; the enclosing Next data cache owns
  caching. This prevents an independent HTTP cache from surviving tag invalidation.
- Price histories use card-and-edition tags and a 24-hour fallback expiry. Each
  successful atomic observation invalidates its own tag immediately, including
  observations committed before another target fails. A busy/no-change batch
  invalidates nothing. Other cards' history caches remain available.

## Scoped statistics

Production measurements before release: all lifetime usage rows were roughly
228 KB as JSON, versus 252 bytes per card on average, and roughly 46 KB per
populated league/format scope. These are result-size estimates, not billed wire
bytes. Previously the full-table result was shared and cached, so it was not sent
on every card view. New queries constrain the rows before transfer. The default
unfiltered maintenance function remains available for existing scripts/tests.

## Shared explanations

`data/score-note-dictionary.json` contains 30 common, complete explanation strings.
The card-detail query replaces matching notes with references **inside SQL**, before
sending the result through Neon's proxy. `expandScoreParts` restores the original
strings before caching/rendering them. Unknown or custom notes travel inline.
Part order, negative values and all other fields are preserved.

Snapshots retain the original complete notes. There is no persisted encoded format,
no dictionary table to fetch, and no rollout dependency between database writes
and old/new application versions. Dictionary updates can improve coverage without
changing scoring or historical data. Current dictionary input is approximately
3.9 KB, sent to the database on a cache miss.

Read-only production validation across all 5,560 card scopes found:

| Payload | JSON bytes |
| --- | ---: |
| Original | 14,298,636 |
| Compact | 9,886,268 |
| Reduction | 4,412,368 (30.9%) |

Every expanded JSON record equalled its original, including explanation order and
custom text. This is a measured reduction for card-score result data, **not** a
claim that total daily Neon transfer falls by 31%. Cards are fetched individually
on cache misses; complete-snapshot traffic is not the normal page-read pattern.

## Daily measurement

The baseline project counter was 103,894,715 bytes for the billing period starting
2026-11-01T12:19:18Z, approximately 27.8 MB/day through the November 5 reading.
That average includes production, development and maintenance/review activity.
The current plan does not expose the time-windowed consumption API.

The enabled **Splintiers transfer log** ChatGPT task runs each morning around
08:00 Asia/Bangkok, starting November 6, and uses the existing Neon connection to read project and branch metadata,
record timestamped counters in its task results and compare consecutive successful
readings. It does not query business tables, create database rows, provision a new
API key, or upgrade Neon. The retained JSON reading makes the comparison auditable.

For counters in the same billing period:

`MB/day = (currentBytes - previousBytes) / 1,000,000 / elapsedDays`

Report the actual interval, since task timing and meter refresh may vary. Treat a
billing-period change, counter decrease, missing prior reading or stale/failed
API result as a new baseline rather than manufacturing a daily figure. Preserve
the last successful reading on failure. Project and branch counters may update
at slightly different times; do not force their totals to agree.

Daily transfer savings must be measured after representative traffic. Page visits,
collection, builds and maintenance affect the total. The useful comparison is
several complete post-deployment intervals, not the first partial day.

## Validation

Tests exercise the real Next cache boundary with controlled time and invalidation:
collection refreshes statistics without rereading scores, publication refreshes
scores without rereading statistics, and the five-minute reread is eliminated.
They also check scoped query parameters, exact explanation expansion, custom-note
fallback and targeted invalidation after successful price writes amid failures.
Production SQL verifies lossless expansion across all card scopes. Production
build, live responses and runtime errors are checked after the main-branch push.
