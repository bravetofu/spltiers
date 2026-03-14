import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { PublicKey, Signature } from '@hiveio/dhive'
import { SignJWT } from 'jose'

const ADMIN_ACCOUNT = process.env.NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT ?? 'brave.sps'
const HIVE_API = 'https://api.hive.blog'

/**
 * POST /admin/verify
 * Body: { account: string, challenge: string, signature: string }
 *
 * Always returns JSON (never redirects) so the client can handle the outcome.
 * Responses:
 *   200 { ok: true }              — verified, JWT cookie set
 *   401 { error: string, step }   — verification failed (wrong account / bad sig)
 *   400 { error: string }         — bad request
 *   502 { error: string }         — Hive API error
 */
export async function POST(req: NextRequest) {
  console.log('[verify] request received')

  let body: { account?: string; challenge?: string; signature?: string }
  try {
    body = await req.json()
  } catch {
    console.log('[verify] invalid JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { account, challenge, signature } = body
  console.log('[verify] account:', account, '| challenge length:', challenge?.length, '| sig length:', signature?.length)

  if (!account || !challenge || !signature) {
    console.log('[verify] missing fields')
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Only brave.sps may log in — return 401, never redirect (fetch follows redirects)
  if (account !== ADMIN_ACCOUNT) {
    console.log('[verify] wrong account:', account, '(expected', ADMIN_ACCOUNT + ')')
    return NextResponse.json({ error: 'Unauthorized account', step: 'account_check' }, { status: 401 })
  }

  // Fetch the public posting key for brave.sps from the Hive API
  let publicKeyStr: string
  try {
    console.log('[verify] fetching Hive public key for', ADMIN_ACCOUNT)
    const hiveRes = await fetch(HIVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'condenser_api.get_accounts',
        params: [[ADMIN_ACCOUNT]],
        id: 1,
      }),
      cache: 'no-store',
    })
    const hiveData = await hiveRes.json()
    publicKeyStr = hiveData.result[0].posting.key_auths[0][0] as string
    console.log('[verify] got public key:', publicKeyStr)
  } catch (err) {
    console.error('[verify] Hive API error:', err)
    return NextResponse.json({ error: 'Failed to fetch Hive account info' }, { status: 502 })
  }

  // Verify signature.
  // Hive Keychain's requestSignBuffer signs SHA256(message) with secp256k1.
  // dhive's PublicKey.verify() expects the 32-byte SHA256 hash as the message argument.
  try {
    const messageHash = createHash('sha256').update(challenge).digest()
    console.log('[verify] message hash (hex):', messageHash.toString('hex'))
    console.log('[verify] signature (first 20 chars):', signature.slice(0, 20))

    const pubKey = PublicKey.fromString(publicKeyStr)
    const sig = Signature.fromString(signature)
    const valid = pubKey.verify(messageHash, sig)

    console.log('[verify] signature valid:', valid)

    if (!valid) {
      return NextResponse.json({ error: 'Signature verification failed', step: 'sig_verify' }, { status: 401 })
    }
  } catch (err) {
    console.error('[verify] dhive error:', err)
    return NextResponse.json({ error: 'Signature parsing error', step: 'sig_parse', detail: String(err) }, { status: 401 })
  }

  // Issue a JWT stored in an httpOnly cookie (expires in 7 days)
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    console.error('[verify] JWT_SECRET env var is not set!')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const secret = new TextEncoder().encode(jwtSecret)
  const token = await new SignJWT({ account })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  console.log('[verify] JWT issued successfully, setting cookie')

  const response = NextResponse.json({ ok: true })
  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
  return response
}
