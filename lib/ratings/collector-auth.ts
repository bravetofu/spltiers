import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { timingSafeEqual } from 'node:crypto'
type Collector = 'battles' | 'prices'
const keys = createRemoteJWKSet(
  new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),
)
export function isCollectorWorkflow(
  payload: JWTPayload,
  collector: Collector = 'battles',
) {
  return (
    payload.repository_id === '1181334053' &&
    payload.repository_owner_id === '221731944' &&
    payload.ref === 'refs/heads/main' &&
    payload.workflow_ref ===
      `bravetofu/spltiers/.github/workflows/collect-${collector}.yml@refs/heads/main` &&
    ['schedule', 'workflow_dispatch', 'push'].includes(
      String(payload.event_name),
    )
  )
}
export async function authorizeCollector(
  header: string,
  secret = process.env.CRON_SECRET,
  collector: Collector = 'battles',
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
      audience: `https://www.splintiers.com/api/cron/collect-${collector}`,
      algorithms: ['RS256'],
      maxTokenAge: '10m',
    })
    return isCollectorWorkflow(payload, collector)
      ? payload.event_name === 'push'
        ? 'deployment'
        : true
      : false
  } catch {
    return false
  }
}
