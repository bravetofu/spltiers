'use client'

import Link from 'next/link'
import Logo from '@/components/Logo'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const pathname = usePathname()
  return (
    <>
      <nav
        className="site-nav"
        style={{
          height: '52px',
          background: '#0d1117',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          padding: '0 1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          <Logo size="nav" />
          <div
            className="nav-links"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              marginLeft: 'auto',
            }}
          >
            <Link
              href="/"
              className="nav-link"
              aria-current={
                pathname === '/' || pathname.startsWith('/tier-list')
                  ? 'page'
                  : undefined
              }
            >
              Tier Lists
            </Link>
            <Link
              href="/cards"
              className="nav-link"
              aria-current={pathname.startsWith('/card') ? 'page' : undefined}
            >
              Cards
            </Link>
            <Link href="/deck-builder" className="nav-link">
              Deck Builder
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}
