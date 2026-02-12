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

  if (!url || (error && gatewayIndex >= IPFS_GATEWAYS.length - 1)) {
    // All gateways failed - show compact error with current gateway attempt
    return (
      <div className={`bg-gray-100 rounded-xl overflow-hidden ${className}`}>
        {/* Show the image anyway - browser might load it eventually */}
        <div className="relative">
          {mediaType === 'image' ? (
            <img
              src={currentUrl}
              alt={alt}
              className="w-full max-h-96 object-contain opacity-30"
            />
          ) : mediaType === 'video' ? (
            <video
              src={currentUrl}
              className="w-full max-h-96 opacity-30"
              controls
            />
          ) : null}
          
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 text-white p-4">
            <div className="text-center">
              <div className="text-4xl mb-2">🖼️</div>
              <p className="text-sm font-bold mb-1">Loading from IPFS...</p>
              <p className="text-xs opacity-75">Gateway {gatewayIndex + 1}/{IPFS_GATEWAYS.length}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-gray-100 rounded-xl overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse">
          <span className="loading loading-spinner loading-lg"></span>
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
        <div className="p-4 text-center">
          <p className="text-sm text-gray-600 mb-2">Unknown media type</p>
          <p className="text-xs text-gray-500 break-all mb-2">{url}</p>
          <a 
            href={currentUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline"
          >
            Open in New Tab ↗️
          </a>
        </div>
      )}
    </div>
  )
}
