# spltiers — Claude Code Kickoff Prompts

Use these prompts phase by phase. Do not start the next phase until the current one is confirmed working.

---

## Phase 1 — Foundation

```
Read CLAUDE.md in full before writing any code.

Build the Phase 1 foundation:

1. Install dependencies: `npm install @supabase/supabase-js @supabase/ssr dhive tailwindcss @tailwindcss/typography`

2. Set up Tailwind CSS (tailwind.config.ts + globals.css). Do not use any Tailwind preset colours — use only the custom colour palette defined in CLAUDE.md via CSS variables.

3. Create the Supabase client helpers:
   - `lib/supabase/client.ts` — browser client using NEXT_PUBLIC_ keys
   - `lib/supabase/server.ts` — server client using service role key (for admin writes)

4. Create the Hive Keychain auth flow:
   - `app/admin/page.tsx` — checks for existing session; if none, renders a "Connect with Hive Keychain" button
   - `app/admin/login/route.ts` — API route that: (a) generates a challenge, (b) returns it to the client
   - `app/admin/verify/route.ts` — API route that: (a) receives the signed challenge + account name, (b) fetches brave.sps's public posting key from the Hive API, (c) verifies the signature using dhive, (d) if account is not "brave.sps" redirect to /admin/unauthorized, (e) on success issues a JWT in an httpOnly cookie
   - `app/admin/unauthorized/page.tsx` — shows "This user does not have access to the admin panel" in the site's dark theme
   - `middleware.ts` — protects all /admin/* routes (except /admin/unauthorized) by checking the JWT cookie; redirects to /admin if missing

5. Create the shared layout:
   - `app/layout.tsx` — root layout with dark background (#0d1117)
   - `components/Nav.tsx` — nav bar (52px, #0d1117 bg, logo + "tier lists" + "pricing" links)
   - Logo: italic "spltiers" in #e63946 + 5px gold circle dot immediately after

6. Output the SQL from CLAUDE.md for me to run in Supabase SQL Editor — do not run it yourself.

7. Create placeholder pages (just the nav + "coming soon" text) for:
   - `app/page.tsx` (homepage)
   - `app/tier-list/[slug]/page.tsx`
   - `app/pricing/page.tsx`
   - `app/admin/page.tsx` (after auth check)

Do not build Phase 2 features. Confirm each piece works before moving on.
```

---

## Phase 2 — Backoffice

```
Phase 1 is confirmed working. Now build Phase 2: the backoffice tier editor.

Read CLAUDE.md in full before writing any code. Pay close attention to the "Backoffice tier editor" section and the card image URL conventions.

1. Install dnd-kit: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

2. Create a server action or API route `app/actions/cards.ts` that:
   - Fetches all cards from `https://api.splinterlands.io/cards/get_details`
   - Maps each card to: { card_id, card_name, edition (display name), cdn_slug, rarity, max_level, is_soulbound }
   - Uses the full editions+tier mapping table from CLAUDE.md — do not simplify it
   - Filters to only cards belonging to a given edition (by display name)
   - Caches the response for 3600s

3. Create `app/admin/page.tsx` (the backoffice home, post-auth):
   - Lists all card_sets from Supabase with: name, total card count (from SL API), ranked count (from tier_entries), last updated, Edit button
   - Toggle active/inactive per set
   - "Add edition" button: opens inline form for name, slug, icon_url, sort_order

4. Create `app/admin/[slug]/page.tsx` — the drag-and-drop tier editor:
   - Loads cards for this edition from the SL API (via server action)
   - Loads existing tier_entries for this edition from Supabase
   - Splits cards into: already-tiered (by tier) and unranked (not in tier_entries)
   - Renders the layout from CLAUDE.md: unranked pool (left) | tier lanes (centre) | annotation panel (right)
   - Unranked pool: 62×62px card thumbnails using CDN image URLs from CLAUDE.md
   - Tier lanes: S/A/B/C/D with correct colours from CLAUDE.md
   - dnd-kit drag between unranked ↔ tier lanes ↔ between tiers
   - "Unsaved changes" banner on any drag
   - Click tiered card → annotation panel (role input + notes textarea, save inline)
   - "Save" button → upserts all tier_entries to Supabase in one batch using service role key
   - Search + rarity filter on unranked pool

5. Card thumbnail component `components/CardThumb.tsx`:
   - Props: cardName, cdnSlug, rarity, size (default 62)
   - Builds CDN URL: `https://d36mxiodymuqjm.cloudfront.net/cards_by_level/${cdnSlug}/${encodeURIComponent(cardName)}_lv${maxLevel}.png`
   - Falls back to a dark placeholder div if image 404s (use onError)
   - Soulbound: renders lock icon overlay if is_soulbound

Do not build Phase 3 features.
```

---

## Phase 3 — Public Tier Lists

```
Phase 2 is confirmed working. Now build Phase 3: the public-facing tier list pages.

Read CLAUDE.md in full before writing any code. Pay close attention to the "Homepage layout" and "Tier list page" sections.

