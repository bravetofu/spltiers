'use client'

import { useState } from 'react'
import Link from 'next/link'

type CardSet = {
  id: string
  slug: string
  name: string
  icon_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

type SetMeta = {
  rankedCount: number
  lastUpdated: string | null
  totalCards: number | null
}

type Props = {
  cardSets: CardSet[]
  meta: Record<string, SetMeta>
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AdminEditionList({ cardSets, meta }: Props) {
  const [sets, setSets] = useState<CardSet[]>(cardSets)
  const [showAddForm, setShowAddForm] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // New edition form state
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formIconUrl, setFormIconUrl] = useState('')
  const [formSortOrder, setFormSortOrder] = useState('')
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  async function toggleActive(set: CardSet) {
    setTogglingId(set.id)
    try {
      const res = await fetch('/api/admin/card-sets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: set.id, is_active: !set.is_active }),
      })
      if (res.ok) {
        setSets((prev) =>
          prev.map((s) => (s.id === set.id ? { ...s, is_active: !s.is_active } : s)),
        )
      }
    } finally {
      setTogglingId(null)
    }
  }

  async function handleAddEdition(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!formName.trim() || !formSlug.trim()) {
      setFormError('Name and slug are required.')
      return
    }
    setFormSaving(true)
    try {
      const res = await fetch('/api/admin/card-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          icon_url: formIconUrl.trim() || null,
          sort_order: formSortOrder ? parseInt(formSortOrder, 10) : 0,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFormError(body.error ?? 'Failed to add edition.')
        return
      }
      const newSet: CardSet = await res.json()
      setSets((prev) => [...prev, newSet].sort((a, b) => a.sort_order - b.sort_order))
      setShowAddForm(false)
      setFormName('')
      setFormSlug('')
      setFormIconUrl('')
      setFormSortOrder('')
    } finally {
      setFormSaving(false)
    }
  }

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
          Editions ({sets.length})
        </h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          style={{
            background: 'var(--accent-red)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.45rem 1rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showAddForm ? 'Cancel' : '+ Add edition'}
        </button>
      </div>

      {/* Add edition inline form */}
      {showAddForm && (
        <form
          onSubmit={handleAddEdition}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            padding: '1.25rem',
            marginBottom: '1rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Name *</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Chaos Legion"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Slug *</label>
            <input
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
              placeholder="chaos-legion"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Icon URL</label>
            <input
              value={formIconUrl}
              onChange={(e) => setFormIconUrl(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sort order</label>
            <input
              type="number"
              value={formSortOrder}
              onChange={(e) => setFormSortOrder(e.target.value)}
              placeholder="0"
              style={inputStyle}
            />
          </div>
          {formError && (
            <p
              style={{
                gridColumn: '1 / -1',
                color: 'var(--accent-red)',
                fontSize: '0.82rem',
                margin: 0,
              }}
            >
              {formError}
            </p>
          )}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              style={secondaryBtnStyle}
            >
              Cancel
            </button>
            <button type="submit" disabled={formSaving} style={primaryBtnStyle}>
              {formSaving ? 'Saving…' : 'Add edition'}
            </button>
          </div>
        </form>
      )}

      {/* Edition table */}
      {sets.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No editions yet. Add one above.
        </p>
      ) : (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div style={tableHeaderStyle}>
            <span style={{ flex: 2 }}>Edition</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Cards</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Ranked</span>
            <span style={{ flex: 1.5, textAlign: 'center' }}>Last updated</span>
            <span style={{ flex: 1, textAlign: 'center' }}>Active</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Actions</span>
          </div>
          {sets.map((set, i) => {
            const m = meta[set.id] ?? { rankedCount: 0, lastUpdated: null, totalCards: null }
            return (
              <div
                key={set.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.85rem 1.25rem',
                  borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                  gap: 8,
                }}
              >
                <span style={{ flex: 2, color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                  {set.name}
                  <span style={{ display: 'block', color: 'var(--text-faint)', fontWeight: 400, fontSize: '0.75rem' }}>
                    /{set.slug}
                  </span>
                </span>
                <span style={{ flex: 1, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {m.totalCards ?? '—'}
                </span>
                <span style={{ flex: 1, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {m.rankedCount}
                </span>
                <span style={{ flex: 1.5, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {formatDate(m.lastUpdated)}
                </span>
                <span style={{ flex: 1, textAlign: 'center' }}>
                  <button
                    onClick={() => toggleActive(set)}
                    disabled={togglingId === set.id}
                    style={{
                      background: set.is_active ? '#0d3320' : 'var(--bg-tertiary)',
                      color: set.is_active ? '#2ecc71' : 'var(--text-muted)',
                      border: `1px solid ${set.is_active ? '#2ecc71' : 'var(--border-default)'}`,
                      borderRadius: 6,
                      padding: '2px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {set.is_active ? 'Active' : 'Inactive'}
                  </button>
                </span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  <Link
                    href={`/admin/${set.slug}`}
                    style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 6,
                      padding: '4px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    Edit
                  </Link>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: '0.45rem 0.6rem',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
}

const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--accent-red)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '0.45rem 1rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
  padding: '0.45rem 1rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
}

const tableHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.6rem 1.25rem',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  gap: 8,
}
