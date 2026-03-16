# spltiers — Claude Code Context

This file is the primary reference for all development on this project.
Read it fully before writing any code.
UI mockups (open in browser to interact): docs/mockups/mockup-tier-list.html, docs/mockups/mockup-backoffice.html, docs/mockups/mockup-homepage-pricing.html

---

## What this project is

A Splinterlands card tier list and market pricing tool. Two public features:
1. **Tier lists** — per-edition card rankings (S/A/B/C/D) displayed as visual card grids
2. **Deck Builder** — select editions + tiers → live buy prices from the Splinterlands market

Plus an **admin backoffice** for updating tier data without redeployment.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Hosting | Vercel |
| Database | Supabase (Postgres) |
| Auth | Hive Keychain (posting key signature verification) |
| Styling | Tailwind CSS |
| Drag & Drop | dnd-kit |
| Card images | Splinterlands CloudFront CDN |
| Market data | Splinterlands public API |

---

## Environment variables

Already set in `.env.local` and in Vercel:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT=brave.sps
OPENSEA_API_KEY                            ← server-side only, never exposed to client
```

---

## Design system

### Colours (dark theme — use these exact values)
```
Background primary:   #0d1117   (nav, darkest surfaces)
Background secondary: #161b22   (cards, panels)
Background tertiary:  #21262d   (hover states, inputs)
Border default:       #30363d
Border subtle:        #21262d
Text primary:         #f0f6fc
Text secondary:       #c9d1d9
Text muted:           #8b949e
Text faint:           #484f58
Accent red:           #e63946   (logo, primary CTA)
Accent gold:          #ffd700   (S-tier, logo dot)
Green:                #2ecc71   (A-tier, success)
Blue:                 #3498db   (B-tier, info)
```

### Tier row colours
```
S: label bg #ffd700, text #0d1117 — dark bg pill: #3d3000, text #ffd700
A: label bg #2ecc71, text #0d1117 — dark bg pill: #0d3320, text #2ecc71
B: label bg #3498db, text #0d1117 — dark bg pill: #0d2440, text #3498db
C: label bg #95a5a6, text #0d1117 — dark bg pill: #1c2128, text #95a5a6
D: label bg #555e6a, text #adb5bd — dark bg pill: #161b22, text #555e6a
```

### Logo
Italic "spltiers" in #e63946, followed immediately by a 5px gold (#ffd700) circle dot.

### Typography
- Font: system font stack via Tailwind (font-sans)
- Nav height: 52px
- Max content width: 1100px (tier lists), 1000px (deck builder), centered

### Component patterns
- Cards/panels: bg #161b22, border 1px #30363d, border-radius 10px
- Badges/chips: bg #21262d, border 1px #30363d, border-radius 6px, font-size 12px
- Primary button: bg #e63946, no border, border-radius 8px
- Secondary button: bg #21262d, border 1px #30363d, border-radius 6px
- Input fields: bg #161b22 or #21262d, border 1px #30363d, border-radius 6px

---

## Site routes

| Route | Page | Access |
|---|---|---|
| `/` | Homepage — edition selector | Public |
| `/tier-list/[edition-slug]` | Tier list for an edition | Public |
| `/deck-builder` | Deck Builder | Public |
| `/admin` | Backoffice — edition list | brave.sps only |
| `/admin/[edition-slug]` | Drag-and-drop tier editor | brave.sps only |
| `/admin/unauthorized` | Access denied page | Public |

---

## Authentication (Hive Keychain)

Admin routes are protected. Only the account `brave.sps` may access them.

### Login flow
1. User visits `/admin`
2. App checks for Hive Keychain browser extension
3. Server generates a random challenge string
4. Keychain signs the challenge with the posting key (`requestSignBuffer`)
5. Server fetches `brave.sps`'s public posting key from `https://api.hive.blog` and verifies the signature
6. On success: issue JWT, store in httpOnly cookie, redirect to `/admin`
7. On failure or wrong account: redirect to `/admin/unauthorized`

### Hive API for key lookup
```
POST https://api.hive.blog
Body: {"jsonrpc":"2.0","method":"condenser_api.get_accounts","params":[["brave.sps"]],"id":1}
Response: result[0].posting.key_auths[0][0]  ← this is the public posting key
```

