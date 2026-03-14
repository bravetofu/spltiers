import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import Nav from '@/components/Nav'
import AdminLoginForm from '@/components/AdminLoginForm'

async function getSession(): Promise<{ account: string } | null> {
  const token = cookies().get('admin_token')?.value
  if (!token) return null

  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) return null

  try {
    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    return { account: payload.account as string }
  } catch {
    return null
  }
}

export default async function AdminPage() {
  const session = await getSession()

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
        }}
      >
        {session ? (
          // Authenticated view — Phase 2 will replace this with the edition list
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: '10px',
              padding: '2.5rem',
              maxWidth: '600px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Signed in as
            </p>
            <p
              style={{
                color: 'var(--accent-gold)',
                fontWeight: 700,
                fontSize: '1.1rem',
                marginBottom: '1.5rem',
              }}
            >
              @{session.account}
            </p>
            <h2
              style={{
                color: 'var(--text-primary)',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '0.75rem',
              }}
            >
              Admin Panel
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Coming soon: edition management.
            </p>
          </div>
        ) : (
          <AdminLoginForm />
        )}
      </main>
    </div>
  )
}
