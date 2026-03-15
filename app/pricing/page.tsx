'use client'

import { useEffect, useState, useTransition } from 'react'
import Nav from '@/components/Nav'
import CardThumb from '@/components/CardThumb'
import { createClient } from '@/lib/supabase/client'
import { rarityMaxLevel } from '@/lib/editions'
import { fetchPrices, type CardInput, type PricingResult } from '@/app/actions/pricing'

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
  rent_day_usd: number | null
}

const TIERS = ['S', 'A', 'B', 'C', 'D'] as const

const RARITY_NAMES: Record<number, string> = {
  1: 'Common',
  2: 'Rare',
  3: 'Epic',
  4: 'Legendary',
}

// Tier chip colours (active = label bg/text; inactive = default chip)
const TIER_LABEL_STYLE: Record<string, { bg: string; color: string }> = {
  S: { bg: '#ffd700', color: '#0d1117' },
  A: { bg: '#2ecc71', color: '#0d1117' },
  B: { bg: '#3498db', color: '#0d1117' },
  C: { bg: '#95a5a6', color: '#0d1117' },
  D: { bg: '#555e6a', color: '#adb5bd' },
}

// Tier pill colours for table badges
const TIER_PILL_STYLE: Record<string, { bg: string; color: string }> = {
  S: { bg: '#3d3000', color: '#ffd700' },
  A: { bg: '#0d3320', color: '#2ecc71' },
  B: { bg: '#0d2440', color: '#3498db' },
  C: { bg: '#1c2128', color: '#95a5a6' },
  D: { bg: '#161b22', color: '#555e6a' },
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

function exportCsv(rows: FullResult[], level: number) {
  const header = 'Card Name,Edition,Tier,Rarity,Level,Buy USD,Rent/Day USD'
  const lines = rows.map((r) =>
    [
      `"${r.card_name.replace(/"/g, '""')}"`,
      `"${r.edition}"`,
      r.tier,
      RARITY_NAMES[r.rarity] ?? '',
      Math.min(level, rarityMaxLevel(r.rarity)),
      r.buy_usd !== null ? r.buy_usd.toFixed(4) : '',
      r.rent_day_usd !== null ? r.rent_day_usd.toFixed(4) : '',
    ].join(','),
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `spltiers-pricing-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Grid column template for the results table ──────────────────────────────
const COL = '40px minmax(130px,1fr) 140px 50px 80px 90px 90px'

export default function PricingPage() {
  const [entries, setEntries] = useState<TierEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [selectedEditions, setSelectedEditions] = useState<Set<string>>(new Set())
  const [selectedTiers, setSelectedTiers] = useState<Set<string>>(new Set(['S', 'A']))
  const [level, setLevel] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<PricingResult | null>(null)
  const [resultCards, setResultCards] = useState<CardInput[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  // Load all non-soulbound tiered entries from Supabase
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('tier_entries')
      .select('card_id, card_name, edition, cdn_slug, rarity, tier, is_soulbound')
      .eq('is_soulbound', false)
      .not('tier', 'is', null)
      .then(({ data }) => {
        setEntries((data as TierEntry[]) ?? [])
        setLoadingEntries(false)
      })
  }, [])

  const availableEditions = Array.from(new Set(entries.map((e) => e.edition))).sort()

  const filteredEntries = entries.filter(
    (e) =>
      selectedEditions.has(e.edition) &&
      selectedTiers.has(e.tier),
  )

  // Deduplicate by card_id (same card can appear in multiple card_sets)
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

  const handleCalculate = () => {
    if (!canCalculate) return
    setResultCards(uniqueCards)
    startTransition(async () => {
      const res = await fetchPrices(uniqueCards, level)
      setResult(res)
      setFetchedAt(new Date().toLocaleString())
    })
  }

  // Merge cards with prices for display
  const fullResults: FullResult[] = resultCards.map((card) => {
    const price = result?.prices.find((p) => p.card_id === card.card_id)
    return {
      ...card,
      buy_usd: price?.buy_usd ?? null,
      rent_day_usd: price?.rent_day_usd ?? null,
    }
  })

  // Group by edition preserving insertion order
  const byEdition = new Map<string, FullResult[]>()
  for (const r of fullResults) {
    const arr = byEdition.get(r.edition) ?? []
    arr.push(r)
    byEdition.set(r.edition, arr)
  }

  const totalBuy = sumUsd(fullResults.map((r) => r.buy_usd))
  const totalRentDay = sumUsd(fullResults.map((r) => r.rent_day_usd))
  const totalRentMonth = totalRentDay * 30

  const showResults = result !== null && !isPending

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        .chip-btn { transition: background 0.15s, border-color 0.15s, color 0.15s; }
        .chip-btn:hover { opacity: 0.85; }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Nav />
        <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
          <h1
            style={{
              color: 'var(--text-primary)',
              fontSize: '1.6rem',
              fontWeight: 700,
              marginBottom: '0.25rem',
            }}
          >
            Pricing Calculator
          </h1>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              marginBottom: '1.5rem',
            }}
          >
            Select editions and tiers to get live buy and rent prices from the Splinterlands market.
          </p>

          {/* ── Config panel ─────────────────────────────────────────────── */}
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
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 500,
                }}
              >
                Editions
              </div>
              {loadingEntries ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[100, 120, 90, 110, 80].map((w, i) => (
                    <div
                      key={i}
                      style={{
                        height: 28,
                        width: w,
                        background: '#21262d',
                        borderRadius: 6,
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {availableEditions.map((edition) => {
                    const active = selectedEditions.has(edition)
                    return (
                      <button
                        key={edition}
                        className="chip-btn"
                        onClick={() => toggleEdition(edition)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 6,
                          border: active
                            ? '1px solid #1f6feb'
                            : '1px solid var(--border-default)',
                          background: active ? '#1c3a5e' : 'var(--bg-tertiary)',
                          color: active ? '#79b8f2' : 'var(--text-secondary)',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {edition}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Tiers */}
            <div style={{ marginBottom: '1rem' }}>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 500,
                }}
              >
                Tiers
              </div>
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
                        fontSize: '0.85rem',
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

            {/* Level + CTA */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 500,
                  }}
                >
                  Card level
                </div>
                <select
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    padding: '5px 10px',
                    cursor: 'pointer',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => (
                    <option key={l} value={l}>
                      Level {l}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCalculate}
                disabled={!canCalculate || isPending}
                style={{
                  padding: '7px 20px',
                  background:
                    canCalculate && !isPending ? 'var(--accent-red)' : '#3d1c1c',
                  border: 'none',
                  borderRadius: 8,
                  color: canCalculate && !isPending ? '#fff' : '#8b949e',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: canCalculate && !isPending ? 'pointer' : 'not-allowed',
                  transition: 'background 0.15s',
                }}
              >
                {isPending
                  ? 'Fetching prices…'
                  : uniqueCards.length > 0
                  ? `Calculate prices (${uniqueCards.length} cards)`
                  : 'Calculate prices'}
              </button>

              {!loadingEntries && selectedEditions.size === 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-faint)', alignSelf: 'center' }}>
                  Select at least one edition to continue.
                </span>
              )}
            </div>
          </div>

          {/* ── Loading skeleton ─────────────────────────────────────────── */}
          {isPending && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem' }}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 80,
                      background: 'var(--bg-secondary)',
                      borderRadius: 10,
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 4,
                        background: '#21262d',
                        flexShrink: 0,
                        animation: 'pulse 1.5s ease-in-out infinite',
                      }}
                    />
                    <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center' }}>
                      {[2, 1.2, 0.8, 0.7, 0.7].map((w, j) => (
                        <div
                          key={j}
                          style={{
                            flex: w,
                            height: 12,
                            borderRadius: 4,
                            background: '#21262d',
                            animation: `pulse ${1.3 + j * 0.1}s ease-in-out infinite`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Results ──────────────────────────────────────────────────── */}
          {showResults && (
            <div>
              {/* Summary metric cards */}
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  marginBottom: '1.5rem',
                  flexWrap: 'wrap',
                }}
              >
                {[
                  { label: 'Total buy cost', value: formatUsdSum(totalBuy) },
                  { label: 'Rent / day', value: formatUsdSum(totalRentDay) },
                  { label: 'Rent / month', value: formatUsdSum(totalRentMonth) },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 10,
                      padding: '1rem 1.25rem',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 500,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Timestamp + export button */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                  Fetched {fetchedAt}
                  {result.dec_usd_rate > 0
                    ? ` · DEC rate: $${result.dec_usd_rate.toFixed(6)}/DEC`
                    : ' · DEC rate unavailable'}
                </span>
                <button
                  onClick={() => exportCsv(fullResults, level)}
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

              {/* Results table */}
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: COL,
                    padding: '8px 16px',
                    borderBottom: '1px solid var(--border-default)',
                    background: 'var(--bg-primary)',
                    gap: 0,
                  }}
                >
                  {['', 'Card', 'Edition', 'Tier', 'Rarity', 'Buy', 'Rent/day'].map((h) => (
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
                  const edRentDay = sumUsd(cards.map((c) => c.rent_day_usd))
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
                          <CardThumb
                            cardName={card.card_name}
                            cdnSlug={card.cdn_slug}
                            rarity={card.rarity}
                            maxLevel={rarityMaxLevel(card.rarity)}
                            size={32}
                          />
                          <span
                            style={{
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)',
                              paddingLeft: 8,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {card.card_name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 4,
                              padding: '2px 6px',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              width: 'fit-content',
                              maxWidth: '100%',
                            }}
                          >
                            {card.edition}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              background: TIER_PILL_STYLE[card.tier]?.bg,
                              color: TIER_PILL_STYLE[card.tier]?.color,
                              borderRadius: 4,
                              padding: '2px 7px',
                              fontWeight: 700,
                              width: 'fit-content',
                            }}
                          >
                            {card.tier}
                          </span>
                          <span
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {RARITY_NAMES[card.rarity] ?? ''}
                          </span>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              color:
                                card.buy_usd !== null
                                  ? 'var(--text-primary)'
                                  : 'var(--text-faint)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatUsd(card.buy_usd)}
                          </span>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              color:
                                card.rent_day_usd !== null
                                  ? 'var(--text-primary)'
                                  : 'var(--text-faint)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatUsd(card.rent_day_usd)}
                          </span>
                        </div>
                      ))}

                      {/* Per-edition subtotal row */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: COL,
                          alignItems: 'center',
                          padding: '6px 16px',
                          borderBottom: '2px solid var(--border-default)',
                          background: 'var(--bg-tertiary)',
                        }}
                      >
                        <span />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            paddingLeft: 8,
                            fontWeight: 600,
                          }}
                        >
                          {edition} — {cards.length} card{cards.length !== 1 ? 's' : ''}
                        </span>
                        <span />
                        <span />
                        <span />
                        <span
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatUsdSum(edBuy)}
                        </span>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatUsdSum(edRentDay)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