### Signature verification
Use the `@hiveio/hive-js` or `dhive` library for signature verification server-side.

---

## Card image URLs

All card images come from the Splinterlands CloudFront CDN.

**Pattern:**
```
https://d36mxiodymuqjm.cloudfront.net/cards_by_level/{cdn_slug}/{card_name}_lv{max_level}.png
```

- `card_name` must be URL-encoded (encodeURIComponent)
- `max_level` is determined by rarity (see rarity table below)
- Gold foil: append `_gold` before `.png`

### Edition → CDN slug mapping
Derived from `editions` + `tier` fields in `GET https://api.splinterlands.io/cards/get_details`

| editions | tier | Display name | CDN slug |
|---|---|---|---|
| 0, 1, or 0,1 | any | Alpha/Beta | /beta/ |
| 2 | 0 or 1 | Alpha/Beta | /promo/ |
| 3 | 0 or 1 | Alpha/Beta | /reward/ |
| 4 | any | Untamed | /untamed/ |
| 2 | 4 | Untamed | /promo/ |
| 3 | 4 | Untamed | /reward/ |
| 5 | any | Dice | /dice/ |
| 7 | any | Chaos Legion | /chaos/ |
| 2 | 7 | Chaos Legion | /promo/ |
| 3 | 7 | Chaos Legion | /reward/ |
| 10 | 7 | Chaos Legion | /soulbound/ |
| 8 | any | Riftwatchers | /rift/ |
| 12 | any | Rebellion | /rebellion/ |
| 2 | 12 | Rebellion | /promo/ |
| 13 | any | Rebellion | /soulboundrb/ |
| 14 or 17 | any | Conclave Arcana | /conclave/ |
| 2 | 14 | Conclave Arcana | /conclave/ |
| 18 | any | Conclave Arcana | /reward/ |
| 20 | any | Escalation | /escalation/ |

### Rarity → max level
| Rarity value | Name | Max level |
|---|---|---|
| 1 | Common | 10 |
| 2 | Rare | 8 |
| 3 | Epic | 6 |
| 4 | Legendary | 4 |

### Soulbound cards
- editions=10 (CL soulbound) and editions=13 (Rebellion soulbound) are **shown in tier lists** with a lock icon overlay
- Soulbound cards are **excluded from the Deck Builder**

---

## Supabase schema

Run this SQL in the Supabase SQL Editor to create the tables:

```sql
-- Card sets / editions
create table card_sets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Tier entries per card per set
create table tier_entries (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references card_sets(id) on delete cascade,
  card_id int not null,
  card_name text not null,
  edition text not null,
  cdn_slug text not null,
  rarity int not null,
  tier text check (tier in ('S','A','B','C','D')),
  role text,
  notes text,
  is_soulbound boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(set_id, card_id)
);

-- RLS policies
alter table card_sets enable row level security;
alter table tier_entries enable row level security;

-- Public read
create policy "public read card_sets" on card_sets for select using (true);
create policy "public read tier_entries" on tier_entries for select using (true);

-- Authenticated write (backoffice uses service role key — bypasses RLS)
-- Service role key is used server-side in admin routes only
```

---

## Splinterlands API endpoints

| Data | Endpoint |
|---|---|
| Card details (name, rarity, editions, tier) | `GET https://api.splinterlands.io/cards/get_details` |
| Market buy listings — regular + black foil | `GET https://api2.splinterlands.com/market/for_sale_by_card?card_detail_id={id}&gold=false` |
| Market buy listings — gold + arcane foil | `GET https://api2.splinterlands.com/market/for_sale_by_card?card_detail_id={id}&gold=true` |
| Rental listings (grouped) | `GET https://api2.splinterlands.com/market/for_rent_grouped` — see docs/rent-pricing-notes.md |
| OpenSea Runi floor price | `GET https://api.opensea.io/api/v2/collections/runi/stats` (requires `OPENSEA_API_KEY` header) |
| ETH/USD rate | `GET https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd` |

Cache card details with Next.js `fetch` caching (revalidate: 3600).
Buy listings: no-store (always live). Grouped rent listings: revalidate 60s.
OpenSea + CoinGecko: revalidate 300s (5 minutes).

---

## Homepage layout (`/`)

