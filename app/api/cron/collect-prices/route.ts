import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { authorizeCollector } from '@/lib/ratings/collector-auth'
import { collectDailyPrices } from '@/lib/market/collector'
import { priceHistoryTag } from '@/lib/market/cache'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
export async function GET(request: NextRequest) {
  if (
    !(await authorizeCollector(
      request.headers.get('authorization') ?? '',
      process.env.CRON_SECRET,
      'prices',
    ))
  )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const commit = request.nextUrl.searchParams.get('commit')
  if (commit && commit !== process.env.VERCEL_GIT_COMMIT_SHA)
    return NextResponse.json(
      { error: 'Deployment is not ready' },
      { status: 409 },
    )
  try {
    const result = await collectDailyPrices(await getCatalogue(), {
      retryFailed: request.nextUrl.searchParams.get('retry') === '1',
      onSaved: (cardId, edition) =>
        revalidateTag(priceHistoryTag(cardId, edition)),
    })
    return NextResponse.json(
      { ...result, deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    console.error(
      '[price-collector] Collection interrupted; completed snapshots retained',
    )
    return NextResponse.json(
      { error: 'Collection interrupted; retry to resume' },
      { status: 500 },
    )
  }
}
