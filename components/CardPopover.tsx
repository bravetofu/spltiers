'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { rarityMaxLevel } from '@/lib/editions'
import type { TierEntry } from './TierListClient'

// ── Sub-type lazy fetch (module-level cache) ───────────────────────────────────
let _subTypePromise: Promise<Map<number, string>> | null = null

function getSubTypeMap(): Promise<Map<number, string>> {
  if (!_subTypePromise) {
    _subTypePromise = fetch('https://api.splinterlands.io/cards/get_details', {
      headers: { 'Accept-Encoding': 'gzip, deflate, br, zstd' },
    })
      .then((r) => r.json())
      .then((cards: Array<{ id: number; sub_type?: string | null; type?: string }>) => {
        const map = new Map<number, string>()
        for (const c of cards) {
          const label = c.sub_type || c.type || ''
          if (label) map.set(c.id, label)
        }
        return map
      })
      .catch(() => new Map<number, string>())
  }
  return _subTypePromise
}

// ── Config ─────────────────────────────────────────────────────────────────────
const TIER_STRIPE: Record<string, string> = {
  S: '#ffd700', A: '#2ecc71', B: '#3498db', C: '#95a5a6', D: '#555e6a',
}

const TIER_BADGE: Record<string, { bg: string; text: string }> = {
  S: { bg: '#3d3000', text: '#ffd700' },
  A: { bg: '#0d3320', text: '#2ecc71' },
  B: { bg: '#0d2440', text: '#3498db' },
  C: { bg: '#1c2128', text: '#95a5a6' },
  D: { bg: '#161b22', text: '#555e6a' },
}

const RARITY_BADGE: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: 'Common',    bg: '#21262d', text: '#95a5a6' },
  2: { label: 'Rare',      bg: '#0d2440', text: '#3498db' },
  3: { label: 'Epic',      bg: '#2d0d4a', text: '#a855f7' },
  4: { label: 'Legendary', bg: '#3d2800', text: '#ffd700' },
}

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        borderRadius: 5,
        fontSize: 10,
        fontWeight: 600,
        background: bg,
        color: text,
        lineHeight: '18px',
      }}
    >
      {label}
    </span>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Props = {
  card: TierEntry
  anchorRect: DOMRect | null
  editionName: string
  isMobile: boolean
  onClose: () => void
}

const POPUP_W = 240
const POPUP_H_EST = 480

// ── Component ──────────────────────────────────────────────────────────────────
export default function CardPopover({ card, anchorRect, editionName, isMobile, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [subType, setSubType] = useState('')

  useEffect(() => {
    setMounted(true)
    getSubTypeMap().then((map) => setSubType(map.get(card.card_id) ?? ''))
  }, [card.card_id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted) return null

  const maxLevel = rarityMaxLevel(card.rarity)
  const imgSrc = `https://d36mxiodymuqjm.cloudfront.net/cards_by_level/${card.cdn_slug}/${encodeURIComponent(card.card_name)}_lv${maxLevel}.png`
  const tierStripe = TIER_STRIPE[card.tier] ?? '#555e6a'
  const tierBadge = TIER_BADGE[card.tier] ?? TIER_BADGE.D
  const rarityBadge = RARITY_BADGE[card.rarity] ?? RARITY_BADGE[1]
  const subLabel = [subType, editionName].filter(Boolean).join(' · ')

  const popupContent = (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 12,
        overflow: 'hidden',
        width: POPUP_W,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          background: '#0d1117',
          borderBottom: '1px solid #21262d',
          padding: '8px 10px 8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#f0f6fc',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {card.card_name}
          </div>
          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
            {subLabel}
          </div>
        </div>
        <button
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#30363d'
            e.currentTarget.style.color = '#f0f6fc'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#21262d'
            e.currentTarget.style.color = '#8b949e'
          }}
          style={{
            width: 22,
            height: 22,
            flexShrink: 0,
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: 5,
            fontSize: 11,
            color: '#8b949e',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Tier stripe */}
      <div style={{ height: 3, background: tierStripe }} />

      {/* Card image */}
      <div style={{ background: '#060a0e', padding: '4px 8px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={card.card_name}
          loading="lazy"
          style={{ display: 'block', width: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge label={card.tier} bg={tierBadge.bg} text={tierBadge.text} />
          <Badge label={rarityBadge.label} bg={rarityBadge.bg} text={rarityBadge.text} />
          {card.role && (
            <span style={{ marginLeft: 'auto' }}>
              <Badge label={card.role} bg="#21262d" text="#c9d1d9" />
            </span>
          )}
        </div>
        {card.notes && (
          <>
            <hr style={{ border: 'none', borderTop: '1px solid #21262d', margin: '8px 0 6px' }} />
            <p style={{ fontSize: 11, color: '#8b949e', fontStyle: 'italic', lineHeight: 1.6, margin: 0 }}>
              {card.notes}
            </p>
          </>
        )}
      </div>
    </div>
  )

  // Mobile web: centered modal with backdrop (hover-none devices or small screens)
  if (isMobile || window.innerWidth < 768) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.72)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        <div
          style={{ maxWidth: 280, width: 'calc(100% - 32px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {popupContent}
        </div>
      </div>,
      document.body,
    )
  }

  // Desktop: position to right of card (or left if overflow)
  let x = (anchorRect?.right ?? 0) + 8
  if (x + POPUP_W > window.innerWidth - 16) {
    x = (anchorRect?.left ?? 0) - POPUP_W - 8
  }
  let y = anchorRect?.top ?? 0
  if (y + POPUP_H_EST > window.innerHeight - 16) {
    y = window.innerHeight - POPUP_H_EST - 16
  }
  y = Math.max(8, y)

  return createPortal(
    <div
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999 }}
      onClick={(e) => e.stopPropagation()}
    >
      {popupContent}
    </div>,
    document.body,
  )
}
