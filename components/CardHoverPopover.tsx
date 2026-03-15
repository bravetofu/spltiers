'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { rarityMaxLevel } from '@/lib/editions'

const TIER_STRIPE: Record<string, string> = {
  S: '#ffd700',
  A: '#2ecc71',
  B: '#3498db',
  C: '#95a5a6',
  D: '#555e6a',
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

const POPOVER_W = 200
const POPOVER_H = 303 // 200 * (3/2) + 3px stripe

export default function CardHoverPopover({
  children,
  cardName,
  cdnSlug,
  rarity,
  tier,
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

  function handleMouseEnter() {
    if (isTouchDevice) return
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()

    let x = rect.right + 10
    if (x + POPOVER_W > window.innerWidth - 8) {
      x = rect.left - POPOVER_W - 10
    }
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

  const stripeColor = TIER_STRIPE[tier] ?? TIER_STRIPE['C']

  function CardImage({ width }: { width: number }) {
    const imgH = Math.round(width * (3 / 2))
    return (
      <div style={{ width, height: imgH, background: '#080c10', position: 'relative' }}>
        {imgErrored ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#484f58', fontSize: 11, textAlign: 'center' }}>{cardName}</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={cardName}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            onError={() => setImgErrored(true)}
          />
        )}
      </div>
    )
  }

  function Popover({ width }: { width: number }) {
    return (
      <div
        style={{
          width,
          background: '#080c10',
          border: '1px solid #30363d',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div style={{ height: 3, background: stripeColor }} />
        <CardImage width={width} />
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
      {mounted && hoverVisible && !isTouchDevice &&
        createPortal(
          <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}>
            <Popover width={POPOVER_W} />
          </div>,
          document.body,
        )}

      {/* Mobile tap modal */}
      {mounted && modalOpen &&
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
              padding: 16,
            }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
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
              <Popover width={280} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
