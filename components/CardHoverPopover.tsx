'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { rarityMaxLevel } from '@/lib/editions'

type Props = {
  children: React.ReactNode
  cardName: string
  cdnSlug: string
  rarity: number
  tier?: string | null
  role?: string | null
  notes?: string | null
  isSoulbound?: boolean
  beginnerMode?: boolean
}

const POPOVER_W = 200
const POPOVER_H = 300 // 200 * (3/2)

export default function CardHoverPopover({
  children,
  cardName,
  cdnSlug,
  rarity,
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
    let y = rect.top - 25
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

  function CardImage({ width }: { width: number }) {
    const imgH = Math.round(width * (3 / 2))
    if (imgErrored) return null
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgSrc}
        alt={cardName}
        loading="lazy"
        width={width}
        height={imgH}
        style={{ width, height: imgH, objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
        onError={() => setImgErrored(true)}
      />
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
            <CardImage width={POPOVER_W} />
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
            <div onClick={(e) => e.stopPropagation()}>
              <CardImage width={280} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
