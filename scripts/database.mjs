import nextEnv from '@next/env'
import { neon, neonConfig } from '@neondatabase/serverless'

neonConfig.fetchEndpoint = (host) => `https://${host}/sql`

nextEnv.loadEnvConfig(process.cwd())

export function database() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  // HTTP transactions keep each batch atomic without session state or native TCP.
  return neon(url, { fetchOptions: { cache: 'no-store' } })
}
