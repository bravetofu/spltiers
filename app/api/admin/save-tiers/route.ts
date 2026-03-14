import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'

async function requireAdmin(): Promise<boolean> {
  const token = cookies().get('admin_token')?.value
  if (!token || !process.env.JWT_SECRET) return false
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

type TierEntryPayload = {
  set_id: string
  card_id: number
  card_name: string
  edition: string
  cdn_slug: string
  rarity: number
  tier: string | null
  role: string | null
  notes: string | null
  is_soulbound: boolean
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { set_id, entries } = await req.json() as {
    set_id: string
    entries: TierEntryPayload[]
  }

  if (!set_id || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'set_id and entries[] required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Delete all existing entries for this set, then re-insert.
  // This is simpler and correct: the editor always sends the full state.
  const { error: delError } = await supabase
    .from('tier_entries')
    .delete()
    .eq('set_id', set_id)

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 })
  }

  // Only persist cards that have been assigned a tier
  const tieredEntries = entries.filter((e) => e.tier !== null)

  if (tieredEntries.length > 0) {
    const rows = tieredEntries.map((e) => ({
      set_id: e.set_id,
      card_id: e.card_id,
      card_name: e.card_name,
      edition: e.edition,
      cdn_slug: e.cdn_slug,
      rarity: e.rarity,
      tier: e.tier,
      role: e.role ?? null,
      notes: e.notes ?? null,
      is_soulbound: e.is_soulbound,
      updated_at: new Date().toISOString(),
    }))

    const { error: insError } = await supabase.from('tier_entries').insert(rows)
    if (insError) {
      return NextResponse.json({ error: insError.message }, { status: 500 })
    }
  }

  // Bust ISR cache for the affected public pages
  const { data: cardSet } = await supabase
    .from('card_sets')
    .select('slug')
    .eq('id', set_id)
    .single()

  if (cardSet?.slug) {
    revalidatePath(`/tier-list/${cardSet.slug}`)
    revalidatePath('/')
  }

  return NextResponse.json({ ok: true, saved: tieredEntries.length })
}
