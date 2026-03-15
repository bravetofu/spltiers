import type { Metadata } from 'next'
import './globals.css'

// metadataBase resolves relative og:image URLs. Set NEXT_PUBLIC_SITE_URL in prod.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'splintiers — Splinterlands Tier Lists & Deck Builder',
  description: 'Splinterlands card tier lists and market pricing tool.',
  openGraph: {
    title: 'splintiers — Splinterlands Tier Lists & Deck Builder',
    description: 'Splinterlands card tier lists and market pricing tool.',
    siteName: 'splintiers',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'splintiers — Splinterlands Tier Lists & Deck Builder',
    description: 'Splinterlands card tier lists and market pricing tool.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body style={{ margin: 0, background: '#0d1117', color: '#f0f6fc' }}>
        {children}
      </body>
    </html>
  )
}
