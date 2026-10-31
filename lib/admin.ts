import 'server-only'
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function requireAdmin(): Promise<boolean> {
  const token = cookies().get('admin_token')?.value
  if (!token || !process.env.JWT_SECRET) return false
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET), { algorithms: ['HS256'] })
    return payload.account === (process.env.NEXT_PUBLIC_HIVE_ADMIN_ACCOUNT ?? 'brave.sps')
  } catch {
    return false
  }
}

export function revalidateEditions(slug: string) {
  revalidateTag('editions')
  for (const path of ['/', '/tier-list/all', `/tier-list/${slug}`, '/sitemap.xml', '/api/tier-entries']) {
    revalidatePath(path)
  }
}

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
