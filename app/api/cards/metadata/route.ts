import { NextResponse } from 'next/server'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'

export const revalidate = 3600

// Tier-list popovers only need a bloodline, not the full upstream game feed.
export async function GET() {
  const cards = await getCatalogue()
  return NextResponse.json(
    Object.fromEntries(cards.map((card) => [card.id, card.bloodline]))
  )
}
