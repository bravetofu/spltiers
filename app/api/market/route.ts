import { NextRequest, NextResponse } from 'next/server'
import { fetchRuniFloorPrice } from '@/lib/opensea'

/**
 * Proxy for Splinterlands market API to avoid CORS issues.
 * GET /api/market?type=sale&id=123
 * GET /api/market?type=rent&id=123
 * GET /api/market?type=opensea-runi   (no id required — Runi only)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const type = searchParams.get('type')
  const id = searchParams.get('id')

  // ── OpenSea: Runi floor price ────────────────────────────────────────────────
  if (type === 'opensea-runi') {
    const data = await fetchRuniFloorPrice()
    if (!data) {
      return NextResponse.json(
        { error: 'Failed to fetch Runi floor price from OpenSea/CoinGecko' },
        { status: 502 },
      )
    }
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
    })
  }

  // ── Splinterlands market ─────────────────────────────────────────────────────
  if (!id || !type) {
    return NextResponse.json({ error: 'Missing params: type and id required' }, { status: 400 })
  }

  let url: string
  if (type === 'sale') {
    url = `https://api2.splinterlands.com/market/for_sale_by_card?card_detail_id=${encodeURIComponent(id)}&gold=false`
  } else if (type === 'rent') {
    url = `https://api2.splinterlands.com/market/for_rent_by_card?card_detail_id=${encodeURIComponent(id)}`
  } else {
    return NextResponse.json({ error: 'Invalid type: must be sale, rent, or opensea-runi' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { 'Accept-Encoding': 'gzip, deflate, br, zstd' },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream error: ${res.status}` }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach Splinterlands API' }, { status: 502 })
  }
}
