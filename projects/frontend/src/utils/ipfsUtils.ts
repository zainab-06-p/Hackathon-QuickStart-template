/**
 * IPFS Media Loading Utilities
 * Handles IPFS URL conversion and provides fallback gateways
 */

export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
]

/**
 * Converts ipfs:// URLs to HTTP gateway URLs
 * @param url Original URL (http://, https://, or ipfs://)
 * @param gatewayIndex Which gateway to use (for fallback)
 */
export function convertIpfsToHttp(url: string, gatewayIndex: number = 0): string {
  if (!url) return ''

  // Already an HTTP URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // If it's already a gateway URL, return as-is
    if (url.includes('/ipfs/')) {
      return url
    }
    // Regular HTTP URL
    return url
  }

  // Convert ipfs:// protocol to gateway URL
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '')
    return `${IPFS_GATEWAYS[gatewayIndex]}${cid}`
  }

  // Assume it's a bare CID
  if (url.startsWith('Qm') || url.startsWith('bafy')) {
    return `${IPFS_GATEWAYS[gatewayIndex]}${url}`
  }

  // Return as-is if unrecognized format
  return url
}

/**
 * Try loading media from multiple IPFS gateways with fallback
 */
export async function loadMediaWithFallback(url: string): Promise<string> {
  // If not IPFS, return original
  if (!url.includes('ipfs')) {
    return url
  }

  // Try each gateway
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const gatewayUrl = convertIpfsToHttp(url, i)
    try {
      const response = await fetch(gatewayUrl, { method: 'HEAD', mode: 'no-cors' })
      // no-cors returns opaque response, so if we get here, assume success
      return gatewayUrl
    } catch (error) {
      console.warn(`❌ Gateway ${i} failed:`, IPFS_GATEWAYS[i])
      if (i === IPFS_GATEWAYS.length - 1) {
        // Last gateway failed, return the URL anyway (best effort)
        return gatewayUrl
      }
    }
  }

  return url
}

/**
 * Detect media type from URL
 */
export function getMediaType(url: string): 'image' | 'video' | 'unknown' {
  const imageExts = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i
  const videoExts = /\.(mp4|webm|mov|avi|mkv|m4v)$/i

  if (imageExts.test(url)) return 'image'
  if (videoExts.test(url)) return 'video'
  return 'unknown'
}
