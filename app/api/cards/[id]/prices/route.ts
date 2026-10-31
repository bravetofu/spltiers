import { NextRequest, NextResponse } from 'next/server'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import {
  summarizePrices,
  type SaleListing,
} from '@/lib/splinterlands/card-prices'
import { fetchRuniFloorPrice } from '@/lib/opensea'

export const dynamic = 'force-dynamic'
export const maxDuration = 30
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const headers = {
    'Cache-Control': request.nextUrl.searchParams.has('refresh')
      ? 'no-store'
      : 'public, s-maxage=30, stale-while-revalidate=30',
  }
  if (!/^\d+$/.test(params.id))
    return NextResponse.json({ error: 'Invalid card' }, { status: 400 })
  try {
    const card = (await getCatalogue()).find(
      (card) => card.id === Number(params.id)
    )
    if (!card)
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    const edition = Number(
      request.nextUrl.searchParams.get('edition') ?? card.editions[0]
    )
    if (!card.editions.includes(edition))
      return NextResponse.json({ error: 'Invalid edition' }, { status: 400 })
    if (card.id === 505) {
      const price = await fetchRuniFloorPrice()
      if (!price)
        return NextResponse.json(
          { error: 'OpenSea pricing is temporarily unavailable' },
          { status: 502 }
        )
      return NextResponse.json(
        {
          source: 'OpenSea',
          floorUsd: price.floor_usd,
          prices: [],
          fetchedAt: new Date().toISOString(),
        },
        { headers }
      )
    }
    const pages = await Promise.all(
      [false, true].map(async (gold) => {
        const res = await fetch(
          `https://api2.splinterlands.com/market/for_sale_by_card?card_detail_id=${card.id}&gold=${gold}&edition=${edition}`,
          {
            cache: 'no-store',
            signal: AbortSignal.timeout(20000),
          }
        )
        if (!res.ok) throw new Error(`Market API: ${res.status}`)
        const data: unknown = await res.json()
        if (!Array.isArray(data)) throw new Error('Invalid market response')
        return data as SaleListing[]
      })
    )
    return NextResponse.json(
      {
        source: 'Splinterlands market',
        prices: summarizePrices(pages.flat(), edition),
        fetchedAt: new Date().toISOString(),
      },
      { headers }
    )
  } catch (error) {
    console.error('[card-prices]', error)
    return NextResponse.json(
      { error: 'Live prices are temporarily unavailable. Please try again.' },
      { status: 502 }
    )
  }
}
