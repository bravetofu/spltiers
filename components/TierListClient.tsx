'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import CardThumb from '@/components/CardThumb'
import CardHoverPopover from '@/components/CardHoverPopover'
import { rarityMaxLevel, type EditionFormat } from '@/lib/editions'

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
        {currentSet?.name ?? 'Switch edition'}
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function TierListClient({ currentSet, tierGroups, allSets }: Props) {
  const [beginnerMode, setBeginnerMode] = useState(false)
  const [activeRarities, setActiveRarities] = useState<Set<number>>(new Set(ALL_RARITIES))

  // Read localStorage on mount
  useEffect(() => {
    try {
      setBeginnerMode(localStorage.getItem('splintiers_beginner_mode') === 'true')
    } catch {
      // localStorage unavailable (SSR guard — shouldn't happen in useEffect but be safe)
    }
  }, [])

  // Reset rarity filters when navigating to a different edition
  useEffect(() => {
    setActiveRarities(new Set(ALL_RARITIES))
  }, [currentSet.slug])

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

        {/* Rarity filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
            Filter:
          </span>
          {RARITIES.map(({ value, label, color }) => {
            const active = activeRarities.has(value)
            return (
              <button
                key={value}
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
                {label}
              </button>
            )
          })}
        </div>

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
                  {cards.map((card) => (
                    <CardHoverPopover
                      key={card.card_id}
                      cardName={card.card_name}
                      cdnSlug={card.cdn_slug}
                      rarity={card.rarity}
                      tier={card.tier}
                      role={card.role}
                      notes={card.notes}
                      isSoulbound={card.is_soulbound}
                      beginnerMode={beginnerMode}
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
                    </CardHoverPopover>
                  ))}
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
    </div>
  )
}