- Hero: "Splinterlands tier lists" heading, short subtitle
- Edition cards grouped into two sections: "modern format" and "wild format"
- Each edition card shows: name, format badge, card count, ranked count, arrow
- Modern editions: Conclave Arcana, Rebellion, Escalation
- Wild editions: Chaos Legion, Riftwatchers, Untamed, Alpha/Beta, Dice
- Deck Builder promo block at the bottom

---

## Tier list page (`/tier-list/[edition-slug]`)

- Sub-nav bar: breadcrumb "← all editions" on left, "switch edition" dropdown on right
- Dropdown groups editions by Modern / Wild, marks current edition with a dot
- Five tier rows: S → A → B → C → D
- Each row: coloured tier label on left, horizontal wrapping grid of card thumbnails
- Card thumbnail: 72×72px, card CDN image, border-radius 6px
- Soulbound cards: small lock icon overlay top-right
- Hover on card: floating popover showing full card image (~170px wide, 2:3 ratio) + tier badge + role tag (if set) + notes text (if set)
- Beginner mode toggle (top right): adds explanatory subtitle to each tier label; adds role tag explanations in popover
- Unranked cards not shown on public page

---

## Deck Builder (`/deck-builder`)

- Config panel: edition multi-select chips, tier multi-select chips (S/A/B/C/D), league selector (Bronze/Silver/Gold/Diamond+)
- "Calculate prices" button fetches live market data
- Results: 3 summary cards (total buy cost, avg per card, most expensive card)
- Results table: card thumbnail, name, edition badge, tier badge, rarity, buy price (USD)
- Per-edition subtotal rows
- "No active listing" shown as "—"
- Fetch timestamp shown
- Export CSV button
- Soulbound cards excluded entirely
- Supply warnings and price outlier detection with exclusion filter chips
- `/pricing` and `/deck-cost` redirect to `/deck-builder`

### Deck Builder pricing detail

#### Two API calls per card
Each card makes two parallel requests:
- `&gold=false` → returns **regular foil** (foil=0) and **black foil** (foil=3, foil=4)
- `&gold=true` → returns **gold foil** (foil=1) and **arcane gold foil** (foil=2)

The `foil` field in each listing may be returned as a number or a string — always coerce with `Number(l.foil ?? 0)` before comparing.

#### Foil types

| foil value | Name | BCX table | Pricing strategy |
|---|---|---|---|
| 0 | Regular foil | `ALPHA_BETA_BCX` or `STANDARD_BCX` | Full Option A / Option B (accumulate BCX) |
| 1 | Gold foil | `ALPHA_BETA_GOLD_BCX` or `STANDARD_GOLD_BCX` | Full Option A / Option B. If `target_bcx === 0`, take cheapest single listing (no accumulation). |
| 2 | Arcane gold foil | — | Option A only: cheapest listing where `listing.level >= target_level` |
| 3 or 4 | Black foil | — | Cheapest listing at **any** level — a single black foil card plays at max stats regardless of its listed BCX level. Do **not** filter by `listing.level >= target_level`. |

#### Final price selection
```
final_price = min(regular_price, gold_foil_price, arcane_price, black_foil_price)
```
Only complete (non-insufficient-supply) options are compared. If no complete option exists, fall back to the regular foil partial result (insufficient supply).

#### Gold foil BCX tables
Levels showing `0` BCX are achievable with a single 1-BCX card.

```typescript
const ALPHA_BETA_GOLD_BCX: Record<number, number[]> = {
  1: [0, 0, 0, 1, 2, 4, 8, 13, 23, 38],  // Common (levels 1-10)
  2: [0, 0, 1, 2, 4, 7, 12, 22],          // Rare (levels 1-8)
  3: [0, 0, 1, 3, 5, 10],                 // Epic (levels 1-6)
  4: [0, 1, 2, 4],                        // Legendary (levels 1-4)
}

const STANDARD_GOLD_BCX: Record<number, number[]> = {
  1: [0, 0, 1, 2, 5, 9, 14, 20, 27, 38],  // Common (levels 1-10)
  2: [0, 1, 2, 4, 7, 11, 16, 22],          // Rare (levels 1-8)
  3: [0, 1, 2, 4, 7, 10],                  // Epic (levels 1-6)
  4: [0, 1, 2, 4],                         // Legendary (levels 1-4)
}
```

