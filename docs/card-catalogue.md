# Card library

`/cards` lists the complete Splinterlands card feed, including preview definitions,
Gladiators, Foundation, and land cards. Soulkeep definitions are excluded.
`/card/[slug]` provides a page for every included definition. Slugs remove
apostrophes and normalize punctuation; a numeric suffix resolves name collisions.

The three tabs are Units, Summoners, and Land Cards. A dual-purpose card such as
ElectroFox appears in both Units and Land Cards. Land-only cards have land
progression rather than invented combat statistics. Preview definitions are
labelled and can lack published artwork or market listings.

## Data and levels

- Official card definitions: `https://api.splinterlands.io/cards/get_details`.
- Current Modern editions and explicit card exceptions:
  `https://api.splinterlands.io/settings`.
- Wild means Wild-exclusive, as requested; no format selection includes both.
  Promo/reward/extra cards inherit their parent tier's format. Land cards have no
  battle-format filter. This new catalogue does not change existing tier-list
  edition groupings.
- League selection uses `LEAGUE_LEVEL_CAPS` from the existing Deck Builder and
  clamps to the actual number of levels in a card definition.
- Unit ability arrays contain additions: accumulate them through the chosen
  level. Summoners use a direct list. Land ability arrays contain complete
  per-level snapshots: never sum bonuses across levels.
- Summoner tactics, recipient counts, status effects, and bloodline-linked
  abilities come from `ptrOptions` and `racialSynergy` in the official feed.

The compact normalized catalogue is cached for one hour using `unstable_cache`.
Caching the normalized result avoids Next.js's cache item size limit on the large
upstream feed. `data/card-catalogue.json` is the bundled fallback for API outages.
Only available foil IDs are serialized, rather than the full print distribution.

`/cards` is pre-rendered with a static header, filters and table skeleton. Its
query-aware interactive table hydrates inside a Suspense boundary; the route does
not read server search parameters and can be served from the full route cache.
The route loading state uses the same shell and skeleton. Filter updates defer
expensive table rendering, and unchanged rows are memoized. Detail pages are
also cached; a small client boundary synchronizes edition buttons with the URL.

Market requests run only on detail pages and are cached at the edge for 30 seconds.
Manual refresh/retry uses a separate no-store request. Edition prices remain
separate. Failures display a retry state, distinct from an empty market.

## Art and abilities

All currently published card artwork and ability icons used by the app are stored
in `public/images`, including separate edition/foil prints and small thumbnails.
The catalogue, tier lists and deck builder all use these local files. Full cards
are WebP at up to 640 px (without enlarging smaller originals), quality 85, with
transparent margins trimmed; thumbnails are 96 px at quality 80. Icons are WebP
at up to 84 px. Card filenames contain a content hash and receive immutable,
one-year browser caching. Icons receive one-day caching. No runtime image URL
probing or external image requests are needed.

Run `npm run sync:cards` to refresh the official catalogue and download newly
published artwork. It requires Node 24's configured proxy support (or unrestricted
standard fetch), `tsx`, and `sharp`. Existing files are reused. `data/card-images.json`
indexes dimensions and hashes; `data/image-sources.json` records the exact official
source and byte counts. `data/unpublished-images.json` lists genuine 403/404 art
variants instead of silently substituting the wrong foil. Commit these files and
`public/images` together. Failed requests other than 403/404 stop the sync.

Original assets come from Splinterlands' CloudFront domain. Pre-rendered cards use
`cards_by_level/{edition}/{encoded name}_lv{level}{suffix}.png` with `suffix`
empty, `_gold`, or `_blk`. Arcane variants share the corresponding printed foil
art; the UI adds a reduced-motion-aware sheen. Where a level render is missing,
the sync tries official `cards_v2.2` or `cards_land` artwork in the same foil,
then other published level renders. Never substitute regular art for black/gold.

Ability icons originate at `website/abilities/ability_{hyphenated name}.png`.
A single delegated tooltip handles hover, keyboard focus and tap for each page;
opening or moving to another icon has no delay or animation. A 50 ms exit grace
period keeps the official source link reachable. Popups are portalled outside
scrollable tables, positioned before paint and dismissed on Escape/scroll.
Local, concise mechanic summaries link to these official references:

- [Abilities and debilitations](https://support.splinterlands.com/hc/en-us/articles/12821703483156-List-of-Splinterlands-Abilities-and-Debilitations)
- [Stray Shot](https://support.splinterlands.com/hc/en-us/articles/43935917059220-Stray-Shot)
- [Land abilities](https://support.splinterlands.com/hc/en-us/articles/44050892625940-Land-Cards-FAQ)
- [Verico land cards](https://support.splinterlands.com/hc/en-us/articles/50737508979348-Verico-Land-Cards-FAQ)
- [Black and Arcane foils](https://support.splinterlands.com/hc/en-us/articles/47499969805844-Black-Foils-and-Variants-FAQ)

Update `lib/splinterlands/abilities.ts` when game mechanics change. Future unknown
abilities retain their names and a link to official documentation.

## Pricing

`GET /api/cards/[id]/prices?edition=N` validates both card and edition before
querying the two official market endpoints (`gold=false` and `gold=true`).
Results stay separated across all five numeric foil IDs (0–4).

- **Lowest / BCX**: minimum `buy_price / bcx` over valid USD offers.
- **Single 1-BCX copy**: minimum asking price among offers with exactly 1 BCX.
- Zero/negative/nonfinite prices and quantities are ignored.
- An empty qualifying set is `null`, never a zero-dollar card.
- Special foils are often max-level copies and may have no 1-BCX offer.
- Runi uses the existing OpenSea floor-price utility. It is an individual NFT;
  the UI explains why BCX and foil-specific market rows do not apply.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for the
catalogue checks. Tests cover cumulative abilities, snapshot land bonuses,
format/edition filtering, dual-purpose cards, slug collisions, and foil pricing.
No database schema changes or additional secrets are required.
