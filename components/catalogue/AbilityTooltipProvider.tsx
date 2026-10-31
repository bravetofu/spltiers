'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { abilityInfo } from '@/lib/splinterlands/abilities'

type Active = {
  button: HTMLButtonElement
  info: ReturnType<typeof abilityInfo>
}
const findButton = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLButtonElement>('button[data-ability]')
    : null

export default function AbilityTooltipProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const id = useId()
  const popup = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const [active, setActive] = useState<Active | null>(null)
  const [position, setPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const cancelHide = () => clearTimeout(timer.current)
  const hide = () => {
    cancelHide()
    // A short crossing allowance keeps the source link reachable. Entering the
    // next icon replaces the tooltip immediately, without waiting for this timer.
    timer.current = setTimeout(() => setActive(null), 50)
  }
  function show(target: EventTarget | null) {
    const button = findButton(target)
    if (!button) return
    cancelHide()
    setActive((current) =>
      current?.button === button
        ? current
        : { button, info: abilityInfo(JSON.parse(button.dataset.ability!)) }
    )
  }
  useLayoutEffect(() => {
    if (!active || !popup.current) return
    const rect = active.button.getBoundingClientRect()
    const { offsetWidth: width, offsetHeight: height } = popup.current
    setPosition({
      top: Math.max(
        8,
        Math.min(
          rect.top > height + 12 ? rect.top - height - 6 : rect.bottom + 6,
          window.innerHeight - height - 8
        )
      ),
      left: Math.max(
        8,
        Math.min(
          rect.left + rect.width / 2 - width / 2,
          window.innerWidth - width - 8
        )
      ),
    })
    active.button.setAttribute('aria-describedby', id)
    return () => active.button.removeAttribute('aria-describedby')
  }, [active, id])
  useEffect(() => {
    if (!active) return
    const dismiss = (event: PointerEvent) => {
      if (
        !active.button.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setActive(null)
    }
    const close = () => setActive(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [active])
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <div
      className="ability-tooltip-region"
      onPointerOver={(event) => {
        if (event.pointerType !== 'touch') show(event.target)
      }}
      onPointerOut={(event) => {
        const button = findButton(event.target)
        if (
          button &&
          !button.contains(event.relatedTarget as Node) &&
          !popup.current?.contains(event.relatedTarget as Node)
        )
          hide()
      }}
      onFocusCapture={(event) => show(event.target)}
      onBlurCapture={(event) => {
        if (!popup.current?.contains(event.relatedTarget as Node))
          setActive(null)
      }}
      onClickCapture={(event) => show(event.target)}
    >
      {children}
      {active &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            className="ability-tooltip"
            style={position ?? { visibility: 'hidden' }}
            onPointerEnter={cancelHide}
            onPointerLeave={hide}
          >
            <strong>{active.info.label}</strong>
            <p>{active.info.description}</p>
            <a href={active.info.source} target="_blank" rel="noreferrer">
              Official ability guide ↗
            </a>
          </div>,
          document.body
        )}
    </div>
  )
}
