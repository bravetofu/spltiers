'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Nav from '@/components/Nav'
import CardThumb from '@/components/CardThumb'
import { createClient } from '@/lib/supabase/client'
import { rarityMaxLevel, LEAGUE_LEVEL_CAPS } from '@/lib/editions'
import {
  fetchPrices,
  type BuyMethod,
  type CardInput,
  type FoilType,
  type PricingResult,
} from '@/app/actions/pricing'
import { getEditionFormat } from '@/lib/editions'

type TierEntry = {
  card_id: number
  card_name: string
  edition: string
  cdn_slug: string
  rarity: number
  tier: string
}

type FullResult = CardInput & {
  buy_usd: number | null
  buy_bcx: number | null
  buy_target_bcx: number | null
  buy_method: BuyMethod | null
  insufficient_supply: boolean
  is_outlier: boolean
  foil_type: FoilType | null
}

const TIERS = ['S', 'A', 'B', 'C', 'D'] as const

const RARITY_NAMES: Record<number, string> = {
  1: 'Common',
  2: 'Rare',
  3: 'Epic',
  4: 'Legendary',
}

const TIER_LABEL_STYLE: Record<string, { bg: string; color: string }> = {
  S: { bg: '#ffd700', color: '#0d1117' },
  A: { bg: '#2ecc71', color: '#0d1117' },
  B: { bg: '#3498db', color: '#0d1117' },
  C: { bg: '#95a5a6', color: '#0d1117' },
  D: { bg: '#555e6a', color: '#adb5bd' },
}

const TIER_PILL_STYLE: Record<string, { bg: string; color: string }> = {
  S: { bg: '#3d3000', color: '#ffd700' },
  A: { bg: '#0d3320', color: '#2ecc71' },
  B: { bg: '#0d2440', color: '#3498db' },
  C: { bg: '#1c2128', color: '#95a5a6' },
  D: { bg: '#161b22', color: '#555e6a' },
}

const LEAGUES = ['bronze', 'silver', 'gold', 'diamond'] as const
type League = typeof LEAGUES[number]

const LEAGUE_STYLE: Record<League, { bg: string; color: string; label: string }> = {
  bronze:  { bg: '#cd7f32', color: '#0d1117', label: 'Bronze'   },
  silver:  { bg: '#c0c0c0', color: '#0d1117', label: 'Silver'   },
  gold:    { bg: '#ffd700', color: '#0d1117', label: 'Gold'     },
  diamond: { bg: '#6ee7f7', color: '#0d1117', label: 'Diamond+' },
}

function leagueTooltip(league: League): string {
  const caps = LEAGUE_LEVEL_CAPS[league]
  return `C${caps[1]} · R${caps[2]} · E${caps[3]} · L${caps[4]}`
}

function formatUsd(val: number | null): string {
  if (val === null) return '—'
  if (val > 0.10) return `$${val.toFixed(2)}`
  if (val > 0) return `$${val.toFixed(4)}`
  return '$0.00'
}

function formatUsdSum(val: number): string {
  if (val > 0.10) return `$${val.toFixed(2)}`
  if (val > 0) return `$${val.toFixed(4)}`
  return '—'
}

function sumUsd(vals: (number | null)[]): number {
  return vals.reduce<number>((acc, v) => acc + (v ?? 0), 0)
}

