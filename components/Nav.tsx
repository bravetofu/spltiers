'use client'

import Link from 'next/link'
import Logo from '@/components/Logo'

export default function Nav() {
  return (
    <>
      <style>{`
        .nav-link {
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.15s;
        }
        .nav-link:hover {
          color: var(--text-primary);
        }
      `}</style>
      <nav
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              marginLeft: 'auto',
            }}
          >
            <Link href="/" className="nav-link">
              tier lists
            </Link>
            <Link href="/pricing" className="nav-link">
              pricing
            </Link>
          </div>
        </div>
      </nav>
    </>
  )
}