1. Build `app/page.tsx` — the homepage:
   - Hero: "Splinterlands tier lists" (font-size 32px, font-weight 500, #f0f6fc) + subtitle in #8b949e
   - Two sections: "modern format" and "wild format" (section labels in uppercase, #8b949e, letter-spacing)
   - Edition cards grid: `repeat(auto-fill, minmax(200px, 1fr))`, gap 12px
   - Each edition card: name, format badge (modern=#3d1c1c/#e63946, wild=#1c2840/#3498db), card count + ranked count from Supabase, arrow →
   - Only show is_active=true editions, ordered by sort_order
   - Pricing calculator promo block at bottom: dark card with text left, button right

2. Build `app/tier-list/[slug]/page.tsx`:
   - Sub-nav bar: "← all editions" breadcrumb left, "switch edition" dropdown right
   - Dropdown groups editions by Modern/Wild, marks active with red dot
   - Five tier rows (S→D) with correct colours from CLAUDE.md
   - Each row: 52px coloured label + wrapping card grid
   - Use CardThumb component (72×72px in tier list view)
   - Card hover popover: position fixed, 170px wide, 2:3 aspect ratio image, tier badge + role tag + notes below image
     - Popover must use CSS/JS hover — not a Radix or headless UI dependency
     - Position: right of card if space allows, left if near edge
   - Beginner mode toggle: state stored in localStorage; when on, adds tier explanations below tier labels and role explanations in popover
   - Page is fully statically generated with ISR (revalidate: 3600)

3. Build the CardHoverPopover as a client component `components/CardHoverPopover.tsx`:
   - Wraps children, shows popover on mouseenter
   - Uses fixed positioning calculated from getBoundingClientRect
   - Does not use any third-party popover library

Do not build Phase 4 features.
```

---

## Phase 4 — Pricing Calculator

```
Phase 3 is confirmed working. Now build Phase 4: the pricing calculator.

Read CLAUDE.md in full before writing any code. Pay close attention to the "Pricing calculator" section and the API endpoints.

1. Create server action `app/actions/pricing.ts`:
   - Input: array of { card_id, edition, cdn_slug, rarity } + level preference
   - Fetches buy listings from `https://api2.splinterlands.com/market/for_sale_by_card?card_detail_id={id}&gold=false`
   - Fetches rent listings from `https://api2.splinterlands.com/market/for_rent_by_card?card_detail_id={id}`
   - Fetches DEC/USD rate from CoinGecko
   - Takes cheapest listing price for buy, cheapest daily rate for rent
   - Converts DEC → USD
   - Returns per-card { buy_usd, rent_day_usd } — null if no listing
   - Revalidate: 60s

2. Build `app/pricing/page.tsx` (client component):
   - Config panel: edition chips (multi-select), tier chips (S/A/B/C/D, multi-select), card level select
   - Chips use on/off state with correct colours from CLAUDE.md
   - "Calculate prices" button: calls server action with selected editions + tiers
   - While loading: skeleton rows in the table
   - Results:
     - 3 summary metric cards: total buy, rent/day, rent/month (×30)
     - Table: card thumb (32×32px), name, edition badge, tier badge, rarity, buy price, rent/day
     - Per-edition subtotal rows
     - "—" for missing listings
     - Fetch timestamp
     - Export CSV button (client-side, generates CSV from current results)
   - Soulbound cards excluded — filter them out before fetching prices
   - All USD values: toFixed(2) for prices >$0.10, toFixed(4) for micro-prices

3. The API calls to Splinterlands market must be proxied through a Next.js API route (`app/api/market/route.ts`) to avoid CORS issues — do not call the SL API directly from the browser.

Do not build Phase 5 features.
```

---

## Phase 5 — Polish

```
Phase 4 is confirmed working. Now build Phase 5: polish and production readiness.

Read CLAUDE.md in full before writing any code.

1. Mobile responsiveness:
   - Tier list card rows: horizontal scroll on mobile (overflow-x: auto, no wrapping below 640px)
   - Card thumbnails: 60×60px on mobile, 72×72px on desktop
   - Pricing table: horizontal scroll wrapper on mobile
   - Nav: hide "tier lists" / "pricing" text on very small screens if needed
   - Homepage edition grid: 1 column on mobile, 2 on sm, 3+ on lg

2. Soulbound indicators:
   - Audit all tier list and backoffice views — confirm lock icon renders correctly on every soulbound card
   - Confirm soulbound cards are absent from pricing results

3. Performance:
   - Confirm ISR is working on tier list pages (revalidate: 3600)
   - Add loading.tsx skeleton screens for /tier-list/[slug] and /pricing
   - Lazy load card images (loading="lazy" on all <img> tags)
   - Add error.tsx boundaries on tier list and pricing pages

4. SEO:
   - `generateMetadata` on homepage: title "spltiers — Splinterlands Tier Lists & Pricing"
   - `generateMetadata` on tier list pages: title "{Edition} Tier List — spltiers", description "S/A/B/C/D card rankings for {Edition}. Updated by the community."
   - `generateMetadata` on pricing page: title "Pricing Calculator — spltiers"
   - Add `robots.txt` and `sitemap.xml` (sitemap includes all active edition tier list URLs)
   - Add og:image meta (can be a static image for now)

5. Final QA checklist — verify each of these works end to end:
   - [ ] Hive Keychain login with brave.sps → reaches /admin
   - [ ] Any other Hive account → /admin/unauthorized
   - [ ] Drag card from unranked → tier lane → saves to Supabase
   - [ ] Annotation (role + notes) saves and appears in hover popover on public site
   - [ ] Tier list page shows correct CDN images at max level
   - [ ] Soulbound cards show lock icon, absent from pricing
   - [ ] Pricing calculator returns live USD prices
   - [ ] Beginner mode toggle persists across page navigation
   - [ ] CSV export downloads correctly
   - [ ] Mobile layout renders without horizontal overflow
```
