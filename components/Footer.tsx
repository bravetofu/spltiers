'use client'

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid #21262d',
        padding: '18px 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        color: '#484f58',
        fontSize: '0.78rem',
      }}
    >
      <span>Made with ❤️ by Bravetofu</span>
      <a
        href="https://x.com/bravetofu"
        target="_blank"
        rel="noopener noreferrer"
        title="Bravetofu on X"
        style={{ color: '#484f58', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#8b949e')}
        onMouseLeave={e => (e.currentTarget.style.color = '#484f58')}
      >
        {/* X (Twitter) icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
      <a
        href="https://peakd.com/@bravetofu"
        target="_blank"
        rel="noopener noreferrer"
        title="Bravetofu on Hive"
        style={{ color: '#484f58', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#8b949e')}
        onMouseLeave={e => (e.currentTarget.style.color = '#484f58')}
      >
        {/* Hive logo mark */}
        <svg width="14" height="14" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
          <polygon points="50,2 95,26 95,74 50,98 5,74 5,26" fill="none" stroke="currentColor" strokeWidth="10" />
          <polygon points="50,22 78,37 78,63 50,78 22,63 22,37" fill="currentColor" opacity="0.6" />
          <circle cx="50" cy="50" r="14" fill="currentColor" />
        </svg>
      </a>
    </footer>
  )
}
