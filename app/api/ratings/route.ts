import { NextRequest, NextResponse } from 'next/server'
import { getRatingIndex, getAbilityRatings } from '@/lib/ratings/server'
import { LEAGUES, type League, type BattleFormat } from '@/lib/ratings/types'
export async function GET(request: NextRequest) {
  const league = request.nextUrl.searchParams.get('league') ?? 'diamond'
  const format = request.nextUrl.searchParams.get('format') ?? 'auto'
  const kind = request.nextUrl.searchParams.get('kind') ?? 'card'
  if (
    !(LEAGUES as readonly string[]).includes(league) ||
    !['modern', 'wild', 'auto'].includes(format) ||
    !['card', 'ability'].includes(kind) ||
    (kind === 'ability' && format === 'auto')
  )
    return NextResponse.json({ error: 'Invalid rating scope' }, { status: 400 })
  try {
    const data =
      kind === 'card'
        ? await getRatingIndex(
            league as League,
            format as BattleFormat | 'auto',
          )
        : await getAbilityRatings(league as League, format as BattleFormat)
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(
      '[ratings] Read failed:',
      error instanceof Error ? error.message : 'database error',
    )
    return NextResponse.json(
      { error: 'Ratings are temporarily unavailable' },
      { status: 503 },
    )
  }
}
