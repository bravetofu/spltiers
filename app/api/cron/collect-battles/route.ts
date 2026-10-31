import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { runCollector } from '@/lib/ratings/collector'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('authorization') ?? ''
  const expectedBytes = Buffer.from(`Bearer ${secret ?? ''}`),
    providedBytes = Buffer.from(provided)
  if (
    !secret ||
    providedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(providedBytes, expectedBytes)
  )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await runCollector(await getCatalogue())
    revalidateTag('ratings')
    return NextResponse.json(result, {
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
