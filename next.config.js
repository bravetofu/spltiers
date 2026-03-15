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
  async redirects() {
    return [
      { source: '/pricing',   destination: '/deck-builder', permanent: true },
      { source: '/deck-cost', destination: '/deck-builder', permanent: true },
    ]
  },
}

module.exports = nextConfig
