import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAdmin, isUuid } from '@/lib/admin'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import { allRatings } from '@/lib/ratings/engine'
import { checkedProfile } from '@/lib/ratings/validation'
import {
  ratingDatabase,
  readWorkspace,
  readEvidence,
  saveDraft,
  writeSnapshot,
  publishedConfig,
} from '@/lib/ratings/store'
import { runCollector } from '@/lib/ratings/collector'
import { validAccount, validQueueId } from '@/lib/ratings/battles'
export const maxDuration = 300
function refresh() {
  revalidateTag('ratings')
  revalidateTag('rating-collection')
  revalidatePath('/cards')
  revalidatePath('/abilities')
  revalidatePath('/ratings/methodology')
}
export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await readWorkspace(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
export async function POST(request: NextRequest) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin)
    return NextResponse.json({ error: 'Origin mismatch' }, { status: 403 })
  const text = await request.text()
  if (text.length > 524288)
    return NextResponse.json(
      { error: 'Rating profile exceeds the 512 KiB limit' },
      { status: 413 },
    )
  let body: Record<string, unknown>
  try {
    body = JSON.parse(text)
    if (!body || Array.isArray(body)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  try {
    const cards = await getCatalogue()
    const ids = new Set(
      cards.filter((card) => card.kind !== 'land').map((card) => card.id),
    )
    if (body.action === 'save' || body.action === 'preview') {
      const config = checkedProfile(body.config, ids)
      if (body.action === 'preview') {
        const scores = allRatings(cards, config, await readEvidence())
        const selected = scores.cards
          .filter((r) => r.league === 'diamond' && r.format === 'modern')
          .sort((a, b) => b.score - a.score)
        return NextResponse.json({
          cards: selected.slice(0, 25).map((r) => ({
            cardId: r.cardId,
            name: cards.find((c) => c.id === r.cardId)?.name,
            score: r.score,
            curated: r.curated,
            battles: r.evidence.battles,
            confidence: r.confidence,
          })),
          count: scores.cards.length,
          abilities: scores.abilities.length,
          minimum: selected.at(-1)?.score,
          median: selected[Math.floor(selected.length / 2)]?.score,
          maximum: selected[0]?.score,
        })
      }
      if (!Number.isSafeInteger(body.revision))
        return NextResponse.json(
          { error: 'Draft revision is required' },
          { status: 400 },
        )
      const revision = await saveDraft(config, body.revision as number)
      return revision
        ? NextResponse.json({ revision })
        : NextResponse.json(
            {
              error:
                'This draft changed in another session. Reload before saving.',
            },
            { status: 409 },
          )
    }
    if (body.action === 'restore') {
      if (!isUuid(body.profileId) || !Number.isSafeInteger(body.revision))
        return NextResponse.json(
          { error: 'Valid profile and revision required' },
          { status: 400 },
        )
      const sql = ratingDatabase(),
        rows =
          await sql`SELECT config FROM rating_profiles WHERE id = ${body.profileId}::uuid`
      if (!rows.length)
        return NextResponse.json(
          { error: 'Profile not found' },
          { status: 404 },
        )
      const config = checkedProfile(rows[0].config, ids),
        revision = await saveDraft(config, body.revision as number)
      return revision
        ? NextResponse.json({ revision, config })
        : NextResponse.json(
            { error: 'Draft changed. Reload before restoring.' },
            { status: 409 },
          )
    }
    if (body.action === 'publish') {
      if (
        !Number.isSafeInteger(body.revision) ||
        typeof body.label !== 'string' ||
        !body.label.trim() ||
        body.label.length > 120 ||
        typeof body.notes !== 'string' ||
        !body.notes.trim() ||
        body.notes.length > 2000
      )
        return NextResponse.json(
          {
            error:
              'A revision, version label and publication reason are required',
          },
          { status: 400 },
        )
      const { workspace } = await readWorkspace()
      if (!workspace || workspace.revision !== body.revision)
        return NextResponse.json(
          { error: 'Draft changed. Reload before publishing.' },
          { status: 409 },
        )
      const config = checkedProfile(workspace.draft, ids)
      const revision = await writeSnapshot(
        randomUUID(),
        allRatings(cards, config, await readEvidence()),
        {
          config,
          revision: body.revision as number,
          label: body.label.trim(),
          notes: body.notes.trim(),
          author: process.env.NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT ?? 'brave.sps',
        },
      )
      if (!revision)
        return NextResponse.json(
          { error: 'Draft changed during publication. Reload and try again.' },
          { status: 409 },
        )
      refresh()
      return NextResponse.json({ revision, published: true })
    }
    if (body.action === 'refresh') {
      const profile = await publishedConfig()
      if (!profile)
        return NextResponse.json(
          { error: 'Publish a profile first' },
          { status: 409 },
        )
      await writeSnapshot(
        profile.id,
        allRatings(cards, profile.config, await readEvidence()),
      )
      refresh()
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'collect') {
      if (
        body.replayIds !== undefined &&
        (!Array.isArray(body.replayIds) ||
          body.replayIds.length > 100 ||
          !body.replayIds.every(validQueueId))
      )
        return NextResponse.json(
          { error: 'Provide at most 100 valid replay IDs' },
          { status: 400 },
        )
      if (body.players !== undefined) {
        if (
          !Array.isArray(body.players) ||
          body.players.length > 128 ||
          !body.players.every(validAccount)
        )
          return NextResponse.json(
            { error: 'Provide at most 128 valid player accounts' },
            { status: 400 },
          )
        const sql = ratingDatabase()
        await sql`INSERT INTO rating_collection_accounts (player, discovered_from) SELECT player, 'curator seed' FROM unnest(${body.players}::text[]) AS player ON CONFLICT (player) DO NOTHING`
      }
      const result = await runCollector(cards, {
        replayIds: body.replayIds as string[] | undefined,
      })
      refresh()
      return NextResponse.json(result)
    }
    return NextResponse.json(
      { error: 'Unknown rating action' },
      { status: 400 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    // Validation errors are safe to show. Never echo database/provider errors or secret URLs.
    if (
      /^(Unsupported|Standard ruleset|Summoner|Stat weights|Each league|Every current|Invalid ability|At most|Each synergy|Duplicate synergy|Invalid stat|Each adjustment|Duplicate card|Combined adjustments)/.test(
        message,
      )
    )
      return NextResponse.json({ error: message }, { status: 400 })
    console.error('[rating-admin] Operation failed')
    return NextResponse.json(
      { error: 'The rating operation could not be completed. Please retry.' },
      { status: 500 },
    )
  }
}
