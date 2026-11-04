# Daily card price history

Each card detail hero has a daily USD asking-price chart tied to the artwork's
foil and edition selection. Lowest / BCX and the lowest actual 1-BCX copy are
separate lines; available USD listing counts have a separate bar panel on the
same UTC date axis. Range buttons show 30, 90 or 365 calendar days. Hover/touch or focus the plot and use Left/Right (Home/End) to inspect exact
observations. The info button opens chart notes and an expandable daily data
table on hover, focus or tap, keeping the main chart compact. A single
snapshot renders as a dot. Missing values break lines rather than becoming zero
or interpolating across the gap.

The initial production deployment triggers `.github/workflows/collect-prices.yml`.
Subsequent collection runs daily at 02:17 UTC (09:17 Bangkok). Actions schedules
can be delayed. A successful day is immutable: a deployment or retry on the
same UTC date makes no additional datapoint or market request for completed
card editions. Nothing invents prices before the first observation.

The collector fetches both `gold=false` and `gold=true` versions of the public
`/market/for_sale_by_card` endpoint for each catalogue card/edition. Live checks
confirmed Black and Black Arcane rows in the non-gold response and responses
above 1,000 listings without a pagination cutoff. Explicit `foil` fields identify
all five foils. The cheapest total listing is not assumed to be 1 BCX: singles
require `bcx === 1`. Duplicate UIDs are removed. Only valid positive USD prices
contribute to the recorded prices and listing count, matching the live market
table. The grouped endpoint cannot establish the cheapest actual 1-BCX copy.
Runi is an Ethereum NFT with no comparable BCX market and is explicitly marked
not applicable; its existing live OpenSea floor remains available.

Migration 007 adds daily jobs, card/edition targets, snapshots and an independent
collection lease. A batch handles up to 80 card editions with two workers and market requests spaced 500 ms apart,
20-second request deadlines and a 160-second work budget. Actions resumes batches
until completion, backing off on rate limits and temporary deployment/network
errors. No Splinterlands login token is needed. GitHub OIDC verifies the exact
price workflow, repository/owner IDs, main branch, issuer and endpoint audience.
The price workflow cannot authorize the battle endpoint, or vice versa.

Both API responses must succeed before the complete foil observation publishes atomically.
A successful empty market records null prices and zero listings. A failed
request records no history row, so prices AND listings remain unknown. At most
three failed attempts are made per target per day, except HTTP 429s which pause
and retry without exhausting that counter. Retry-After hints are respected up to
one hour, and the database lease preserves the cooldown across invocations. Partial days fail the workflow
visibly. Re-running via workflow_dispatch retries exhausted failures while
preserving every successful snapshot. A date check prevents observations taken
after UTC midnight being assigned to the previous date.

Snapshots are retained for 365 UTC calendar days; the public API reads that window, with
five-minute tagged caching invalidated after every batch. Selecting a foil does
not refetch: the edition response includes all five foil histories. The chart
fetch is independent of live prices and does not block the rest of the card page.

Verification:

```
npm test
npm run typecheck
npm run lint
npm run build
# Development database with no price collection for the current UTC day:
ALLOW_PRICE_DB_TEST=1 node --import tsx scripts/test-price-history.mts
```

The database test checks partial-batch resumption, null prices, true empty
markets, first-snapshot preservation, failed-request gaps, manual retry recovery,
Runi exclusion and the collection lease. It removes its fixtures afterward.

## Lean storage (migration 010)

History retains 365 UTC calendar days. Successful collection stores price rows
only for foils with listings. A completed `card_price_targets` row is the marker
that all five foils were observed; a missing foil row under that marker means
zero listings. Failed/unobserved targets still mean unknown, never zero.
`readPriceHistory` reconstructs all five foils for completed targets, so charts
preserve empty-market vs missing-observation semantics. The first daily sample
is immutable, including empty markets, even after retries.

The collector returns early for a completed day. At initialization of a new day,
it deletes history, target markers and day bookkeeping outside the one-year
window in dependency order. Existing rate-limit pacing and cooldown remain.
The chart's first day is the first retained successful observation. Older history
is discarded; no archive service is introduced.
