import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import { readPriceHistory } from '@/lib/market/store'
export const dynamic = 'force-dynamic'
const history = unstable_cache(readPriceHistory, ['card-price-history-v1'], {
  tags: ['card-price-history'],
  revalidate: 300,
})
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!/^\d+$/.test(params.id))
    return NextResponse.json({ error: 'Invalid card' }, { status: 400 })
  try {
    const card = (await getCatalogue()).find((c) => c.id === Number(params.id))
    if (!card)
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    const edition = Number(
      request.nextUrl.searchParams.get('edition') ?? card.editions[0],
    )
    if (!card.editions.includes(edition))
      return NextResponse.json({ error: 'Invalid edition' }, { status: 400 })
    return NextResponse.json(await history(card.id, edition), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json(
      { error: 'Price history is temporarily unavailable' },
      { status: 503 },
    )
  }
}
