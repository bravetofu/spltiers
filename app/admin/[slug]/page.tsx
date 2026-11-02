import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import Nav from '@/components/Nav'
import TierEditor from './TierEditor'
import { getCardSet, getTierEntries } from '@/lib/db'
import { getCardsForEdition } from '@/app/actions/cards'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import { getTierReferenceRatings } from '@/lib/ratings/server'

async function requireSession() {
  const token = cookies().get('admin_token')?.value
  if (!token || !process.env.JWT_SECRET) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export default async function EditorPage({
  params,
}: {
  params: { slug: string }
}) {
  const session = await requireSession()
  if (!session) notFound()

  const cardSet = await getCardSet(params.slug, false)
  if (!cardSet) notFound()
  const existingEntries = await getTierEntries(cardSet.id, true)

  // Load all cards for this edition from SL API
  const cards = await getCardsForEdition(cardSet.name)
  const catalogue = await getCatalogue()
  const catalogueUnits = new Set(
    catalogue.filter((c) => c.kind === 'unit').map((c) => c.id),
  )
  const unitIds = cards
    .filter((card) => catalogueUnits.has(card.card_id))
    .map((card) => card.card_id)
  const ratings = await getTierReferenceRatings(unitIds).catch(() => null)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Nav />
      <TierEditor
        cardSet={cardSet}
        allCards={cards}
        existingEntries={existingEntries ?? []}
        ratings={ratings}
        unitIds={unitIds}
      />
    </div>
  )
}
