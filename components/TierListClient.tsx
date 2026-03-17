'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import CardThumb from '@/components/CardThumb'
import CardPopover from '@/components/CardPopover'
import { rarityMaxLevel, type EditionFormat } from '@/lib/editions'
import { getMaxLevelBcx, getMaxLevelBcxGold } from '@/lib/splinterlands/bcx'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TierEntry = {
  card_id: number
  card_name: string
  cdn_slug: string
  rarity: number
  tier: string
  role: string | null
  notes: string | null
  is_soulbound: boolean
}

export type SetSummary = {
  slug: string
  name: string
  format: EditionFormat
}

type Props = {
  currentSet: { name: string; slug: string }
  tierGroups: Record<string, TierEntry[]>
  allSets: SetSummary[]
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIERS = ['S', 'A', 'B', 'C', 'D'] as const

const TIER_CONFIG: Record<string, { labelBg: string; labelText: string; subtitle: string }> = {
  S: { labelBg: '#ffd700', labelText: '#0d1117', subtitle: 'Dominant — essential picks' },
  A: { labelBg: '#2ecc71', labelText: '#0d1117', subtitle: 'Very strong, high-impact' },
  B: { labelBg: '#3498db', labelText: '#0d1117', subtitle: 'Solid, reliable choices' },
  C: { labelBg: '#95a5a6', labelText: '#0d1117', subtitle: 'Situational — use with care' },
  D: { labelBg: '#555e6a', labelText: '#adb5bd', subtitle: 'Weak — rarely recommended' },
}

// ─── Edition dropdown ─────────────────────────────────────────────────────────

function EditionDropdown({
  currentSlug,
  allSets,
}: {
  currentSlug: string
  allSets: SetSummary[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const modernSets = allSets.filter((s) => s.format === 'modern')
  const wildSets = allSets.filter((s) => s.format === 'wild')
  const otherSets = allSets.filter((s) => s.format === 'other')

  const currentSet = allSets.find((s) => s.slug === currentSlug)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="edition-btn"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: '#21262d',
          border: '1px solid #30363d',
          borderRadius: 6,
          color: '#c9d1d9',
          padding: '0.35rem 0.75rem',
          fontSize: '0.82rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span className="edition-btn-text">{currentSet?.name ?? 'Switch edition'}</span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
        >
          <path d="M1 1l4 4 4-4" stroke="#8b949e" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 200,
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {modernSets.length > 0 && (
            <DropdownGroup
              label="modern"
              sets={modernSets}
              currentSlug={currentSlug}
              onSelect={() => setOpen(false)}
            />
          )}
          {wildSets.length > 0 && (
            <DropdownGroup
              label="wild"
              sets={wildSets}
              currentSlug={currentSlug}
              onSelect={() => setOpen(false)}
            />
          )}
          {otherSets.length > 0 && (
            <DropdownGroup
              label="other"
              sets={otherSets}
              currentSlug={currentSlug}
              onSelect={() => setOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function DropdownGroup({
  label,
  sets,
  currentSlug,
  onSelect,
}: {
  label: string
  sets: SetSummary[]
  currentSlug: string
  onSelect: () => void
}) {
  return (
    <div>
      <p
        style={{
          color: '#484f58',
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '0.5rem 0.75rem 0.25rem',
          margin: 0,
        }}
      >
        {label}
      </p>
      {sets.map((set) => {
        const isCurrent = set.slug === currentSlug
        return (
          <Link
            key={set.slug}
            href={`/tier-list/${set.slug}`}
            onClick={onSelect}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0.4rem 0.75rem',
              color: isCurrent ? '#f0f6fc' : '#c9d1d9',
              background: isCurrent ? '#21262d' : 'transparent',
              textDecoration: 'none',
              fontSize: '0.82rem',
              fontWeight: isCurrent ? 600 : 400,
            }}
          >
            {isCurrent && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#e63946',
                  flexShrink: 0,
                }}
              />
            )}
            {!isCurrent && <span style={{ width: 6, flexShrink: 0 }} />}
            {set.name}
          </Link>
        )
      })}
    </div>
  )
}

// ─── Rarity config ────────────────────────────────────────────────────────────

const RARITIES: { value: number; label: string; color: string }[] = [
  { value: 1, label: 'Common',    color: '#95a5a6' },
  { value: 2, label: 'Rare',      color: '#3498db' },
  { value: 3, label: 'Epic',      color: '#a855f7' },
  { value: 4, label: 'Legendary', color: '#ffd700' },
]

const ALL_RARITIES = new Set([1, 2, 3, 4])

// ─── Collection checker types ─────────────────────────────────────────────────

export type CardCollectionState = {
  pct: number           // 0–100
  foilType: 'black' | 'gold' | 'regular' | 'none'
  foilNumber: number | null  // exact winning foil value (0–4) or null if not owned
  dotColor: string      // empty string = no dot
  textColor: string
  grayscale: boolean
  opacity: number       // 1 = full, 0.55 = partial, 0.25 = not owned
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TierListClient({ currentSet, tierGroups, allSets }: Props) {
  const [beginnerMode, setBeginnerMode] = useState(false)
  const [activeRarities, setActiveRarities] = useState<Set<number>>(new Set(ALL_RARITIES))
  const [selectedCard, setSelectedCard] = useState<TierEntry | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Collection checker state
  const [username, setUsername] = useState('')
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [collectionError, setCollectionError] = useState<string | null>(null)
  const [collectionMap, setCollectionMap] = useState<Map<number, CardCollectionState> | null>(null)

  // Read localStorage on mount; detect touch/pointer device
  useEffect(() => {
    try {
      setBeginnerMode(localStorage.getItem('splintiers_beginner_mode') === 'true')
    } catch {
      // localStorage unavailable (SSR guard — shouldn't happen in useEffect but be safe)
    }
    const mq = window.matchMedia('(hover: none)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Reset rarity filters, collection state, and close popup when navigating to a different edition
  useEffect(() => {
    setActiveRarities(new Set(ALL_RARITIES))
    setSelectedCard(null)
    setAnchorRect(null)
    setCollectionMap(null)
    setUsername('')
    setCollectionError(null)
  }, [currentSet.slug])

  // Close popup on outside click (desktop only)
  useEffect(() => {
    if (!selectedCard || isMobile) return
    function handleOutside() {
      setSelectedCard(null)
      setAnchorRect(null)
    }
    document.addEventListener('click', handleOutside)
    return () => document.removeEventListener('click', handleOutside)
  }, [selectedCard, isMobile])

  function toggleBeginnerMode() {
    const next = !beginnerMode
    setBeginnerMode(next)
    try {
      localStorage.setItem('splintiers_beginner_mode', String(next))
    } catch {
      // ignore
    }
  }

  function toggleRarity(value: number) {
    setActiveRarities((prev) => {
      const next = new Set(prev)
      next.has(value) ? next.delete(value) : next.add(value)
      return next
    })
  }

  async function handleCheckCollection() {
    const trimmed = username.trim()
    if (!trimmed) return
    setCollectionLoading(true)
    setCollectionError(null)
    setCollectionMap(null)

    try {
      const res = await fetch(`https://api.splinterlands.io/cards/collection/${trimmed}`)
      if (!res.ok) {
        setCollectionError('Username not found or collection is empty')
        return
      }
      const raw = await res.json()
      // API may return array directly or { cards: [...] }
      const data: { card_detail_id: number; bcx: number; foil: number }[] =
        Array.isArray(raw) ? raw : (raw?.cards ?? [])

      if (!Array.isArray(data) || data.length === 0) {
        setCollectionError('Username not found or collection is empty')
        return
      }

      // Pass 1 — group by card_detail_id, track best bcx per foil type
      type RawEntry = { hasBF: boolean; hasBFArcane: boolean; hasArcaneGF: boolean; maxGoldBcx: number | null; maxRegularBcx: number | null }
      const grouped = new Map<number, RawEntry>()
      for (const card of data) {
        const id = Number(card.card_detail_id)
        const foil = Number(card.foil ?? 0)
        const bcx = Number(card.bcx ?? 0)
        if (!id) continue
        let entry = grouped.get(id)
        if (!entry) {
          entry = { hasBF: false, hasBFArcane: false, hasArcaneGF: false, maxGoldBcx: null, maxRegularBcx: null }
          grouped.set(id, entry)
        }
        if (foil === 3 || foil === 4) {
          entry.hasBF = true
          if (foil === 4) entry.hasBFArcane = true
        } else if (foil === 2) {
          entry.hasArcaneGF = true  // arcane gold foil — always max level
        } else if (foil === 1) {
          entry.maxGoldBcx = Math.max(entry.maxGoldBcx ?? 0, bcx)
        } else if (foil === 0) {
          entry.maxRegularBcx = Math.max(entry.maxRegularBcx ?? 0, bcx)
        }
      }

      // Pass 2 — compute collection state for every card in the current tier list
      const isAlphaBeta = currentSet.name === 'Alpha/Beta'
      const result = new Map<number, CardCollectionState>()
      const allTierCards = TIERS.flatMap((t) => tierGroups[t] ?? [])

      for (const card of allTierCards) {
        const entry = grouped.get(card.card_id)
        const maxBcxReg = getMaxLevelBcx(card.rarity, isAlphaBeta)
        const maxBcxGold = getMaxLevelBcxGold(card.rarity, isAlphaBeta)

        let state: CardCollectionState

        if (!entry) {
          // Not owned at all
          state = { pct: 0, foilType: 'none', foilNumber: null, dotColor: '', textColor: '#484f58', grayscale: true, opacity: 0.25 }
        } else if (entry.hasBF) {
          state = { pct: 100, foilType: 'black', foilNumber: entry.hasBFArcane ? 4 : 3, dotColor: '#000000', textColor: '#e2e8f0', grayscale: false, opacity: 1 }
        } else if (entry.hasArcaneGF) {
          // Arcane gold foil — always max level, shown as gold at 100%
          state = { pct: 100, foilType: 'gold', foilNumber: 2, dotColor: '#ffd700', textColor: '#ffd700', grayscale: false, opacity: 1 }
        } else {
          const gfPct = entry.maxGoldBcx !== null
            ? Math.min(100, Math.round((entry.maxGoldBcx / maxBcxGold) * 100))
            : 0
          const rfPct = entry.maxRegularBcx !== null
            ? Math.min(100, Math.round((entry.maxRegularBcx / maxBcxReg) * 100))
            : 0

          if (gfPct === 0 && rfPct === 0) {
            state = { pct: 0, foilType: 'none', foilNumber: null, dotColor: '', textColor: '#484f58', grayscale: true, opacity: 0.25 }
          } else if (gfPct >= rfPct) {
            // Gold foil winner
            state = {
              pct: gfPct,
              foilType: 'gold',
              foilNumber: 1,
              dotColor: '#ffd700',
              textColor: gfPct === 100 ? '#ffd700' : '#8b949e',
              grayscale: gfPct < 100,
              opacity: gfPct === 100 ? 1 : 0.55,
            }
          } else {
            // Regular foil winner
            state = {
              pct: rfPct,
              foilType: 'regular',
              foilNumber: 0,
              dotColor: '#adb5bd',
              textColor: rfPct === 100 ? '#f0f6fc' : '#8b949e',
              grayscale: rfPct < 100,
              opacity: rfPct === 100 ? 1 : 0.55,
            }
          }
        }

        result.set(card.card_id, state)
      }

      setCollectionMap(result)
    } catch {
      setCollectionError('Username not found or collection is empty')
    } finally {
      setCollectionLoading(false)
    }
  }

  function handleClearCollection() {
    setCollectionMap(null)
    setUsername('')
    setCollectionError(null)
  }

  function handleCardClick(e: React.MouseEvent<HTMLDivElement>, card: TierEntry) {
    e.stopPropagation()
    if (isMobile) {
      setSelectedCard(card)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      if (selectedCard?.card_id === card.card_id) {
        setSelectedCard(null)
        setAnchorRect(null)
      } else {
        setSelectedCard(card)
        setAnchorRect(rect)
      }
    }
  }

  function closePopover() {
    setSelectedCard(null)
    setAnchorRect(null)
  }

  const totalRanked = TIERS.reduce((acc, t) => acc + (tierGroups[t]?.length ?? 0), 0)

  // Filtered view — used for tier rows only; totalRanked always reflects unfiltered count
  const filteredGroups = Object.fromEntries(
    TIERS.map((t) => [t, (tierGroups[t] ?? []).filter((c) => activeRarities.has(c.rarity))]),
  )
  const anyVisible = TIERS.some((t) => filteredGroups[t].length > 0)
  const isFiltered = activeRarities.size < 4

  return (
    <div>
      <style>{`
        /* Mobile: tier card rows scroll horizontally instead of wrapping */
        @media (max-width: 640px) {
          .tier-card-grid {
            flex-wrap: nowrap !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            min-width: 0;
            padding-bottom: 4px;
          }
          /* Shrink card thumbnails from 72px → 60px on mobile */
          .tier-card-thumb {
            width: 60px !important;
            height: 60px !important;
          }
        }
        /* Mobile: filter bar full-width equal buttons, edition button truncates */
        @media (max-width: 767px) {
          .filter-label { display: none !important; }
          .filter-bar { gap: 3px !important; flex-wrap: nowrap !important; }
          .filter-btn {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            padding-left: 6px !important;
            padding-right: 6px !important;
            justify-content: center !important;
          }
          .filter-btn-label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
          }
          .edition-btn { max-width: 130px; }
          .edition-btn-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
          }
          .beginner-btn { display: none !important; }
        }
      `}</style>
      {/* Sub-nav */}
      <div
        style={{
          background: '#0d1117',
          borderBottom: '1px solid #30363d',
          padding: '0 1.5rem',
          height: 46,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 52,
          zIndex: 40,
        }}
      >
        {/* Left: breadcrumb */}
        <Link
          href="/"
          style={{ color: '#8b949e', textDecoration: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← all editions
        </Link>

        {/* Right: beginner toggle + dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="beginner-btn"
            onClick={toggleBeginnerMode}
            title="Beginner mode adds tier explanations and role descriptions"
            style={{
              background: beginnerMode ? '#0d2440' : 'transparent',
              color: beginnerMode ? '#3498db' : '#8b949e',
              border: `1px solid ${beginnerMode ? '#3498db' : '#30363d'}`,
              borderRadius: 6,
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: beginnerMode ? 600 : 400,
            }}
          >
            Beginner mode
          </button>
          <EditionDropdown currentSlug={currentSet.slug} allSets={allSets} />
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.5rem 3rem' }}>
        {/* Edition title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1
            style={{
              color: '#f0f6fc',
              fontSize: 24,
              fontWeight: 600,
              margin: '0 0 0.25rem',
            }}
          >
            {currentSet.name}
          </h1>
          <p style={{ color: '#8b949e', fontSize: '0.85rem', margin: 0 }}>
            {totalRanked} ranked cards
          </p>
        </div>

        {/* Rarity filter bar + collection checker row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: collectionError ? '0.5rem' : '1rem' }}>
          <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="filter-label" style={{ fontSize: 11, fontWeight: 500, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
              Filter:
            </span>
            {RARITIES.map(({ value, label, color }) => {
              const active = activeRarities.has(value)
              return (
                <button
                  key={value}
                  className="filter-btn"
                  onClick={() => toggleRarity(value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: active ? `1px solid ${color}` : '1px solid #30363d',
                    background: active ? '#21262d' : '#161b22',
                    color: active ? '#c9d1d9' : '#484f58',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: active ? 500 : 400,
                    transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? color : '#484f58', flexShrink: 0, transition: 'background 0.15s' }} />
                  <span className="filter-btn-label">{label}</span>
                </button>
              )
            })}
          </div>

          {/* Collection checker */}
          <div className="collection-checker" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <input
              type="text"
              placeholder="Hive username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCheckCollection() }}
              style={{
                width: 140,
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 12,
                color: '#f0f6fc',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCheckCollection}
              disabled={collectionLoading || !username.trim()}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid #30363d',
                background: '#161b22',
                color: collectionLoading ? '#8b949e' : '#c9d1d9',
                fontSize: '0.8rem',
                cursor: collectionLoading || !username.trim() ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: !username.trim() ? 0.5 : 1,
              }}
            >
              {collectionLoading ? 'Checking...' : 'Check collection'}
            </button>
            {collectionMap && (
              <button
                onClick={handleClearCollection}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #30363d',
                  background: '#161b22',
                  color: '#c9d1d9',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Collection error message */}
        {collectionError && (
          <p style={{ color: '#e74c3c', fontSize: 11, margin: '0 0 0.75rem', lineHeight: 1.4 }}>
            {collectionError}
          </p>
        )}

        {/* Tier rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TIERS.map((tier) => {
            const cards = filteredGroups[tier]
            if (cards.length === 0) return null
            const cfg = TIER_CONFIG[tier]

            return (
              <div
                key={tier}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 0,
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {/* Tier label — 52px wide */}
                <div
                  style={{
                    width: 52,
                    minHeight: 84,
                    flexShrink: 0,
                    background: cfg.labelBg,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem 0',
                    gap: 2,
                  }}
                >
                  <span
                    style={{
                      color: cfg.labelText,
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      lineHeight: 1,
                    }}
                  >
                    {tier}
                  </span>
                  {beginnerMode && (
                    <span
                      style={{
                        color: cfg.labelText,
                        fontSize: '0.5rem',
                        fontWeight: 600,
                        textAlign: 'center',
                        opacity: 0.75,
                        lineHeight: 1.2,
                        padding: '0 4px',
                        maxWidth: 48,
                        wordBreak: 'break-word',
                      }}
                    >
                      {cfg.subtitle}
                    </span>
                  )}
                </div>

                {/* Card grid */}
                <div
                  className="tier-card-grid"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    padding: '0.6rem 0.75rem',
                    alignContent: 'flex-start',
                  }}
                >
                  {cards.map((card) => {
                    const colState = collectionMap?.get(card.card_id)
                    return (
                      <div
                        key={card.card_id}
                        onClick={(e) => handleCardClick(e, card)}
                        style={{
                          cursor: 'pointer',
                          borderRadius: 10,
                          boxShadow: selectedCard?.card_id === card.card_id
                            ? '0 0 0 2px #ffd700'
                            : undefined,
                          position: 'relative',
                          flexShrink: 0,
                        }}
                      >
                        {/* Card thumbnail — wrapped to isolate filter/opacity from overlays */}
                        <div
                          style={{
                            filter: colState?.grayscale ? 'grayscale(1)' : undefined,
                            opacity: colState && colState.opacity < 1 ? colState.opacity : undefined,
                          }}
                        >
                          <CardThumb
                            cardName={card.card_name}
                            cdnSlug={card.cdn_slug}
                            rarity={card.rarity}
                            maxLevel={rarityMaxLevel(card.rarity)}
                            size={72}
                            isSoulbound={card.is_soulbound}
                            className="tier-card-thumb"
                          />
                        </div>

                        {/* Collection overlays — shown only when collection is loaded */}
                        {colState && (
                          <>
                            {/* Percentage pill */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 4,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'rgba(0,0,0,0.72)',
                                borderRadius: 4,
                                padding: '1px 5px',
                                fontSize: 10,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                color: colState.textColor,
                                pointerEvents: 'none',
                                zIndex: 2,
                              }}
                            >
                              {colState.pct}%
                            </div>

                            {/* Foil dot — shown only when pct > 0 */}
                            {colState.dotColor && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  border: colState.foilType === 'black' ? '1px solid #e2e8f0' : '1px solid rgba(0,0,0,0.4)',
                                  background: colState.dotColor,
                                  pointerEvents: 'none',
                                  zIndex: 2,
                                }}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {totalRanked === 0 && (
          <p style={{ color: '#8b949e', textAlign: 'center', padding: '3rem 0', fontSize: '0.95rem' }}>
            No cards have been ranked yet for this edition.
          </p>
        )}
        {totalRanked > 0 && isFiltered && !anyVisible && (
          <p style={{ color: '#8b949e', textAlign: 'center', padding: '3rem 0', fontSize: '0.95rem' }}>
            No cards match the selected filters.
          </p>
        )}
      </div>

      {selectedCard && (
        <CardPopover
          card={selectedCard}
          anchorRect={anchorRect}
          editionName={currentSet.name}
          isMobile={isMobile}
          onClose={closePopover}
          collectionState={collectionMap?.get(selectedCard.card_id)}
        />
      )}
    </div>
  )
}
