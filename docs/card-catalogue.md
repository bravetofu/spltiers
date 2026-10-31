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

Definitions/settings are cached for one hour. Market requests are uncached and
made only on a card's detail page, with a manual refresh. One edition's prices
cannot leak into another edition's results. Failures display a retry state,
separate from an empty market.

## Art and abilities

Official images use the existing CloudFront domain. Pre-rendered cards use
`cards_by_level/{edition}/{encoded name}_lv{level}{suffix}.png` with `suffix`
empty, `_gold`, or `_blk`. Arcane variants share the corresponding printed foil
art; the UI adds a reduced-motion-aware sheen. Where a level render is missing,
fall back to official `cards_v2.2` or `cards_land` artwork in the same foil,
then other published level renders. Never substitute regular art for black/gold.

Ability icons use `website/abilities/ability_{hyphenated name}.png`. All combat
icons and land-specific aliases were checked against the official CDN. Tooltips
work with hover, keyboard focus, and tap, and are portalled outside scrollable
tables. Local, concise mechanic summaries link to these official references:

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
