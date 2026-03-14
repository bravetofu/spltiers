'use client'

import Link from 'next/link'

/**
 * Logo: italic "spltiers" in accent-red (#e63946)
 * followed immediately by a 5px gold (#ffd700) circle dot.
 */
function Logo() {
  return (
    <Link href="/" className="nav-logo">
      <span className="nav-logo-text">spltiers</span>
      <span className="nav-logo-dot" />
    </Link>
  )
}

export default function Nav() {
  return (
    <>
      <style>{`
        .nav-logo {
          display: inline-flex;
          align-items: flex-start;
          text-decoration: none;
          line-height: 1;
        }
        .nav-logo-text {
          font-style: italic;
          font-weight: 700;
          font-size: 1.25rem;
          color: #e63946;
          letter-spacing: -0.02em;
        }
        .nav-logo-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #ffd700;
          margin-left: 2px;
          margin-top: 4px;
          flex-shrink: 0;
        }
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
          <Logo />
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
