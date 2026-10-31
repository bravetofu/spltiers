/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd36mxiodymuqjm.cloudfront.net',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/images/cards/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/abilities/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/pricing', destination: '/deck-builder', permanent: true },
      { source: '/deck-cost', destination: '/deck-builder', permanent: true },
    ]
  },
}

module.exports = nextConfig
