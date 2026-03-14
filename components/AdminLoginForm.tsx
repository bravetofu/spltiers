'use client'

import { useState } from 'react'

declare global {
  interface Window {
    hive_keychain?: {
      requestSignBuffer: (
        account: string,
        message: string,
        keyType: string,
        callback: (response: { success: boolean; result?: string; error?: string }) => void,
      ) => void
    }
  }
}

export default function AdminLoginForm() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'signing' | 'verifying' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function connectWithKeychain() {
    if (!window.hive_keychain) {
      setError('Hive Keychain extension not found. Please install it and reload.')
      return
    }

    setStatus('checking')
    setError(null)

    // 1. Fetch challenge from server
    let challenge: string
    try {
      const res = await fetch('/admin/login')
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      challenge = data.challenge as string
      console.log('[admin] challenge fetched, length:', challenge.length)
    } catch (err) {
      console.error('[admin] challenge fetch failed:', err)
      setStatus('error')
      setError('Failed to generate challenge. Please try again.')
      return
    }

    const account = process.env.NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT ?? 'brave.sps'

    // 2. Ask Keychain to sign the challenge with the posting key
    setStatus('signing')
    console.log('[admin] requesting Keychain signature for account:', account)

    window.hive_keychain.requestSignBuffer(
      account,
      challenge,
      'Posting',
      async (response) => {
        console.log('[admin] Keychain response:', response)

        if (!response.success || !response.result) {
          setStatus('error')
          setError(response.error ?? 'Keychain signing was cancelled or failed.')
          return
        }

        // 3. Send signed challenge to server for verification
        setStatus('verifying')
        console.log('[admin] sending to /admin/verify...')

        try {
          const verifyRes = await fetch('/admin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account,
              challenge,
              signature: response.result,
            }),
          })

          const data = await verifyRes.json().catch(() => ({}))
          console.log('[admin] verify response status:', verifyRes.status, '| body:', data)

          if (verifyRes.ok && (data as { ok?: boolean }).ok) {
            // JWT cookie is now set — navigate to /admin so the server component
            // re-renders and detects the session.
            console.log('[admin] auth success, navigating to /admin')
            window.location.href = '/admin'
          } else {
            console.warn('[admin] auth failed:', data)
            setStatus('error')
            setError(
              (data as { error?: string }).error ?? 'Verification failed. Check Vercel logs for details.',
            )
          }
        } catch (err) {
          console.error('[admin] verify fetch error:', err)
          setStatus('error')
          setError('Verification request failed. Please try again.')
        }
      },
    )
  }

  const busy = status === 'checking' || status === 'signing' || status === 'verifying'

  const buttonLabel =
    status === 'checking'
      ? 'Generating challenge…'
      : status === 'signing'
        ? 'Waiting for Keychain…'
        : status === 'verifying'
          ? 'Verifying signature…'
          : 'Connect with Hive Keychain'

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '2.5rem',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          color: 'var(--text-primary)',
          fontSize: '1.5rem',
          fontWeight: 700,
          marginBottom: '0.5rem',
        }}
      >
        Admin Login
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Sign in with your Hive posting key via Keychain.
      </p>

      {error && (
        <p
          style={{
            color: 'var(--accent-red)',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            background: '#2d0d10',
            border: '1px solid var(--accent-red)',
            borderRadius: '6px',
            padding: '0.625rem 0.875rem',
            textAlign: 'left',
          }}
        >
          {error}
        </p>
      )}

      <button
        onClick={connectWithKeychain}
        disabled={busy}
        style={{
          background: busy ? 'var(--bg-tertiary)' : 'var(--accent-red)',
          color: 'var(--text-primary)',
          border: 'none',
          borderRadius: '8px',
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: busy ? 'not-allowed' : 'pointer',
          width: '100%',
          transition: 'opacity 0.15s',
        }}
      >
        {buttonLabel}
      </button>
    </div>
  )
}
