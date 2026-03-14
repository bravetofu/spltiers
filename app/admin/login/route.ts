import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

/**
 * GET /admin/login
 * Generates a random challenge string for Hive Keychain to sign.
 */
export async function GET() {
  const challenge = randomBytes(32).toString('hex')
  return NextResponse.json({ challenge })
}
