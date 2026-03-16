/**
 * Shared server-side utility for fetching Runi floor price from OpenSea
 * and ETH/USD conversion from CoinGecko.
 *
 * Imported by both the /api/market proxy route (HTTP endpoint) and the
 * pricing server action (direct server-to-server call). The OPENSEA_API_KEY
 * env var is only ever read server-side — never exposed to the client.
 *
 * Both fetches use Next.js revalidate: 300 (5 minutes) since Runi floor
 * price changes less frequently than Splinterlands market prices.
 */

export type RuniFloorPrice = {
  floor_eth: number
  eth_usd: number
  floor_usd: number
}

export async function fetchRuniFloorPrice(): Promise<RuniFloorPrice | null> {
  const apiKey = process.env.OPENSEA_API_KEY
  if (!apiKey) {
    console.error('[runi] OPENSEA_API_KEY is not set — cannot fetch floor price')
    return null
  }

  try {
    const [openseaRes, cgRes] = await Promise.all([
      fetch('https://api.opensea.io/api/v2/collections/runi/stats', {
        headers: {
          'x-api-key': apiKey,
          'Accept-Encoding': 'gzip, deflate, br, zstd',
        },
        next: { revalidate: 300 },
      }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
        headers: { 'Accept-Encoding': 'gzip, deflate, br, zstd' },
        next: { revalidate: 300 },
      }),
    ])

    if (!openseaRes.ok) {
      console.error(`[runi] OpenSea API error: HTTP ${openseaRes.status} ${openseaRes.statusText}`)
      return null
    }
    if (!cgRes.ok) {
      console.error(`[runi] CoinGecko API error: HTTP ${cgRes.status} ${cgRes.statusText}`)
      return null
    }

    const openseaData = await openseaRes.json()
    const cgData = await cgRes.json()

    const floor_eth: unknown = openseaData?.total?.floor_price
    const eth_usd: unknown = cgData?.ethereum?.usd

    if (typeof floor_eth !== 'number' || typeof eth_usd !== 'number') {
      console.error('[runi] Unexpected API response shape:', { openseaData, cgData })
      return null
    }

    return { floor_eth, eth_usd, floor_usd: floor_eth * eth_usd }
  } catch (err) {
    console.error('[runi] Failed to fetch Runi floor price:', err)
    return null
  }
}
