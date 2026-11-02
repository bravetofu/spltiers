'use client'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './HoverDetails.module.css'

/** Immediate, viewport-contained details shared by hover, keyboard focus and touch. */
export default function HoverDetails({
  children,
  content,
  label,
  interactive = false,
  disabled = false,
}: {
  children: ReactNode
  content: ReactNode
  label: string
  interactive?: boolean
  disabled?: boolean
}) {
  const id = useId(),
    anchor = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const show = () => {
    clearTimeout(timer.current)
    if (!disabled) setOpen(true)
  }
  const hide = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), 100)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])
  useLayoutEffect(() => {
    if (!open || disabled || !anchor.current || !panel.current) return
    const trigger =
      anchor.current.querySelector<HTMLElement>('button,[tabindex]')
    const previousDescription = trigger?.getAttribute('aria-describedby')
    trigger?.setAttribute(
      'aria-describedby',
      [previousDescription, id].filter(Boolean).join(' '),
    )
    const place = () => {
      if (!anchor.current || !panel.current) return
      const r = anchor.current.getBoundingClientRect(),
        p = panel.current.getBoundingClientRect()
      const top = Math.max(
        8,
        Math.min(
          r.bottom + p.height + 8 > innerHeight
            ? r.top - p.height - 6
            : r.bottom + 6,
          innerHeight - p.height - 8,
        ),
      )
      const left = Math.max(
        8,
        Math.min(r.left + r.width / 2 - p.width / 2, innerWidth - p.width - 8),
      )
      setPosition((current) =>
        current?.top === top && current.left === left ? current : { top, left },
      )
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(panel.current)
    return () => {
      observer.disconnect()
      if (previousDescription)
        trigger?.setAttribute('aria-describedby', previousDescription)
      else trigger?.removeAttribute('aria-describedby')
    }
  }, [open, disabled, id])
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const outside = (e: PointerEvent) => {
      if (
        !anchor.current?.contains(e.target as Node) &&
        !panel.current?.contains(e.target as Node)
      )
        close()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const scroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])
  return (
    <div
      className={styles.anchor}
      ref={anchor}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') show()
      }}
      onPointerLeave={(e) => {
        if (!panel.current?.contains(e.relatedTarget as Node)) hide()
      }}
      onFocusCapture={show}
      onBlurCapture={(e) => {
        if (!panel.current?.contains(e.relatedTarget as Node)) hide()
      }}
      onClickCapture={() => {
        if (interactive) show()
      }}
      onKeyDown={(e) => {
        if (
          interactive &&
          open &&
          e.key === 'Tab' &&
          !e.shiftKey &&
          !panel.current?.contains(e.target as Node)
        ) {
          const first = panel.current?.querySelector<HTMLElement>(
            'button,summary,a[href],[tabindex="0"]',
          )
          if (first) {
            e.preventDefault()
            first.focus()
          }
        }
      }}
      onPointerDownCapture={() => {
        if (!interactive) setOpen(false)
      }}
    >
      {children}
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role={interactive ? 'dialog' : 'tooltip'}
            aria-label={label}
            className={styles.panel}
            style={position ?? { visibility: 'hidden' }}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={hide}
            onFocusCapture={() => clearTimeout(timer.current)}
            onKeyDown={(e) => {
              if (
                interactive &&
                (e.key === 'Escape' || (e.key === 'Tab' && e.shiftKey))
              ) {
                e.preventDefault()
                anchor.current
                  ?.querySelector<HTMLElement>('button,[tabindex]')
                  ?.focus()
                if (e.key === 'Escape') setOpen(false)
              }
            }}
            onBlurCapture={(e) => {
              if (
                !panel.current?.contains(e.relatedTarget as Node) &&
                !anchor.current?.contains(e.relatedTarget as Node)
              )
                hide()
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  )
}
