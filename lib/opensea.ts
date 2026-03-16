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

  // ── OpenSea ────────────────────────────────────────────────────────────────
  let openseaRes: Response
  try {
    openseaRes = await fetch('https://api.opensea.io/api/v2/collections/runi/stats', {
      headers: {
        'x-api-key': apiKey,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
      },
      next: { revalidate: 300 },
    })
  } catch (err) {
    console.error('[runi] OpenSea network error:', err)
    return null
  }

  if (!openseaRes.ok) {
    let body = ''
    try { body = await openseaRes.text() } catch { /* ignore */ }
    console.error(
      `[runi] OpenSea API error: HTTP ${openseaRes.status} ${openseaRes.statusText}` +
      (body ? `\n  Response body: ${body.slice(0, 500)}` : ''),
    )
    return null
  }

  let openseaData: unknown
  try {
    openseaData = await openseaRes.json()
  } catch (err) {
    console.error('[runi] OpenSea returned non-JSON:', err)
    return null
  }

  console.log('[runi] OpenSea raw response:', JSON.stringify(openseaData)?.slice(0, 1000))

  const total = (openseaData as Record<string, unknown>)?.total as Record<string, unknown> | undefined
  const floor_eth: unknown = total?.floor_price
  const floor_symbol: unknown = total?.floor_price_symbol

  if (floor_eth === null || floor_eth === undefined) {
    console.error('[runi] OpenSea floor_price is missing or null — no active listings?', { total })
    return null
  }
  if (typeof floor_eth !== 'number') {
    console.error(`[runi] OpenSea floor_price has unexpected type "${typeof floor_eth}":`, floor_eth, '— full total:', total)
    return null
  }
  if (floor_symbol !== 'ETH') {
    console.error(`[runi] OpenSea floor_price_symbol is "${floor_symbol}" — expected "ETH", conversion may be wrong`)
    // fall through: still attempt conversion but log the discrepancy
  }

  // ── CoinGecko ──────────────────────────────────────────────────────────────
  let cgRes: Response
  try {
    cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      headers: { 'Accept-Encoding': 'gzip, deflate, br, zstd' },
      next: { revalidate: 300 },
    })
  } catch (err) {
    console.error('[runi] CoinGecko network error:', err)
    return null
  }

  if (!cgRes.ok) {
    let body = ''
    try { body = await cgRes.text() } catch { /* ignore */ }
    console.error(
      `[runi] CoinGecko API error: HTTP ${cgRes.status} ${cgRes.statusText}` +
      (body ? `\n  Response body: ${body.slice(0, 500)}` : ''),
    )
    return null
  }

  let cgData: unknown
  try {
    cgData = await cgRes.json()
  } catch (err) {
    console.error('[runi] CoinGecko returned non-JSON:', err)
    return null
  }

  const eth_usd: unknown = (cgData as Record<string, unknown>)?.ethereum
    ? ((cgData as Record<string, Record<string, unknown>>).ethereum?.usd)
    : undefined

  if (typeof eth_usd !== 'number') {
    console.error('[runi] CoinGecko unexpected response shape — expected { ethereum: { usd: number } }:', cgData)
    return null
  }

  const result = { floor_eth, eth_usd, floor_usd: floor_eth * eth_usd }
  console.log(`[runi] floor price: ${floor_eth} ETH × $${eth_usd.toFixed(0)}/ETH = $${result.floor_usd.toFixed(2)}`)
  return result
}
