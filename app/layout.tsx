import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'splintiers — Splinterlands Tier Lists & Pricing',
  description: 'Splinterlands card tier lists and market pricing tool.',
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
