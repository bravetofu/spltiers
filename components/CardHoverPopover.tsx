'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { rarityMaxLevel } from '@/lib/editions'

const TIER_CONFIG: Record<string, { pillBg: string; pillText: string }> = {
  S: { pillBg: '#3d3000', pillText: '#ffd700' },
  A: { pillBg: '#0d3320', pillText: '#2ecc71' },
  B: { pillBg: '#0d2440', pillText: '#3498db' },
  C: { pillBg: '#1c2128', pillText: '#95a5a6' },
  D: { pillBg: '#161b22', pillText: '#555e6a' },
}

// Approximate role descriptions shown in beginner mode
const ROLE_DESCRIPTIONS: Record<string, string> = {
  tank: 'High HP frontline that absorbs damage',
  support: 'Buffs your team or debuffs enemies',
  damage: 'High attack output, primary damage dealer',
  snipe: 'Targets back-line non-melee cards',
  sneak: 'Attacks the last card in enemy lineup',
  opportunity: 'Attacks the enemy card with lowest HP',
  magic: 'Bypasses armor — damages health directly',
  ranged: 'Attacks from behind position 1',
  healer: 'Restores health to friendly cards',
  utility: 'Provides situational abilities or debuffs',
}

type Props = {
  children: React.ReactNode
  cardName: string
  cdnSlug: string
  rarity: number
  tier: string
  role?: string | null
  notes?: string | null
  isSoulbound?: boolean
  beginnerMode?: boolean
}

export default function CardHoverPopover({
  children,
  cardName,
  cdnSlug,
  rarity,
  tier,
  role,
  notes,
  isSoulbound = false,
  beginnerMode = false,
}: Props) {
  const [hoverVisible, setHoverVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [imgErrored, setImgErrored] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    // Devices where hover is the primary input (mice) → false; touch-only → true
    setIsTouchDevice(window.matchMedia('(hover: none)').matches)
  }, [])

  // Close modal on Escape
  useEffect(() => {
    if (!modalOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalOpen])

  const maxLevel = rarityMaxLevel(rarity)
  const imgSrc = `https://d36mxiodymuqjm.cloudfront.net/cards_by_level/${cdnSlug}/${encodeURIComponent(cardName)}_lv${maxLevel}.png`

  const POPOVER_W = 240
  const POPOVER_H = 420 // conservative estimate for viewport clamping

  function handleMouseEnter() {
    if (isTouchDevice) return
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()

    // Prefer right; fall back to left if not enough space
    let x = rect.right + 10
    if (x + POPOVER_W > window.innerWidth - 8) {
      x = rect.left - POPOVER_W - 10
    }
    // Clamp vertically
    let y = rect.top
    if (y + POPOVER_H > window.innerHeight - 8) {
      y = window.innerHeight - POPOVER_H - 8
    }
    y = Math.max(8, y)

    setPos({ x, y })
    setHoverVisible(true)
  }

  function handleMouseLeave() {
    setHoverVisible(false)
  }

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isTouchDevice) return
    e.preventDefault()
    setModalOpen(true)
  }, [isTouchDevice])

  const tierCfg = TIER_CONFIG[tier] ?? TIER_CONFIG['C']

  // Role description for beginner mode (case-insensitive key lookup)
  const roleDesc = role
    ? ROLE_DESCRIPTIONS[role.toLowerCase().trim()] ?? null
    : null

  // Shared card info block used in both popover and modal
  function CardInfoBody() {
    return (
      <>
        {/* Card name */}
        <p
          style={{
            color: '#f0f6fc',
            fontWeight: 600,
            fontSize: '0.85rem',
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {cardName}
        </p>

        {/* Tier badge */}
        <span
          style={{
            display: 'inline-block',
            background: tierCfg.pillBg,
            color: tierCfg.pillText,
            borderRadius: 5,
            padding: '2px 7px',
            fontSize: '0.7rem',
            fontWeight: 700,
            width: 'fit-content',
          }}
        >
          {tier}-tier
          {beginnerMode && (
            <span style={{ fontWeight: 400, marginLeft: 4, fontSize: '0.65rem' }}>
              {tier === 'S' && '— dominant'}
              {tier === 'A' && '— very strong'}
              {tier === 'B' && '— solid pick'}
              {tier === 'C' && '— situational'}
              {tier === 'D' && '— rarely used'}
            </span>
          )}
        </span>

        {/* Role tag */}
        {role && (
          <div>
            <span
              style={{
                display: 'inline-block',
                background: '#21262d',
                border: '1px solid #30363d',
                color: '#c9d1d9',
                borderRadius: 5,
                padding: '2px 7px',
                fontSize: '0.7rem',
                fontWeight: 500,
              }}
            >
              {role}
            </span>
            {beginnerMode && roleDesc && (
              <p
                style={{
                  color: '#8b949e',
                  fontSize: '0.68rem',
                  margin: '3px 0 0',
                  lineHeight: 1.4,
                }}
              >
                {roleDesc}
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        {notes && (
          <p
            style={{
              color: '#8b949e',
              fontSize: '0.72rem',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {notes}
          </p>
        )}
      </>
    )
  }

  // Shared image section
  function CardImageSection({ width }: { width: number }) {
    const innerW = width - 16
    const imgH = Math.round(innerW * (3 / 2))
    return (
      <div
        style={{
          width,
          background: '#161b22',
          position: 'relative',
          flexShrink: 0,
          padding: 8,
          boxSizing: 'border-box',
        }}
      >
        {imgErrored ? (
          <div
            style={{
              width: innerW,
              height: imgH,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#21262d',
              borderRadius: 4,
            }}
          >
            <span style={{ color: '#484f58', fontSize: 11, textAlign: 'center' }}>
              {cardName}
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={cardName}
            style={{
              width: innerW,
              height: imgH,
              objectFit: 'contain',
              background: '#161b22',
              display: 'block',
              borderRadius: 4,
            }}
            onError={() => setImgErrored(true)}
          />
        )}

        {/* Soulbound lock badge */}
        {isSoulbound && (
          <div
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 4,
              padding: '2px 5px',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <svg width="9" height="10" viewBox="0 0 9 10" fill="none">
              <rect x="1" y="4" width="7" height="6" rx="1" fill="#c9d1d9" />
              <path d="M2.5 4V3a2 2 0 0 1 4 0v1" stroke="#c9d1d9" strokeWidth="1.2" fill="none" />
            </svg>
            <span style={{ color: '#c9d1d9', fontSize: 9, fontWeight: 600 }}>Soulbound</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleTap}
      style={{ display: 'inline-block', cursor: isTouchDevice ? 'pointer' : undefined }}
    >
      {children}

      {/* Desktop hover popover */}
      {mounted &&
        hoverVisible &&
        !isTouchDevice &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              width: POPOVER_W,
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
              zIndex: 9999,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <CardImageSection width={POPOVER_W} />
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <CardInfoBody />
            </div>
          </div>,
          document.body,
        )}

      {/* Mobile tap modal */}
      {mounted &&
        modalOpen &&
        createPortal(
          <div
            onClick={() => setModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.72)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 14,
                boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                width: '100%',
                maxWidth: 320,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* X close button */}
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  zIndex: 1,
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#c9d1d9',
                  fontSize: 16,
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>

              <CardImageSection width={320} />
              <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <CardInfoBody />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
