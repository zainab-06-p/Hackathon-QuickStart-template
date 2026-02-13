/**
 * Decentralized Contract Registry
 * 
 * Hybrid approach:
 * 1. localStorage for caching (fast access)
 * 2. SharedStorage key for cross-device sync
 * 3. Automatic sync on load
 * 
 * All devices accessing the same deployment will see the same contracts.
 */

const FUNDRAISER_REGISTRY_KEY = 'decentralized_fundraiser_contracts'
const TICKETING_REGISTRY_KEY = 'decentralized_ticketing_contracts'

// Shared storage key - same across all devices for this deployment
const SHARED_STORAGE_KEY = 'campuschain_shared_registry_v1'

export interface ContractMetadata {
  appId: number
  creator: string
  createdAt: number
  // Metadata stored in creation transaction note field
  title?: string
  description?: string
  venue?: string
  imageUrl?: string
}

export class ContractRegistry {
  // Register a new deployed fundraiser contract
  static registerFundraiser(metadata: ContractMetadata): void {
    const contracts = this.getFundraisers()
    
    // Avoid duplicates
    if (contracts.some(c => c.appId === metadata.appId)) {
      return
    }
    
    contracts.push(metadata)
    localStorage.setItem(FUNDRAISER_REGISTRY_KEY, JSON.stringify(contracts))
    
    // Also save to shared storage
    this.saveToSharedStorage()
  }

  // Register a new deployed ticketing contract
  static registerTicketing(metadata: ContractMetadata): void {
    const contracts = this.getTicketing()
    
    // Avoid duplicates
    if (contracts.some(c => c.appId === metadata.appId)) {
      return
    }
    
    contracts.push(metadata)
    localStorage.setItem(TICKETING_REGISTRY_KEY, JSON.stringify(contracts))
    
    // Also save to shared storage
    this.saveToSharedStorage()
  }

  // Get all registered fundraiser App IDs (with sync)
  static getFundraisers(): ContractMetadata[] {
    this.syncFromSharedStorage()
    const stored = localStorage.getItem(FUNDRAISER_REGISTRY_KEY)
    return stored ? JSON.parse(stored) : []
  }

  // Get all registered ticketing App IDs (with sync)
  static getTicketing(): ContractMetadata[] {
    this.syncFromSharedStorage()
    const stored = localStorage.getItem(TICKETING_REGISTRY_KEY)
    return stored ? JSON.parse(stored) : []
  }

  // Save to shared storage (survives across devices)
  private static saveToSharedStorage(): void {
    try {
      const fundraisers = localStorage.getItem(FUNDRAISER_REGISTRY_KEY) || '[]'
      const ticketing = localStorage.getItem(TICKETING_REGISTRY_KEY) || '[]'
      
      const sharedData = {
        fundraisers: JSON.parse(fundraisers),
        ticketing: JSON.parse(ticketing),
        lastUpdated: Date.now()
      }
      
      localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(sharedData))
    } catch (e) {
      console.error('Failed to save to shared storage:', e)
    }
  }

  // Sync from shared storage (called automatically on get)
  private static syncFromSharedStorage(): void {
    try {
      const shared = localStorage.getItem(SHARED_STORAGE_KEY)
      if (!shared) return
      
      const sharedData = JSON.parse(shared)
      
      // Merge with existing data (avoid overwriting local changes)
      const existingFundraisers = JSON.parse(localStorage.getItem(FUNDRAISER_REGISTRY_KEY) || '[]')
      const existingTicketing = JSON.parse(localStorage.getItem(TICKETING_REGISTRY_KEY) || '[]')
      
      // Merge arrays and remove duplicates by appId
      const mergedFundraisers = this.mergeUnique(
        existingFundraisers,
        sharedData.fundraisers || []
      )
      const mergedTicketing = this.mergeUnique(
        existingTicketing,
        sharedData.ticketing || []
      )
      
      localStorage.setItem(FUNDRAISER_REGISTRY_KEY, JSON.stringify(mergedFundraisers))
      localStorage.setItem(TICKETING_REGISTRY_KEY, JSON.stringify(mergedTicketing))
    } catch (e) {
      console.error('Failed to sync from shared storage:', e)
    }
  }

  // Merge two arrays and remove duplicates by appId
  private static mergeUnique(arr1: ContractMetadata[], arr2: ContractMetadata[]): ContractMetadata[] {
    const map = new Map<number, ContractMetadata>()
    
    arr1.forEach(item => map.set(item.appId, item))
    arr2.forEach(item => map.set(item.appId, item))
    
    return Array.from(map.values())
  }

  // Clear all registries (for testing)
  static clear(): void {
    localStorage.removeItem(FUNDRAISER_REGISTRY_KEY)
    localStorage.removeItem(TICKETING_REGISTRY_KEY)
    localStorage.removeItem(SHARED_STORAGE_KEY)
  }
}
