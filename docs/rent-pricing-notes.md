# Rent Pricing Notes

## Working endpoint

```
GET https://api2.splinterlands.com/market/for_rent_grouped
```

- Returns a bare array of ~1654 entries (not wrapped in an object)
- Fields: `card_detail_id`, `gold`, `foil`, `edition`, `qty`, `level`, `low_price_bcx`, `low_price`, `high_price`, `mana`, `season_qty`, `daily_qty`
- `low_price` is the cheapest rental price in DEC for that card/level combination
- `for_rent_by_card` returns empty — do not use

## Rent logic

1. Filter by `card_detail_id` + `gold: false` + `level >= target_level`
2. Take the entry with the lowest `low_price`
3. Convert `low_price` (DEC) → USD via DEC/USD rate from CoinGecko
4. Fetch once per calculator run and filter client-side — not once per card

## Status cases

| Status | Condition | Display |
|---|---|---|
| `ok` | Listing exists at exactly `target_level` | Default colour |
| `above_only` | No listing at `target_level`, but one exists above | Amber warning — overpaying |
| `below_only` | No listing at or above `target_level` | Red warning — card underlevelled |
| `null` | No listings at all | `—` |

## Fallback

If no entry at `target_level`, check higher levels first (`above_only`), then lower (`below_only`).
Show `level X available` / `level X only` sub-label under the price.
