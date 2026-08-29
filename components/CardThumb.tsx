'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  cardName: string
  cdnSlug: string
  rarity: number
  maxLevel: number
  size?: number
  isSoulbound?: boolean
  className?: string
  /** Show a small tooltip with the card name while hovering (pointer devices only) */
  showNameTooltip?: boolean
}

const RARITY_COLOUR: Record<number, string> = {
  1: '#95a5a6',
  2: '#3498db',
  3: '#a855f7',
  4: '#ffd700',
}

const RARITY_HOVER_COLOUR: Record<number, string> = {
  1: '#b0bec5',
  2: '#4db6e8',
  3: '#c084fc',
  4: '#ffe033',
}

// Gap between the thumbnail and its name tooltip
const TOOLTIP_GAP = 8

/**
 * Name tooltip, portalled to <body> so it is never clipped by the tier row's
 * `overflow: hidden`. Rendered only on the client, while hovering.
 */
function NameTooltip({ anchor, label }: { anchor: DOMRect; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Measure before paint so the tooltip never flashes at an unplaced position
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const left = Math.max(6, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 6))
    // Prefer above the tile; flip below when there isn't room
    const above = anchor.top - height - TOOLTIP_GAP
    setPos({ left, top: above < 6 ? anchor.bottom + TOOLTIP_GAP : above })
  }, [anchor, label])

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        position: 'fixed',
        left: pos ? pos.left : anchor.left,
        top: pos ? pos.top : anchor.top,
        visibility: pos ? 'visible' : 'hidden',
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: 6,
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        color: '#e6edf3',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.3,
        padding: '3px 7px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 9998,
      }}
    >
      {label}
    </div>,
    document.body,
  )
}

export default function CardThumb({
  cardName,
  cdnSlug,
  rarity,
  maxLevel,
  size = 62,
  isSoulbound = false,
  className,
  showNameTooltip = false,
}: Props) {
  const [errored, setErrored] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [canHover, setCanHover] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Pointer devices only — touch users tap the tile to open the full card popup.
  // Stays false on the server and on the first client render, so hydration matches.
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)')
    setCanHover(mq.matches)
    const handler = (e: MediaQueryListEvent) => setCanHover(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const updateAnchor = useCallback(() => {
    const el = wrapRef.current
    if (el) setAnchorRect(el.getBoundingClientRect())
  }, [])

  // Keep the tooltip glued to the tile if the page scrolls or resizes while hovering
  const tooltipVisible = showNameTooltip && canHover && hovered && anchorRect !== null
  useEffect(() => {
    if (!tooltipVisible) return
    window.addEventListener('scroll', updateAnchor, true)
    window.addEventListener('resize', updateAnchor)
    return () => {
      window.removeEventListener('scroll', updateAnchor, true)
      window.removeEventListener('resize', updateAnchor)
    }
  }, [tooltipVisible, updateAnchor])

  function handleMouseEnter() {
    setHovered(true)
    if (showNameTooltip) updateAnchor()
  }

  function handleMouseLeave() {
    setHovered(false)
    setAnchorRect(null)
  }

  const src = `https://d36mxiodymuqjm.cloudfront.net/cards_by_level/${cdnSlug}/${encodeURIComponent(cardName)}_lv${maxLevel}.png`

  const borderColor = hovered
    ? (RARITY_HOVER_COLOUR[rarity] ?? '#b0bec5')
    : (RARITY_COLOUR[rarity] ?? '#95a5a6')

  return (
    <div
      ref={wrapRef}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 8,
        border: `2px solid ${borderColor}`,
        padding: 2,
        flexShrink: 0,
        background: '#21262d',
        boxSizing: 'border-box',
        transform: hovered ? 'scale(1.06)' : undefined,
        transition: 'transform 0.15s, border-color 0.15s',
      }}
    >
      {/* Inner wrapper clips the image to rounded corners */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 4,
          overflow: 'hidden',
          background: '#21262d',
        }}
      >
        {errored ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: '#21262d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 9, color: '#484f58', textAlign: 'center', padding: 2, lineHeight: 1.2 }}>
              {cardName}
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={cardName}
            width={size}
            height={size}
            loading="lazy"
            style={{ objectFit: 'cover', objectPosition: 'center 8%', display: 'block', width: '100%', height: '100%', transform: 'scale(1.7)', transformOrigin: 'center 8%' }}
            onError={() => setErrored(true)}
          />
        )}
      </div>

      {isSoulbound && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 14,
            height: 14,
            background: 'rgba(0,0,0,0.7)',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* lock icon */}
          <svg width="9" height="10" viewBox="0 0 9 10" fill="none">
            <rect x="1" y="4" width="7" height="6" rx="1" fill="#c9d1d9" />
            <path d="M2.5 4V3a2 2 0 0 1 4 0v1" stroke="#c9d1d9" strokeWidth="1.2" fill="none" />
          </svg>
        </div>
      )}

      {tooltipVisible && anchorRect && <NameTooltip anchor={anchorRect} label={cardName} />}
    </div>
  )
}