function exportCsv(rows: FullResult[], league: League) {
  const leagueLabel = LEAGUE_STYLE[league].label
  const header = 'Card Name,Edition,Tier,Rarity,League,Target Level,Buy USD,Buy BCX,Buy Method'
  const lines = rows.map((r) =>
    [
      `"${r.card_name.replace(/"/g, '""')}"`,
      `"${r.edition}"`,
      r.tier,
      RARITY_NAMES[r.rarity] ?? '',
      leagueLabel,
      LEAGUE_LEVEL_CAPS[league]?.[r.rarity] ?? '',
      r.buy_usd !== null ? r.buy_usd.toFixed(4) : '',
      r.buy_bcx !== null ? r.buy_bcx : '',
      r.buy_method ?? '',
    ].join(','),
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `spltiers-deck-builder-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const COL = '40px minmax(130px,1fr) 140px 50px 80px 120px'

const LABEL_STYLE = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  marginBottom: '0.5rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  fontWeight: 500,
}

const FORMAT_ROW_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  color: '#8b949e',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  flexShrink: 0,
  width: 52,
}

function EditionChip({
  edition,
  active,
  onToggle,
}: {
  edition: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      className="chip-btn"
      onClick={onToggle}
      style={{
        padding: '4px 12px',
        borderRadius: 6,
        border: active ? '1px solid #1f6feb' : '1px solid var(--border-default)',
        background: active ? '#1c3a5e' : 'var(--bg-tertiary)',
        color: active ? '#79b8f2' : 'var(--text-secondary)',
        fontSize: '0.75rem',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
      }}
    >
      {edition}
    </button>
  )
}

function AllNoneToggle({
  editions,
  selectedEditions,
  setSelectedEditions,
}: {
  editions: string[]
  selectedEditions: Set<string>
  setSelectedEditions: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: 10,
    color: '#8b949e',
    cursor: 'pointer',
    fontWeight: 500,
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 4 }}>
      <button style={btnStyle} onClick={() => setSelectedEditions((prev) => { const next = new Set(prev); editions.forEach((e) => next.add(e)); return next })}>All</button>
      <span style={{ color: '#484f58', fontSize: 10 }}>·</span>
      <button style={btnStyle} onClick={() => setSelectedEditions((prev) => { const next = new Set(prev); editions.forEach((e) => next.delete(e)); return next })}>None</button>
    </span>
  )
}

function EditionGroups({
  availableEditions,
  selectedEditions,
  toggleEdition,
  setSelectedEditions,
}: {
  availableEditions: string[]
  selectedEditions: Set<string>
  toggleEdition: (e: string) => void
  setSelectedEditions: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const modernEditions = availableEditions.filter((e) => getEditionFormat(e) === 'modern')
  const wildEditions   = availableEditions.filter((e) => getEditionFormat(e) === 'wild')
  const otherEditions  = availableEditions.filter((e) => getEditionFormat(e) === 'other')

  const groups = [
    { label: 'Modern', editions: modernEditions },
    { label: 'Wild',   editions: wildEditions },
    ...(otherEditions.length > 0 ? [{ label: 'Other', editions: otherEditions }] : []),
  ].filter((g) => g.editions.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map(({ label, editions }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={FORMAT_ROW_LABEL}>{label}</span>
            <AllNoneToggle editions={editions} selectedEditions={selectedEditions} setSelectedEditions={setSelectedEditions} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {editions.map((edition) => (
              <EditionChip key={edition} edition={edition} active={selectedEditions.has(edition)} onToggle={() => toggleEdition(edition)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DeckBuilderPage() {
  const [entries, setEntries] = useState<TierEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [selectedEditions, setSelectedEditions] = useState<Set<string>>(new Set())
  const editionsInitialized = useRef(false)
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(new Set(['S', 'A']))
  const [selectedLeague, setSelectedLeague] = useState<League>('diamond')
  const [isPending, startTransition] = useTransition()
  const [showSlowMsg, setShowSlowMsg] = useState(false)
  const [result, setResult] = useState<PricingResult | null>(null)
  const [resultCards, setResultCards] = useState<CardInput[]>([])
  const [resultLeague, setResultLeague] = useState<League>('diamond')
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [excludeUnavailable, setExcludeUnavailable] = useState(false)
  const [excludeOutliers, setExcludeOutliers] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('tier_entries')
      .select('card_id, card_name, edition, cdn_slug, rarity, tier, is_soulbound')
      .eq('is_soulbound', false)
      .not('tier', 'is', null)
      .then(({ data }) => {
        const rows = (data as TierEntry[]) ?? []
        setEntries(rows)
        setLoadingEntries(false)
        // Select all editions on first load
        if (!editionsInitialized.current) {
          editionsInitialized.current = true
          setSelectedEditions(new Set(rows.map((e) => e.edition)))
        }
      })
  }, [])

  const availableEditions = Array.from(new Set(entries.map((e) => e.edition))).sort()

  const filteredEntries = entries.filter(
    (e) => selectedEditions.has(e.edition) && selectedTiers.has(e.tier),
  )

  const uniqueCards: CardInput[] = (() => {
    const seen = new Set<number>()
    const cards: CardInput[] = []
    for (const e of filteredEntries) {
      if (!seen.has(e.card_id)) {
        seen.add(e.card_id)
        cards.push(e)
      }
    }
    return cards
  })()

  const toggleEdition = (edition: string) => {
    setSelectedEditions((prev) => {
      const next = new Set(prev)
      next.has(edition) ? next.delete(edition) : next.add(edition)
      return next
    })
  }

  const toggleTier = (tier: string) => {
    setSelectedTiers((prev) => {
      const next = new Set(prev)
      next.has(tier) ? next.delete(tier) : next.add(tier)
      return next
    })
  }

  const canCalculate = selectedEditions.size > 0 && selectedTiers.size > 0 && uniqueCards.length > 0

  // Show a 'slow fetch' hint after 3 seconds of pending
  useEffect(() => {
    if (!isPending) { setShowSlowMsg(false); return }
    const t = setTimeout(() => setShowSlowMsg(true), 3000)
    return () => clearTimeout(t)
  }, [isPending])

  const handleCalculate = () => {
    if (!canCalculate) return
    setResultCards(uniqueCards)
    setResultLeague(selectedLeague)
    setExcludeUnavailable(false)
    setExcludeOutliers(false)
    startTransition(async () => {
      const res = await fetchPrices(uniqueCards, selectedLeague)
      setResult(res)
      setFetchedAt(new Date().toLocaleString())
    })
  }

  const fullResults: FullResult[] = resultCards.map((card) => {
    const price = result?.prices.find((p) => p.card_id === card.card_id)
    return {
      ...card,
      buy_usd: price?.buy_usd ?? null,
      buy_bcx: price?.buy_bcx ?? null,
      buy_target_bcx: price?.buy_target_bcx ?? null,
      buy_method: price?.buy_method ?? null,
      insufficient_supply: price?.insufficient_supply ?? false,
      is_outlier: price?.is_outlier ?? false,
      foil_type: price?.foil_type ?? null,
    }
  })

  // Warning flags — always derived from the unfiltered full set
  const hasUnavailable = fullResults.some((r) => r.insufficient_supply)
  const hasOutliers = fullResults.some((r) => r.is_outlier)

  // Display set — filtered by active exclusion chips
  const displayResults = fullResults.filter((r) => {
    if (excludeUnavailable && r.insufficient_supply) return false
    if (excludeOutliers && r.is_outlier) return false
    return true
  })

  const byEdition = new Map<string, FullResult[]>()
  for (const r of displayResults) {
    const arr = byEdition.get(r.edition) ?? []
    arr.push(r)
    byEdition.set(r.edition, arr)
  }

  // Summary stats — derived from displayed (possibly filtered) cards
  const totalBuy = sumUsd(displayResults.map((r) => r.buy_usd))
  const cardsWithPrice = displayResults.filter((r) => r.buy_usd !== null)
  const avgPerCard = cardsWithPrice.length > 0 ? totalBuy / cardsWithPrice.length : null
  const mostExpensive = cardsWithPrice.reduce<FullResult | null>(
    (best, r) => (best === null || (r.buy_usd ?? 0) > (best.buy_usd ?? 0) ? r : best),
    null,
  )

  const showResults = result !== null && !isPending

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .chip-btn { transition: background 0.15s, border-color 0.15s, color 0.15s; }
        .chip-btn:hover { opacity: 0.85; }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Nav />
        <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Deck Builder
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Explore the real cost of building a competitive deck — filter by edition, tier, and league to see live market prices.
          </p>

          {/* Config panel */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              padding: '1.25rem 1.5rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* Editions */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={LABEL_STYLE}>Editions</div>
              {loadingEntries ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[0, 1].map((row) => (
                    <div key={row} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[80, 100, 120, 90].map((w, i) => (
                        <div key={i} style={{ height: 28, width: w, background: '#21262d', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <EditionGroups
                  availableEditions={availableEditions}
                  selectedEditions={selectedEditions}
                  toggleEdition={toggleEdition}
                  setSelectedEditions={setSelectedEditions}
                />
              )}
            </div>

            {/* Tiers */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={LABEL_STYLE}>Tiers</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {TIERS.map((tier) => {
                  const active = selectedTiers.has(tier)
                  const col = TIER_LABEL_STYLE[tier]
                  return (
                    <button
                      key={tier}
                      className="chip-btn"
                      onClick={() => toggleTier(tier)}
                      style={{
                        width: 38,
                        height: 32,
                        borderRadius: 6,
                        border: active ? 'none' : '1px solid var(--border-default)',
                        background: active ? col.bg : 'var(--bg-tertiary)',
                        color: active ? col.color : 'var(--text-muted)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {tier}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* League + CTA */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={LABEL_STYLE}>League</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {LEAGUES.map((league) => {
                    const active = selectedLeague === league
                    const col = LEAGUE_STYLE[league]
                    return (
                      <button
                        key={league}
                        className="chip-btn"
                        title={leagueTooltip(league)}
                        onClick={() => setSelectedLeague(league)}
                        style={{
                          padding: '4px 12px',
                          height: 32,
                          borderRadius: 6,
                          border: active ? 'none' : '1px solid var(--border-default)',
                          background: active ? col.bg : 'var(--bg-tertiary)',
                          color: active ? col.color : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          fontWeight: active ? 700 : 400,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={handleCalculate}
                  disabled={!canCalculate || isPending}
                  style={{
                    padding: '7px 20px',
                    height: 32,
                    minWidth: 200,
                    background: canCalculate && !isPending ? 'var(--accent-red)' : '#3d1c1c',
                    border: 'none',
                    borderRadius: 8,
                    color: canCalculate && !isPending ? '#fff' : '#8b949e',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: canCalculate && !isPending ? 'pointer' : 'not-allowed',
                    transition: 'background 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {isPending ? (
                    <>
                      <span style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                        flexShrink: 0,
                      }} />
                      Calculating...
                    </>
                  ) : uniqueCards.length > 0 ? (
                    `Calculate prices (${uniqueCards.length} cards)`
                  ) : (
                    'Calculate prices'
                  )}
                </button>
                {showSlowMsg && (
                  <span style={{ fontSize: 12, color: '#8b949e' }}>
                    Fetching live market data — this may take a moment
                  </span>
                )}
              </div>

              {!loadingEntries && selectedEditions.size === 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)', alignSelf: 'center' }}>
                  Select at least one edition to continue.
                </span>
              )}
            </div>
          </div>

          {/* Loading skeleton */}
          {isPending && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, height: 80, background: 'var(--bg-secondary)', borderRadius: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
              </div>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: '#21262d', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
                      {[2, 1.2, 0.8, 0.7, 0.7].map((w, j) => (
                        <div key={j} style={{ flex: w, height: 12, borderRadius: 4, background: '#21262d', animation: `pulse ${1.3 + j * 0.1}s ease-in-out infinite` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {showResults && (
            <div>
              {/* Summary metric cards */}
              <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {/* Total buy cost */}
                <div style={{ flex: 1, minWidth: 140, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                    Total buy cost
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatUsdSum(totalBuy)}
                  </div>
                </div>

                {/* Avg per card */}
                <div style={{ flex: 1, minWidth: 140, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                    Avg per card
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {avgPerCard !== null ? `$${avgPerCard.toFixed(2)}` : '—'}
                  </div>
                </div>

                {/* Most expensive card */}
                <div style={{ flex: 1, minWidth: 140, background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                    Most expensive card
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {mostExpensive !== null ? formatUsd(mostExpensive.buy_usd) : '—'}
                    </span>
                    {mostExpensive?.is_outlier && !excludeOutliers && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#e63946' }}>outlier</span>
                    )}
                  </div>
                  {mostExpensive !== null && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mostExpensive.card_name}
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamp + export */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                  Fetched {fetchedAt} · League: {LEAGUE_STYLE[resultLeague].label}
                </span>
                <button
                  onClick={() => exportCsv(fullResults, resultLeague)}
                  style={{
                    padding: '5px 14px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 6,
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Export CSV
                </button>
              </div>

              {/* Warning banners — always visible even when filters are active */}
              {(hasUnavailable || hasOutliers) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '0.75rem' }}>
                  {hasUnavailable && (
                    <div style={{ background: '#2d0f0f', border: '1px solid #f85149', borderRadius: 8, padding: '7px 14px', fontSize: '0.82rem', color: '#f85149', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700 }}>!</span> Some cards are not available to buy at the target level
                    </div>
                  )}
                  {hasOutliers && (
                    <div style={{ background: '#2d0f0f', border: '1px solid #f85149', borderRadius: 8, padding: '7px 14px', fontSize: '0.82rem', color: '#f85149', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700 }}>!</span> Some cards have outlier prices and may skew the total
                    </div>
                  )}
                </div>
              )}

              {/* Exclusion filter chips */}
              {(hasUnavailable || hasOutliers) && (
                <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  {hasUnavailable && (
                    <button
                      className="chip-btn"
                      onClick={() => setExcludeUnavailable((v) => !v)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 6,
                        border: excludeUnavailable ? '1px solid #1f6feb' : '1px solid var(--border-default)',
                        background: excludeUnavailable ? '#1c3a5e' : 'var(--bg-tertiary)',
                        color: excludeUnavailable ? '#79b8f2' : 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: excludeUnavailable ? 600 : 400,
                      }}
                    >
                      Exclude unavailable cards
                    </button>
                  )}
                  {hasOutliers && (
                    <button
                      className="chip-btn"
                      onClick={() => setExcludeOutliers((v) => !v)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 6,
                        border: excludeOutliers ? '1px solid #1f6feb' : '1px solid var(--border-default)',
                        background: excludeOutliers ? '#1c3a5e' : 'var(--bg-tertiary)',
                        color: excludeOutliers ? '#79b8f2' : 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: excludeOutliers ? 600 : 400,
                      }}
                    >
                      Exclude price outliers
                    </button>
                  )}
                </div>
              )}

              {/* Results table — horizontal scroll on mobile */}
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden', minWidth: 560 }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: COL, padding: '8px 16px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-primary)' }}>
                  {['', 'Card', 'Edition', 'Tier', 'Rarity', 'Buy'].map((h) => (
                    <div
                      key={h}
                      style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        paddingLeft: h === 'Card' ? 8 : 0,
                      }}
                    >
                      {h}
                    </div>
                  ))}
                </div>

                {/* Edition groups */}
                {Array.from(byEdition.entries()).map(([edition, cards]) => {
                  const edBuy = sumUsd(cards.map((c) => c.buy_usd))
                  return (
                    <div key={edition}>
                      {cards.map((card) => (
                        <div
                          key={card.card_id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: COL,
                            alignItems: 'center',
                            padding: '5px 16px',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          <CardThumb cardName={card.card_name} cdnSlug={card.cdn_slug} rarity={card.rarity} maxLevel={rarityMaxLevel(card.rarity)} size={32} />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', paddingLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {card.card_name}
                          </span>
                          <span style={{ fontSize: '0.68rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: 'fit-content', maxWidth: '100%' }}>
                            {card.edition}
                          </span>
                          <span style={{ fontSize: '0.72rem', background: TIER_PILL_STYLE[card.tier]?.bg, color: TIER_PILL_STYLE[card.tier]?.color, borderRadius: 4, padding: '2px 7px', fontWeight: 700, width: 'fit-content' }}>
                            {card.tier}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {RARITY_NAMES[card.rarity] ?? ''}
                          </span>

                          {/* Buy price + BCX sub-label */}
                          {(() => {
                            const foil = card.foil_type
                            const isOutlier = card.is_outlier

                            // Cell container styling — foil colour coding; outlier red takes precedence
                            let cellStyle: React.CSSProperties = {}
                            let cellTitle: string | undefined
                            if (card.buy_usd === null) {
                              cellTitle = 'No listings found on the market for this card at this level'
                            } else if (!isOutlier && !card.insufficient_supply) {
                              if (foil === 'gold' || foil === 'arcane') {
                                cellStyle = { background: '#2a2200', borderLeft: '3px solid #ffd700', paddingLeft: 6 }
                                cellTitle = 'Cheapest option is a gold foil card — stats and BCX requirements differ from regular foil'
                              } else if (foil === 'black') {
                                cellStyle = { background: '#0a1a0a', borderLeft: '3px solid #2ecc71', paddingLeft: 6 }
                                cellTitle = 'Cheapest option is a black foil card — already at max level, no combining needed'
                              }
                            }

                            // Price text colour
                            const priceColor =
                              card.insufficient_supply || isOutlier ? '#f85149'
                              : foil === 'gold' || foil === 'arcane' ? '#ffd700'
                              : foil === 'black' ? '#2ecc71'
                              : card.buy_usd !== null ? 'var(--text-primary)' : 'var(--text-faint)'

                            // Sub-label
                            let subLabel: React.ReactNode = null
                            if (card.insufficient_supply) {
                              subLabel = (
                                <div
                                  title="Not enough cards on the market to reach this level. Showing maximum achievable BCX."
                                  style={{ fontSize: '0.62rem', color: '#f85149', marginTop: 1, whiteSpace: 'nowrap', cursor: 'help' }}
                                >
                                  {card.buy_bcx} / {card.buy_target_bcx} BCX available
                                </div>
                              )
                            } else if (foil === 'arcane') {
                              subLabel = (
                                <div style={{ fontSize: '0.62rem', color: isOutlier ? 'rgba(255,215,0,0.5)' : '#ffd700', marginTop: 1, whiteSpace: 'nowrap' }}>
                                  ✦ gold foil arcane
                                </div>
                              )
                            } else if (foil === 'black') {
                              subLabel = (
                                <div style={{ fontSize: '0.62rem', color: isOutlier ? 'rgba(46,204,113,0.5)' : '#2ecc71', marginTop: 1, whiteSpace: 'nowrap' }}>
                                  ◆ black foil
                                </div>
                              )
                            } else if (foil === 'gold') {
                              const goldLabel = card.buy_target_bcx !== null
                                ? `${card.buy_target_bcx} BCX · ✦ gold foil`
                                : '✦ gold foil'
                              subLabel = (
                                <div style={{ fontSize: '0.62rem', color: isOutlier ? 'rgba(255,215,0,0.5)' : '#ffd700', marginTop: 1, whiteSpace: 'nowrap' }}>
                                  {goldLabel}
                                </div>
                              )
                            } else if (card.buy_target_bcx !== null && card.buy_method !== null) {
                              subLabel = (
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: 1, whiteSpace: 'nowrap' }}>
                                  {card.buy_target_bcx} BCX · {card.buy_method}
                                </div>
                              )
                            }

                            return (
                              <div style={cellStyle} title={cellTitle}>
                                <div style={{ fontSize: '0.85rem', color: priceColor, fontVariantNumeric: 'tabular-nums' }}>
                                  {formatUsd(card.buy_usd)}
                                </div>
                                {subLabel}
                              </div>
                            )
                          })()}
                        </div>
                      ))}

                      {/* Per-edition subtotal */}
                      <div style={{ display: 'grid', gridTemplateColumns: COL, alignItems: 'center', padding: '6px 16px', borderBottom: '2px solid var(--border-default)', background: 'var(--bg-tertiary)' }}>
                        <span />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 8, fontWeight: 600 }}>
                          {edition} — {cards.length} card{cards.length !== 1 ? 's' : ''}
                        </span>
                        <span /><span /><span />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatUsdSum(edBuy)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>{/* end overflow-x scroll wrapper */}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
