import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import Nav from '@/components/Nav'
import AdminLoginForm from '@/components/AdminLoginForm'
import AdminEditionList from '@/components/AdminEditionList'
import { createAdminClient } from '@/lib/supabase/server'
import { getAllCardsByEdition } from '@/app/actions/cards'

async function getSession(): Promise<{ account: string } | null> {
  const token = cookies().get('admin_token')?.value
  if (!token) return null
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) return null
  try {
    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    return { account: payload.account as string }
  } catch {
    return null
  }
}

export default async function AdminPage() {
  const session = await getSession()

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Nav />
        <main
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 52px)',
            padding: '2rem',
          }}
        >
          <AdminLoginForm />
        </main>
      </div>
    )
  }

  const supabase = createAdminClient()
  const { data: cardSets } = await supabase
    .from('card_sets')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: tierCounts } = await supabase
    .from('tier_entries')
    .select('set_id, updated_at')

  let cardsByEdition: Map<string, unknown[]> | null = null
  try {
    cardsByEdition = await getAllCardsByEdition() as Map<string, unknown[]>
  } catch {
    // SL API unavailable — degrade gracefully
  }

  type SetMeta = {
    rankedCount: number
    lastUpdated: string | null
    totalCards: number | null
  }
  const meta: Record<string, SetMeta> = {}
  for (const set of cardSets ?? []) {
    const entries = (tierCounts ?? []).filter((e) => e.set_id === set.id)
    const lastUpdated =
      entries.length > 0
        ? entries.reduce(
            (latest, e) => (e.updated_at > latest ? e.updated_at : latest),
            entries[0].updated_at,
          )
        : null
    meta[set.id] = {
      rankedCount: entries.length,
      lastUpdated,
      totalCards: cardsByEdition?.get(set.name)?.length ?? null,
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Nav />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.75rem',
          }}
        >
          <div>
            <h1
              style={{
                color: 'var(--text-primary)',
                fontSize: '1.4rem',
                fontWeight: 700,
                margin: 0,
              }}
            >
              Backoffice
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
              Signed in as{' '}
              <span style={{ color: 'var(--accent-gold)' }}>@{session.account}</span>
            </p>
          </div>
        </div>
        <AdminEditionList cardSets={cardSets ?? []} meta={meta} />
      </main>
    </div>
  )
}
