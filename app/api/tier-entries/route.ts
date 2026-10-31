import { NextResponse } from 'next/server'
import { getDeckEntries } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await getDeckEntries())
  } catch (error) {
    console.error('[tier-entries] Query failed:', error)
    return NextResponse.json({ error: 'Could not load card rankings' }, { status: 503 })
  }
}
