import type { MetadataRoute } from 'next'
import { getCardSets } from '@/lib/db'
import { getCatalogue } from '@/lib/splinterlands/catalogue-server'
import { abilityNames } from '@/lib/splinterlands/abilities'
import { cardSlug } from '@/lib/splinterlands/catalogue'

// Next.js 14's file cache does not invalidate metadata route bodies by tag.
export const dynamic = 'force-dynamic'

// Set NEXT_PUBLIC_SITE_URL in your environment to your production domain.
// Falls back to the Vercel deployment URL, then a local dev URL.
function siteBase(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBase()

  let slugs: string[] = []
  try {
    slugs = (await getCardSets()).map((r) => r.slug)
  } catch {
    // Database unavailable at build time — sitemap will only include static routes
  }

  let cardSlugs: string[] = []
  try {
    cardSlugs = (await getCatalogue()).map((card) => card.slug)
  } catch (error) {
    console.error('[sitemap] Card catalogue unavailable:', error)
  }
  return [
    { url: `${base}/cards`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/abilities`, changeFrequency: 'daily', priority: 0.8 },
    {
      url: `${base}/ratings/methodology`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...abilityNames.map((name) => ({
      url: `${base}/ability/${cardSlug(name)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...cardSlugs.map((slug) => ({
      url: `${base}/card/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${base}/deck-builder`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...slugs.map((slug) => ({
      url: `${base}/tier-list/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
  ]
}
