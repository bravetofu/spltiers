// components/Logo.tsx
// Usage: <Logo size="nav" /> or <Logo size="full" />

interface LogoProps {
  size?: 'nav' | 'full'
}

export function Logo({ size = 'nav' }: LogoProps) {
  const isNav = size === 'nav'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
      {/* Eyebrow */}
      <div style={{
        fontSize: isNav ? '7px' : '11px',
        fontWeight: 500,
        color: '#ffd700',
        letterSpacing: isNav ? '2.5px' : '4px',
        textTransform: 'uppercase',
        lineHeight: 1,
        marginBottom: '1px',
      }}>
        tier lists
      </div>

      {/* Wordmark */}
      <div style={{
        fontSize: isNav ? '18px' : '30px',
        fontWeight: 800,
        letterSpacing: isNav ? '-1.5px' : '-2px',
        lineHeight: 1,
      }}>
        <span style={{ color: '#f0f6fc' }}>splin</span>
        <span style={{ color: '#e63946' }}>tiers</span>
      </div>

      {/* Tier stripe */}
      <div style={{ display: 'flex', gap: isNav ? '2px' : '3px', marginTop: isNav ? '3px' : '5px' }}>
        <div style={{ width: isNav ? '20px' : '36px', height: isNav ? '2px' : '3px', borderRadius: '2px', background: '#ffd700' }} />
        <div style={{ width: isNav ? '14px' : '26px', height: isNav ? '2px' : '3px', borderRadius: '2px', background: '#2ecc71' }} />
        <div style={{ width: isNav ? '11px' : '20px', height: isNav ? '2px' : '3px', borderRadius: '2px', background: '#3498db' }} />
        <div style={{ width: isNav ? '8px' : '14px', height: isNav ? '2px' : '3px', borderRadius: '2px', background: '#95a5a6' }} />
        <div style={{ width: isNav ? '5px' : '10px', height: isNav ? '2px' : '3px', borderRadius: '2px', background: '#555e6a' }} />
      </div>
    </div>
  )
}
