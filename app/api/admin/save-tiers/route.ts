import { NextRequest, NextResponse } from 'next/server'
import { saveTierEntries, type TierInput } from '@/lib/db'
import { isUuid, requireAdmin, revalidateEditions } from '@/lib/admin'

function validEntry(entry: unknown, setId: string): entry is TierInput {
  if (!entry || typeof entry !== 'object') return false
  const e = entry as Record<string, unknown>
  return e.set_id === setId && Number.isSafeInteger(e.card_id) &&
    typeof e.card_name === 'string' && typeof e.edition === 'string' && typeof e.cdn_slug === 'string' &&
    Number.isInteger(e.rarity) && Number(e.rarity) >= 1 && Number(e.rarity) <= 4 &&
    (e.tier === null || ['S', 'A', 'B', 'C', 'D'].includes(String(e.tier))) &&
    (e.role == null || typeof e.role === 'string') && (e.notes == null || typeof e.notes === 'string') &&
    typeof e.is_soulbound === 'boolean'
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || !isUuid(body.set_id) || !Array.isArray(body.entries) ||
      !body.entries.every((entry: unknown) => validEntry(entry, body.set_id))) {
    return NextResponse.json({ error: 'A valid set_id and entries for that edition are required' }, { status: 400 })
  }
  const tieredEntries: TierInput[] = body.entries.filter((entry: TierInput) => entry.tier !== null)
  if (new Set(tieredEntries.map((entry) => entry.card_id)).size !== tieredEntries.length) {
    return NextResponse.json({ error: 'Duplicate card entries' }, { status: 400 })
  }
  try {
    const slug = await saveTierEntries(body.set_id, tieredEntries)
    if (!slug) return NextResponse.json({ error: 'Edition not found' }, { status: 404 })
    revalidateEditions(slug)
    return NextResponse.json({ ok: true, saved: tieredEntries.length })
  } catch (error) {
    console.error('[save-tiers] Transaction failed:', error)
    return NextResponse.json({ error: 'Could not save tiers. Previous rankings were preserved.' }, { status: 500 })
  }
}
