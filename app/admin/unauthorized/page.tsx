import Nav from '@/components/Nav'

export default function UnauthorizedPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Nav />
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 52px)',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            padding: '2.5rem',
            maxWidth: '480px',
            width: '100%',
          }}
        >
          <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</p>
          <h1
            style={{
              color: 'var(--text-primary)',
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
            }}
          >
            Access Denied
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            This user does not have access to the admin panel.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: '1.5rem',
              color: 'var(--accent-red)',
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            ← Back to home
          </a>
        </div>
      </main>
    </div>
  )
}
