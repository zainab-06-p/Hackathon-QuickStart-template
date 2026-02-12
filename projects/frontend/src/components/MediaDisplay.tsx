import { useState, useEffect } from 'react'
import { convertIpfsToHttp, getMediaType, IPFS_GATEWAYS } from '../utils/ipfsUtils'

interface MediaDisplayProps {
  url: string
  alt: string
  className?: string
}

export function MediaDisplay({ url, alt, className = '' }: MediaDisplayProps) {
  const [currentUrl, setCurrentUrl] = useState('')
  const [gatewayIndex, setGatewayIndex] = useState(0)
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'unknown'>('unknown')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!url) {
      setError(true)
      setLoading(false)
      return
    }

    // Convert IPFS URLs to HTTP gateway URLs
    const httpUrl = convertIpfsToHttp(url, gatewayIndex)
    setCurrentUrl(httpUrl)
    setMediaType(getMediaType(url))
    setLoading(false)

    console.log('🖼️ Loading media:', {
      original: url,
      converted: httpUrl,
      gateway: IPFS_GATEWAYS[gatewayIndex],
      type: mediaType
    })
  }, [url, gatewayIndex])

  const handleError = () => {
    console.error(`❌ Media load failed (gateway ${gatewayIndex}):`, currentUrl)

    // Try next gateway automatically
    if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
      console.log(`🔄 Auto-trying next gateway (${gatewayIndex + 1}/${IPFS_GATEWAYS.length})...`)
      setGatewayIndex(gatewayIndex + 1)
      setError(false)
      setLoading(true)
    } else {
      console.error('❌ All gateways failed')
      setError(true)
      setLoading(false)
    }
  }

  const handleLoad = () => {
    console.log('✅ Media loaded successfully:', currentUrl)
    setError(false)
    setLoading(false)
  }

  if (!url) {
    return (
      <div className={`bg-gray-100 rounded-xl p-8 text-center ${className}`}>
        <div className="text-6xl mb-2">🖼️</div>
        <p className="text-gray-600 text-sm">No media provided</p>
      </div>
    )
  }

  // Always try to show the image/video, even if previous attempts failed
  // Browser will keep trying to load from different gateways
  return (
    <div className={`relative bg-gray-100 rounded-xl overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse z-10">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg"></span>
            <p className="text-xs mt-2 text-gray-600">Loading from IPFS gateway {gatewayIndex + 1}/{IPFS_GATEWAYS.length}...</p>
          </div>
        </div>
      )}

      {mediaType === 'image' ? (
        <img
          src={currentUrl}
          alt={alt}
          className="w-full max-h-96 object-contain"
          onError={handleError}
          onLoad={handleLoad}
          crossOrigin="anonymous"
        />
      ) : mediaType === 'video' ? (
        <video
          src={currentUrl}
          className="w-full max-h-96"
          controls
          onError={handleError}
          onLoadedData={handleLoad}
          crossOrigin="anonymous"
        />
      ) : (
        // Unknown type - try as image first (most IPFS content is images)
        <img
          src={currentUrl}
          alt={alt}
          className="w-full max-h-96 object-contain"
          onError={handleError}
          onLoad={handleLoad}
          crossOrigin="anonymous"
        />
      )}
    </div>
  )
}
