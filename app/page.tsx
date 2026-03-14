import Link from 'next/link'
import Nav from '@/components/Nav'
import EditionCard, { type EditionCardData } from '@/components/EditionCard'
import { createPublicClient } from '@/lib/supabase/server'
import { getAllCardsByEdition } from '@/app/actions/cards'
import { getEditionFormat, type EditionFormat } from '@/lib/editions'

export const revalidate = 3600

type CardSet = {
  id: string
  slug: string
  name: string
  is_active: boolean
  sort_order: number
}

export default async function HomePage() {
  // Supabase calls are wrapped in try/catch so the page renders gracefully
  // when env vars are absent (e.g. during `next build` without .env.local).
  let cardSets: CardSet[] = []
  let tierCounts: { set_id: string }[] = []

  try {
    const supabase = createPublicClient()
    const [setsRes, countsRes] = await Promise.all([
      supabase
        .from('card_sets')
        .select('id, slug, name, is_active, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase.from('tier_entries').select('set_id'),
    ])
    cardSets = setsRes.data ?? []
    tierCounts = countsRes.data ?? []
  } catch {
    // Supabase unavailable at build time — render empty edition list
  }

  // Card counts from SL API — best-effort, graceful degradation
  let cardsByEdition: Map<string, unknown[]> | null = null
  try {
    cardsByEdition = await getAllCardsByEdition() as Map<string, unknown[]>
  } catch {
    // SL API unavailable
  }

  // Build ranked counts map: set_id → count
  const rankedMap: Record<string, number> = {}
  for (const row of tierCounts) {
    rankedMap[row.set_id] = (rankedMap[row.set_id] ?? 0) + 1
  }

  const setsWithMeta: EditionCardData[] = cardSets.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    format: getEditionFormat(s.name),
    totalCards: cardsByEdition?.get(s.name)?.length ?? null,
    rankedCount: rankedMap[s.id] ?? 0,
  }))

  const modernSets = setsWithMeta.filter((s) => s.format === 'modern')
  const wildSets = setsWithMeta.filter((s) => s.format === 'wild')
  const otherSets = setsWithMeta.filter((s) => s.format === 'other')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Nav />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>
        {/* Hero */}
        <div style={{ marginBottom: '3rem' }}>
          <h1
            style={{
              color: '#f0f6fc',
              fontSize: 32,
              fontWeight: 500,
              margin: '0 0 0.5rem',
              letterSpacing: '-0.01em',
            }}
          >
            Splinterlands tier lists
          </h1>
        </div>

        {/* Modern format */}
        {modernSets.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <SectionLabel>modern format</SectionLabel>
            <EditionGrid sets={modernSets} format="modern" />
          </section>
        )}

        {/* Wild format */}
        {wildSets.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <SectionLabel>wild format</SectionLabel>
            <EditionGrid sets={wildSets} format="wild" />
          </section>
        )}

        {/* Other (not classified) */}
        {otherSets.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <SectionLabel>other editions</SectionLabel>
            <EditionGrid sets={otherSets} format="other" />
          </section>
        )}

        {setsWithMeta.length === 0 && (
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
              textAlign: 'center',
              padding: '3rem 0',
            }}
          >
            No editions published yet — check back soon.
          </p>
        )}

        {/* Pricing promo block */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '1.5rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
            flexWrap: 'wrap',
            marginTop: '1rem',
          }}
        >
          <div>
            <p
              style={{
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '1rem',
                margin: '0 0 0.3rem',
              }}
            >
              Pricing calculator
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              Select editions + tiers and get live buy &amp; rent prices from the Splinterlands
              market.
            </p>
          </div>
          <Link
            href="/pricing"
            style={{
              background: 'var(--accent-red)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '0.55rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Calculate prices →
          </Link>
        </div>
      </main>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: '#8b949e',
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        margin: '0 0 0.75rem',
      }}
    >
      {children}
    </p>
  )
}

function EditionGrid({ sets, format }: { sets: EditionCardData[]; format: EditionFormat }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
      }}
    >
      {sets.map((set) => (
        <EditionCard key={set.id} set={set} format={format} />
      ))}
    </div>
  )
}
