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
 * 1. Fetch brave.sps's public posting key from Hive
 * 2. Verify the signature of the challenge using dhive
 * 3. If account !== 'brave.sps' → redirect to /admin/unauthorized
 * 4. On success → issue JWT in httpOnly cookie
 */
export async function POST(req: NextRequest) {
  let body: { account?: string; challenge?: string; signature?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { account, challenge, signature } = body

  if (!account || !challenge || !signature) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Only brave.sps may log in
  if (account !== ADMIN_ACCOUNT) {
    return NextResponse.redirect(new URL('/admin/unauthorized', req.url))
  }

  // Fetch the public posting key for brave.sps from the Hive API
  let publicKeyStr: string
  try {
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
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Hive account info' }, { status: 502 })
  }

  // Verify signature
  // Hive Keychain's requestSignBuffer signs the raw string;
  // dhive expects a 32-byte SHA-256 hash as the message.
  try {
    const messageHash = createHash('sha256').update(challenge).digest()
    const pubKey = PublicKey.fromString(publicKeyStr)
    const sig = Signature.fromString(signature)
    const valid = pubKey.verify(messageHash, sig)
    if (!valid) {
      return NextResponse.redirect(new URL('/admin/unauthorized', req.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/admin/unauthorized', req.url))
  }

  // Issue a JWT stored in an httpOnly cookie (expires in 7 days)
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const token = await new SignJWT({ account })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

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
