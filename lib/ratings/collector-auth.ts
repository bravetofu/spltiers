import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { timingSafeEqual } from 'node:crypto'
const audience = 'https://www.splintiers.com/api/cron/collect-battles'
const keys = createRemoteJWKSet(
  new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),
)
export function isCollectorWorkflow(payload: JWTPayload) {
  return (
    payload.repository_id === '1181334053' &&
    payload.repository_owner_id === '221731944' &&
    payload.ref === 'refs/heads/main' &&
    payload.workflow_ref ===
      'bravetofu/spltiers/.github/workflows/collect-battles.yml@refs/heads/main' &&
    ['schedule', 'workflow_dispatch', 'push'].includes(
      String(payload.event_name),
    )
  )
}
export async function authorizeCollector(
  header: string,
  secret = process.env.CRON_SECRET,
) {
  const expected = Buffer.from(`Bearer ${secret ?? ''}`),
    actual = Buffer.from(header)
  if (
    secret &&
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  )
    return true
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (token.split('.').length !== 3 || token.length > 20000) return false
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: 'https://token.actions.githubusercontent.com',
      audience,
      algorithms: ['RS256'],
      maxTokenAge: '10m',
    })
    return isCollectorWorkflow(payload)
  } catch {
    return false
  }
}
