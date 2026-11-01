import { NextRequest, NextResponse } from 'next/server'
import { authorizeCollector } from '@/lib/ratings/collector-auth'
import { revalidateTag } from 'next/cache'
import { runCollector } from '@/lib/ratings/collector'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
export async function GET(request: NextRequest) {
  const authorization = await authorizeCollector(request.headers.get('authorization') ?? '')
  if (!authorization)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await runCollector(await getCatalogue())
    revalidateTag('rating-collection')
    if (authorization === 'deployment' || ('ratingsRefreshed' in result && result.ratingsRefreshed))
      revalidateTag('ratings')
    return NextResponse.json({...result, deploymentCommit: process.env.VERCEL_GIT_COMMIT_SHA}, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    console.error('[rating-collector] Collection could not start')
    return NextResponse.json(
      { error: 'Collection could not start' },
      { status: 500 },
    )
  }
}
