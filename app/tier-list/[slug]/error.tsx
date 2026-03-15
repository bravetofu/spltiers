'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <p
          style={{
            color: '#f85149',
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          Failed to load tier list
        </p>
        <p style={{ color: '#8b949e', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          style={{
            padding: '0.5rem 1.25rem',
            background: 'var(--accent-red)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
