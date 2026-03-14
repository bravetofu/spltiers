'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import CardThumb from '@/components/CardThumb'
import type { CardData } from '@/app/actions/cards'

// ─── Types ────────────────────────────────────────────────────────────────────

type TierKey = 'S' | 'A' | 'B' | 'C' | 'D'
const TIERS: TierKey[] = ['S', 'A', 'B', 'C', 'D']

type CardState = CardData & {
  tier: TierKey | null
  role: string
  notes: string
}

type CardSet = {
  id: string
  slug: string
  name: string
}

type ExistingEntry = {
  card_id: number
  tier: string
  role: string | null
  notes: string | null
}

type Props = {
  cardSet: CardSet
  allCards: CardData[]
  existingEntries: ExistingEntry[]
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<TierKey, { labelBg: string; labelText: string; pillBg: string; pillText: string }> = {
  S: { labelBg: '#ffd700', labelText: '#0d1117', pillBg: '#3d3000', pillText: '#ffd700' },
  A: { labelBg: '#2ecc71', labelText: '#0d1117', pillBg: '#0d3320', pillText: '#2ecc71' },
  B: { labelBg: '#3498db', labelText: '#0d1117', pillBg: '#0d2440', pillText: '#3498db' },
  C: { labelBg: '#95a5a6', labelText: '#0d1117', pillBg: '#1c2128', pillText: '#95a5a6' },
  D: { labelBg: '#555e6a', labelText: '#adb5bd', pillBg: '#161b22', pillText: '#555e6a' },
}

// ─── Draggable card ───────────────────────────────────────────────────────────

function DraggableCard({
  card,
  size,
  onClick,
  isSelected,
}: {
  card: CardState
  size: number
  onClick?: () => void
  isSelected?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `card-${card.card_id}`,
    data: { card },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      title={card.card_name}
      style={{
        opacity: isDragging ? 0.3 : 1,
        cursor: 'grab',
        outline: isSelected ? '2px solid #e63946' : undefined,
        borderRadius: 6,
        flexShrink: 0,
      }}
    >
      <CardThumb
        cardName={card.card_name}
        cdnSlug={card.cdn_slug}
        rarity={card.rarity}
        maxLevel={card.max_level}
        size={size}
        isSoulbound={card.is_soulbound}
      />
    </div>
  )
}

// ─── Droppable zone ───────────────────────────────────────────────────────────

function DroppableZone({
  id,
  children,
  style,
}: {
  id: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        outline: isOver ? '1px solid #3498db' : undefined,
        transition: 'outline 0.1s',
      }}
    >
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TierEditor({ cardSet, allCards, existingEntries }: Props) {
  // Build initial card state
  const initial = useMemo<CardState[]>(() => {
    const entryMap = new Map<number, ExistingEntry>()
    for (const e of existingEntries) entryMap.set(e.card_id, e)
    return allCards.map((c) => {
      const entry = entryMap.get(c.card_id)
      return {
        ...c,
        tier: (entry?.tier as TierKey) ?? null,
        role: entry?.role ?? '',
        notes: entry?.notes ?? '',
      }
    })
  }, [allCards, existingEntries])

  const [cards, setCards] = useState<CardState[]>(initial)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [activeCard, setActiveCard] = useState<CardState | null>(null)

  // Unranked pool filters
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Derived data
  const tieredCards = useMemo(() => {
    const map: Record<TierKey, CardState[]> = { S: [], A: [], B: [], C: [], D: [] }
    for (const c of cards) {
      if (c.tier) map[c.tier].push(c)
    }
    return map
  }, [cards])

  const unrankedCards = useMemo(() => {
    return cards
      .filter((c) => c.tier === null)
      .filter((c) => {
        if (rarityFilter !== null && c.rarity !== rarityFilter) return false
        if (search && !c.card_name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
  }, [cards, search, rarityFilter])

  const selectedCard = cards.find((c) => c.card_id === selectedCardId) ?? null

  // ── Drag handlers ────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const card = event.active.data.current?.card as CardState
    setActiveCard(card ?? null)
  }

  function handleDragOver(_event: DragOverEvent) {
    // Visual feedback is handled by DroppableZone isOver state
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    const { over, active } = event
    if (!over) return
    const card = active.data.current?.card as CardState
    if (!card) return

    const overId = String(over.id)
    let newTier: TierKey | null = null

    if (overId === 'unranked') {
      newTier = null
    } else if (TIERS.includes(overId as TierKey)) {
      newTier = overId as TierKey
    } else {
      return
    }

    if (card.tier === newTier) return

    setCards((prev) =>
      prev.map((c) => (c.card_id === card.card_id ? { ...c, tier: newTier } : c)),
    )
    setDirty(true)
  }

  // ── Annotation panel ─────────────────────────────────────────────────────────

  function updateAnnotation(cardId: number, field: 'role' | 'notes', value: string) {
    setCards((prev) =>
      prev.map((c) => (c.card_id === cardId ? { ...c, [field]: value } : c)),
    )
    setDirty(true)
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const entries = cards.map((c) => ({
        set_id: cardSet.id,
        card_id: c.card_id,
        card_name: c.card_name,
        edition: c.edition,
        cdn_slug: c.cdn_slug,
        rarity: c.rarity,
        tier: c.tier,
        role: c.role || null,
        notes: c.notes || null,
        is_soulbound: c.is_soulbound,
      }))
      const res = await fetch('/api/admin/save-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_id: cardSet.id, entries }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSaveError(body.error ?? 'Save failed.')
        return
      }
      setDirty(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      {/* Top bar */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-default)',
          padding: '0 1.25rem',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexShrink: 0,
        }}
      >
        <Link
          href="/admin"
          style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}
        >
          ← editions
        </Link>
        <span style={{ color: 'var(--border-default)' }}>|</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
          {cardSet.name}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {allCards.length} cards · {cards.filter((c) => c.tier !== null).length} ranked
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {dirty && (
            <span
              style={{
                background: '#3d2200',
                color: '#ffa726',
                border: '1px solid #ffa726',
                borderRadius: 6,
                padding: '2px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Unsaved changes
            </span>
          )}
          {saveSuccess && (
            <span style={{ color: '#2ecc71', fontSize: '0.8rem' }}>Saved ✓</span>
          )}
          {saveError && (
            <span style={{ color: 'var(--accent-red)', fontSize: '0.8rem' }}>{saveError}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{
              background: dirty ? 'var(--accent-red)' : 'var(--bg-tertiary)',
              color: dirty ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 8,
              padding: '0.4rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: dirty ? 'pointer' : 'default',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main layout */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* ── Left: Unranked pool (220px) ─────────────────────────────────── */}
          <div
            style={{
              width: 220,
              flexShrink: 0,
              background: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-default)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Search + filter */}
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cards…"
                style={{
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  padding: '0.35rem 0.55rem',
                  fontSize: '0.8rem',
                  outline: 'none',
                  marginBottom: '0.5rem',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[null, 1, 2, 3, 4].map((r) => (
                  <button
                    key={r ?? 'all'}
                    onClick={() => setRarityFilter(r)}
                    style={{
                      background: rarityFilter === r ? '#21262d' : 'transparent',
                      color: rarityFilter === r ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: `1px solid ${rarityFilter === r ? 'var(--border-default)' : 'transparent'}`,
                      borderRadius: 5,
                      padding: '2px 7px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                    }}
                  >
                    {r === null ? 'All' : r === 1 ? 'C' : r === 2 ? 'R' : r === 3 ? 'E' : 'L'}
                  </button>
                ))}
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', padding: '4px 0.75rem 0', margin: 0, flexShrink: 0 }}>
              Unranked ({unrankedCards.length})
            </p>
            <DroppableZone
              id="unranked"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                alignContent: 'flex-start',
                minHeight: 80,
              }}
            >
              {unrankedCards.map((card) => (
                <DraggableCard
                  key={card.card_id}
                  card={card}
                  size={62}
                />
              ))}
              {unrankedCards.length === 0 && (
                <p style={{ color: 'var(--text-faint)', fontSize: '0.78rem', margin: 'auto', textAlign: 'center', width: '100%', paddingTop: 16 }}>
                  {search || rarityFilter !== null ? 'No matches' : 'All cards ranked!'}
                </p>
              )}
            </DroppableZone>
          </div>

          {/* ── Centre: Tier lanes ──────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {TIERS.map((tier) => {
              const cfg = TIER_CONFIG[tier]
              const tierCards = tieredCards[tier]
              return (
                <div
                  key={tier}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 8,
                    padding: '6px 8px',
                    minHeight: 80,
                  }}
                >
                  {/* Tier label */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: cfg.labelBg,
                      color: cfg.labelText,
                      fontWeight: 800,
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      alignSelf: 'center',
                    }}
                  >
                    {tier}
                  </div>
                  {/* Drop zone */}
                  <DroppableZone
                    id={tier}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                      minHeight: 68,
                      alignContent: 'flex-start',
                      borderRadius: 6,
                      padding: 4,
                    }}
                  >
                    {tierCards.map((card) => (
                      <DraggableCard
                        key={card.card_id}
                        card={card}
                        size={62}
                        isSelected={selectedCardId === card.card_id}
                        onClick={() =>
                          setSelectedCardId((prev) =>
                            prev === card.card_id ? null : card.card_id,
                          )
                        }
                      />
                    ))}
                    {tierCards.length === 0 && (
                      <span
                        style={{
                          color: 'var(--text-faint)',
                          fontSize: '0.75rem',
                          alignSelf: 'center',
                          marginLeft: 4,
                        }}
                      >
                        Drop cards here
                      </span>
                    )}
                  </DroppableZone>
                </div>
              )
            })}
          </div>

          {/* ── Right: Annotation panel (200px, hidden until card selected) ── */}
          {selectedCard && (
            <div
              style={{
                width: 200,
                flexShrink: 0,
                background: 'var(--bg-secondary)',
                borderLeft: '1px solid var(--border-default)',
                padding: '1rem',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                  Annotate
                </span>
                <button
                  onClick={() => setSelectedCardId(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
              <CardThumb
                cardName={selectedCard.card_name}
                cdnSlug={selectedCard.cdn_slug}
                rarity={selectedCard.rarity}
                maxLevel={selectedCard.max_level}
                size={80}
                isSoulbound={selectedCard.is_soulbound}
              />
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {selectedCard.card_name}
              </p>
              {selectedCard.tier && (
                <span
                  style={{
                    display: 'inline-block',
                    background: TIER_CONFIG[selectedCard.tier].pillBg,
                    color: TIER_CONFIG[selectedCard.tier].pillText,
                    borderRadius: 5,
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    width: 'fit-content',
                  }}
                >
                  {selectedCard.tier}-tier
                </span>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Role</label>
                <input
                  value={selectedCard.role}
                  onChange={(e) => updateAnnotation(selectedCard.card_id, 'role', e.target.value)}
                  placeholder="e.g. Tank, Support"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.8rem',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Notes</label>
                <textarea
                  value={selectedCard.notes}
                  onChange={(e) => updateAnnotation(selectedCard.card_id, 'notes', e.target.value)}
                  placeholder="Why this tier?"
                  rows={4}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.8rem',
                    outline: 'none',
                    resize: 'vertical',
                    width: '100%',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Drag overlay — shows card ghost while dragging */}
        <DragOverlay>
          {activeCard ? (
            <div style={{ opacity: 0.9, transform: 'scale(1.05)' }}>
              <CardThumb
                cardName={activeCard.card_name}
                cdnSlug={activeCard.cdn_slug}
                rarity={activeCard.rarity}
                maxLevel={activeCard.max_level}
                size={62}
                isSoulbound={activeCard.is_soulbound}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
