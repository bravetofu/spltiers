'use client'

import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'

// Hive Keychain injects window.hive_keychain
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

export default function AdminPage() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'signing' | 'error'>('idle')
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
      const data = await res.json()
      challenge = data.challenge as string
    } catch {
      setStatus('error')
      setError('Failed to generate challenge. Please try again.')
      return
    }

    const account = process.env.NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT ?? 'brave.sps'

    // 2. Ask Keychain to sign the challenge with the posting key
    setStatus('signing')
    window.hive_keychain.requestSignBuffer(
      account,
      challenge,
      'Posting',
      async (response) => {
        if (!response.success || !response.result) {
          setStatus('error')
          setError(response.error ?? 'Keychain signing was cancelled or failed.')
          return
        }

        // 3. Send signed challenge to server for verification
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

          if (verifyRes.ok) {
            // JWT cookie set by server — reload the page so middleware grants access
            window.location.href = '/admin'
          } else {
            // Server returned redirect to /admin/unauthorized
            window.location.href = '/admin/unauthorized'
          }
        } catch {
          setStatus('error')
          setError('Verification request failed. Please try again.')
        }
      },
    )
  }

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
              }}
            >
              {error}
            </p>
          )}

          <button
            onClick={connectWithKeychain}
            disabled={status === 'checking' || status === 'signing'}
            style={{
              background: status === 'checking' || status === 'signing' ? 'var(--bg-tertiary)' : 'var(--accent-red)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: status === 'checking' || status === 'signing' ? 'not-allowed' : 'pointer',
              width: '100%',
              transition: 'opacity 0.15s',
            }}
          >
            {status === 'checking'
              ? 'Generating challenge…'
              : status === 'signing'
                ? 'Waiting for Keychain…'
                : 'Connect with Hive Keychain'}
          </button>
        </div>

        {/* Authenticated view — placeholder for Phase 2 */}
        <div
          id="admin-content"
          style={{ display: 'none', marginTop: '2rem', color: 'var(--text-secondary)' }}
        >
          <p>Coming soon: edition management.</p>
        </div>
      </main>
    </div>
  )
}
