'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { abilityInfo } from '@/lib/splinterlands/abilities'
import type { LandAbility } from '@/lib/splinterlands/catalogue'

export default function AbilityIcon({
  ability,
  label = false,
}: {
  ability: string | LandAbility
  label?: boolean
}) {
  const info = abilityInfo(ability)
  const id = useId()
  const anchor = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    if (!open || !anchor.current || !popup.current) return
    const rect = anchor.current.getBoundingClientRect()
    const height = popup.current.offsetHeight
    const width = popup.current.offsetWidth
    setPosition({
      top: rect.top > height + 12 ? rect.top - height - 8 : rect.bottom + 8,
      left: Math.max(
        8,
        Math.min(
          rect.left + rect.width / 2 - width / 2,
          window.innerWidth - width - 8
        )
      ),
    })
  }, [open])
  useEffect(() => {
    if (!open) return
    const dismiss = (event: Event) => {
      if (
        !anchor.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false)
    }
    const scroll = () => setOpen(false)
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [open])
  function show() {
    clearTimeout(hideTimer.current)
    setOpen(true)
  }
  function hide() {
    hideTimer.current = setTimeout(() => setOpen(false), 180)
  }
  useEffect(() => () => clearTimeout(hideTimer.current), [])
  return (
    <>
      <button
        ref={anchor}
        className={`ability-icon ${label ? 'ability-labeled' : ''}`}
        type="button"
        aria-label={info.label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={(event) => {
          if (!popup.current?.contains(event.relatedTarget)) setOpen(false)
        }}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        {failed ? (
          <span className="ability-fallback" aria-hidden>
            {info.name.slice(0, 2)}
          </span>
        ) : (
          // Official CDN icons are already small; avoid a separate image optimizer request per ability.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.icon}
            width={28}
            height={28}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
        {label && <span>{info.label}</span>}
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            className="ability-tooltip"
            style={position}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <strong>{info.label}</strong>
            <p>{info.description}</p>
            <a href={info.source} target="_blank" rel="noreferrer">
              Official ability guide ↗
            </a>
          </div>,
          document.body
        )}
    </>
  )
}

export function AbilityList({
  abilities,
  labels = false,
}: {
  abilities: (string | LandAbility)[]
  labels?: boolean
}) {
  return (
    <div className="ability-list">
      {abilities.length ? (
        abilities.map((ability, index) => (
          <AbilityIcon
            key={`${Array.isArray(ability) ? ability.join(':') : ability}-${index}`}
            ability={ability}
            label={labels}
          />
        ))
      ) : (
        <span className="muted">—</span>
      )}
    </div>
  )
}