**Table selection** (same edition logic as regular foil):
- editions 0 → `ALPHA_BETA_GOLD_BCX`
- editions 1, or editions 2, or (editions 3 and `card_detail_id <= 223`) → `ALPHA_BETA_GOLD_BCX`
- All other editions → `STANDARD_GOLD_BCX`

In code this is expressed as `card.edition === 'Alpha/Beta'` (the display name already encodes the above mapping).

#### Cell colour coding by foil type

| Winner | Cell bg | Text / border | Sub-label | Tooltip |
|---|---|---|---|---|
| Regular foil | — | — (default) | `{bcx} BCX · {method}` | — |
| Gold foil (foil=1) | `#2a2200` | `#ffd700` / `3px solid #ffd700` | `{bcx} BCX · ✦ gold foil` or `✦ gold foil` | "Cheapest option is a gold foil card…" |
| Arcane foil (foil=2) | `#2a2200` | `#ffd700` / `3px solid #ffd700` | `✦ gold foil arcane` | "Cheapest option is a gold foil card…" |
| Black foil (foil=3/4) | `#0a1a0a` | `#2ecc71` / `3px solid #2ecc71` | `◆ black foil` | "Cheapest option is a black foil card…" |
| Runi (card_detail_id 505) | `#1a1a2e` | `#a0aec0` / `3px solid #a0aec0` | `◆ OpenSea · ETH floor` | "Runi is an Ethereum NFT — price sourced from OpenSea floor price, converted to USD" |

**Precedence:** outlier red styling always overrides foil colour coding. When both apply, the price shows red but the sub-label shows the foil badge in a muted version of the foil colour (`rgba(255,215,0,0.5)` for gold, `rgba(46,204,113,0.5)` for black).

When `buy_usd === null` (the `—` dash case), the cell gets a tooltip: `'No listings found on the market for this card at this level'`.

#### Runi special case (card_detail_id 505)

Runi is an Ethereum NFT sold on OpenSea, not on the Splinterlands marketplace. It receives entirely different pricing logic:

- **Skip** all Splinterlands market API calls for card_detail_id 505
- **Fetch** OpenSea floor price: `GET https://api.opensea.io/api/v2/collections/runi/stats` → `data.total.floor_price` (ETH)
- **Fetch** ETH/USD rate from CoinGecko: `GET https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`
- **Multiply** to get `floor_usd`; return `foil_type: 'runi'`
- **Cache** both fetches at `revalidate: 300` (5 minutes)
- **API key** (`OPENSEA_API_KEY`) is read server-side only — never passed to the client

**Shared utility:** `lib/opensea.ts` exports `fetchRuniFloorPrice(): Promise<RuniFloorPrice | null>`.
It is imported by:
- `app/actions/pricing.ts` (server action — direct import, no HTTP round-trip)
- `app/api/market/route.ts` (proxy route — exposed as `GET /api/market?type=opensea-runi`)

The proxy route exists so the client can reach OpenSea data without exposing the API key; the server action uses a direct import to avoid an unnecessary HTTP call.

---

## Backoffice tier editor (`/admin/[edition-slug]`)

- Built with dnd-kit
- Layout: unranked pool panel (left, 220px) | tier lanes (centre, flex) | annotation panel (right, 200px, hidden until card clicked)
- Unranked pool: scrollable grid of 62×62px card thumbnails for cards not yet assigned a tier
- Search + rarity filter above unranked pool
- Five tier lanes: each has coloured label + drop zone
- Drag from unranked → tier lane, between tier lanes, or back to unranked
- Click a tiered card (not drag): opens annotation panel with role input + notes textarea
- "Save" button: commits all changes to Supabase in one operation
- "Unsaved changes" banner appears after any drag
- Card data loaded fresh from SL API on each editor open

---

## Key implementation notes

- Use `encodeURIComponent(cardName)` when building CDN image URLs
- The `editions` + `tier` combo is required to correctly resolve CDN slug — do not use `editions` alone
- Supabase admin writes use `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never exposed to client)
- Hive Keychain is a browser extension — detection and signing must happen client-side; verification happens server-side in a Next.js API route or Server Action
- DEC prices from rental API are in DEC — always convert to USD using live CoinGecko rate before displaying
- Server-side fetch caching: card details revalidate 3600s, market prices revalidate 60s
