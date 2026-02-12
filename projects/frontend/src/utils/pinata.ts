export interface PinataFileResult {
  IpfsHash: string
}

export interface PinataJsonResult {
  IpfsHash: string
}

export async function pinFileToIPFS(file: File): Promise<PinataFileResult> {
  const jwt = import.meta.env.VITE_PINATA_JWT
  if (!jwt) throw new Error('Missing VITE_PINATA_JWT')

  const form = new FormData()
  form.append('file', file)

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${jwt}`
    },
    body: form,
  })
  
  if (!res.ok) {
    const errorText = await res.text()
    console.error('Pinata error:', errorText)
    throw new Error(`Pinata file upload failed (${res.status}): ${errorText}`)
  }
  
  return (await res.json()) as PinataFileResult
}

export async function pinJSONToIPFS(json: unknown): Promise<PinataJsonResult> {
  const jwt = import.meta.env.VITE_PINATA_JWT
  if (!jwt) throw new Error('Missing VITE_PINATA_JWT')

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(json),
  })
  if (!res.ok) throw new Error(`Pinata JSON upload failed (${res.status})`)
  return (await res.json()) as PinataJsonResult
}

export function ipfsHttpUrl(cid: string): string {
  // Use Pinata's dedicated gateway (more reliable than ipfs.io which times out frequently)
  const gateway = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs'
  // Remove trailing slash if present and add /ipfs/ if not already in gateway
  const cleanGateway = gateway.replace(/\/$/, '')
  const ipfsPath = cleanGateway.includes('/ipfs') ? '' : '/ipfs'
  return `${cleanGateway}${ipfsPath}/${cid}`
}

