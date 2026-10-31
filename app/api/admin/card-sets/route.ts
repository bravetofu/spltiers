import { NextRequest, NextResponse } from 'next/server'
import { createCardSet, setCardSetActive } from '@/lib/db'
import { isUuid, requireAdmin, revalidateEditions } from '@/lib/admin'

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body.name !== 'string' || !body.name.trim() ||
      typeof body.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) ||
      (body.icon_url != null && typeof body.icon_url !== 'string') ||
      (body.sort_order != null && !Number.isSafeInteger(body.sort_order))) {
    return NextResponse.json({ error: 'Valid name, slug, icon_url and sort_order are required' }, { status: 400 })
  }
  try {
    const data = await createCardSet({
      name: body.name.trim(), slug: body.slug, icon_url: body.icon_url ?? null, sort_order: body.sort_order ?? 0,
    })
    revalidateEditions(data.slug)
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[card-sets] Create failed:', error)
    return NextResponse.json({ error: 'Could not create edition. The slug must be unique.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || !isUuid(body.id) || typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'id and boolean is_active are required' }, { status: 400 })
  }
  try {
    const data = await setCardSetActive(body.id, body.is_active)
    if (!data) return NextResponse.json({ error: 'Edition not found' }, { status: 404 })
    revalidateEditions(data.slug)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[card-sets] Update failed:', error)
    return NextResponse.json({ error: 'Could not update edition' }, { status: 500 })
  }
}
