import { NextRequest, NextResponse } from 'next/server'

/**
 * Debug endpoint to inspect raw Splinterlands rental API responses.
 * GET /api/debug/rent?id=720
 *
 * Returns the raw response from:
 *   - for_rent_grouped (first 5 entries + entries for card id)
 *   - for_rent_by_card?card_detail_id=<id> (raw, no edition param)
 *
 * Remove this route once rent pricing is confirmed working.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '720'
  const cardId = parseInt(id, 10)

  const results: Record<string, unknown> = {}

  // Test 1: for_rent_grouped
  try {
    const groupedRes = await fetch(
      'https://api2.splinterlands.com/market/for_rent_grouped',
      { cache: 'no-store' },
    )
    results.grouped_status = groupedRes.status
    results.grouped_ok = groupedRes.ok
    const raw = await groupedRes.text()
    results.grouped_raw_length = raw.length
    results.grouped_raw_prefix = raw.slice(0, 500)
    try {
      const data = JSON.parse(raw)
      results.grouped_is_array = Array.isArray(data)
      results.grouped_type = typeof data
      if (Array.isArray(data)) {
        results.grouped_total_count = data.length
        results.grouped_first_3 = data.slice(0, 3)
        results.grouped_top_level_keys = data.length > 0 ? Object.keys(data[0]) : []
        const forCard = data.filter((l: Record<string, unknown>) =>
          l.card_detail_id === cardId || l.card_id === cardId || l.uid === cardId,
        )
        results.grouped_card_matches = forCard.length
        results.grouped_card_first_3 = forCard.slice(0, 3)
      } else if (data && typeof data === 'object') {
        results.grouped_object_keys = Object.keys(data)
        const firstKey = Object.keys(data)[0]
        const nested = (data as Record<string, unknown>)[firstKey]
        if (Array.isArray(nested)) {
          results.grouped_nested_array_key = firstKey
          results.grouped_nested_first_3 = (nested as unknown[]).slice(0, 3)
          results.grouped_nested_top_level_keys =
            nested.length > 0 ? Object.keys(nested[0] as object) : []
        }
      }
    } catch {
      results.grouped_parse_error = 'JSON parse failed'
    }
  } catch (e) {
    results.grouped_fetch_error = String(e)
  }

  // Test 2: for_rent_by_card without edition param
  try {
    const perCardRes = await fetch(
      `https://api2.splinterlands.com/market/for_rent_by_card?card_detail_id=${cardId}&gold=false`,
      { cache: 'no-store' },
    )
    results.per_card_status = perCardRes.status
    results.per_card_ok = perCardRes.ok
    const raw = await perCardRes.text()
    results.per_card_raw_length = raw.length
    results.per_card_raw_prefix = raw.slice(0, 500)
    try {
      const data = JSON.parse(raw)
      results.per_card_is_array = Array.isArray(data)
      if (Array.isArray(data)) {
        results.per_card_count = data.length
        results.per_card_first_3 = data.slice(0, 3)
        results.per_card_top_level_keys = data.length > 0 ? Object.keys(data[0]) : []
      } else {
        results.per_card_object_keys = data && typeof data === 'object' ? Object.keys(data) : typeof data
      }
    } catch {
      results.per_card_parse_error = 'JSON parse failed'
    }
  } catch (e) {
    results.per_card_fetch_error = String(e)
  }

  // Test 3: for_rent_by_card with edition=12 (Rebellion)
  try {
    const withEditionRes = await fetch(
      `https://api2.splinterlands.com/market/for_rent_by_card?card_detail_id=${cardId}&gold=false&edition=12`,
      { cache: 'no-store' },
    )
    results.per_card_edition12_status = withEditionRes.status
    const raw = await withEditionRes.text()
    try {
      const data = JSON.parse(raw)
      results.per_card_edition12_is_array = Array.isArray(data)
      if (Array.isArray(data)) {
        results.per_card_edition12_count = data.length
        results.per_card_edition12_first_3 = data.slice(0, 3)
        results.per_card_edition12_keys = data.length > 0 ? Object.keys(data[0]) : []
      }
    } catch {
      results.per_card_edition12_parse_error = 'JSON parse failed'
    }
  } catch (e) {
    results.per_card_edition12_fetch_error = String(e)
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
