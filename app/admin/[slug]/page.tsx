import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import Nav from '@/components/Nav'
import TierEditor from './TierEditor'
import { createAdminClient } from '@/lib/supabase/server'
import { getCardsForEdition } from '@/app/actions/cards'

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

export default async function EditorPage({ params }: { params: { slug: string } }) {
  const session = await requireSession()
  if (!session) notFound()

  const supabase = createAdminClient()

  // Load the card_set record
  const { data: cardSet } = await supabase
    .from('card_sets')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!cardSet) notFound()

  // Load existing tier entries for this set
  const { data: existingEntries } = await supabase
    .from('tier_entries')
    .select('*')
    .eq('set_id', cardSet.id)

  // Load all cards for this edition from SL API
  const cards = await getCardsForEdition(cardSet.name)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Nav />
      <TierEditor
        cardSet={cardSet}
        allCards={cards}
        existingEntries={existingEntries ?? []}
      />
    </div>
  )
}
