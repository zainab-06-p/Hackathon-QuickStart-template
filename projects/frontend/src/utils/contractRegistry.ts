/**
 * Decentralized Contract Registry
 * 
 * HYBRID CROSS-DEVICE APPROACH:
 * 1. Store newly created contracts in localStorage (immediate visibility)
 * 2. Query Algorand Indexer to discover contracts from other devices
 * 3. Merge both sources with 30-second cache
 * 
 * This provides:
 * - Instant visibility of locally created contracts
 * - Cross-device discovery via blockchain indexer
 * - Efficient caching to reduce API calls
 */

import algosdk from 'algosdk'
import { getIndexerConfigFromViteEnvironment } from './network/getAlgoClientConfigs'

const FUNDRAISER_LOCAL_KEY = 'campuschain_fundraiser_local_v3'
const TICKETING_LOCAL_KEY = 'campuschain_ticketing_local_v3'
const FUNDRAISER_CACHE_KEY = 'campuschain_fundraiser_cache_v3'
const TICKETING_CACHE_KEY = 'campuschain_ticketing_cache_v3'
const CACHE_DURATION = 30 * 1000 // 30 seconds

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

interface CachedData {
  contracts: ContractMetadata[]
  timestamp: number
}

export class ContractRegistry {
  private static indexerClient: algosdk.Indexer | null = null

  // Get or create indexer client
  private static getIndexer(): algosdk.Indexer {
    if (!this.indexerClient) {
      const config = getIndexerConfigFromViteEnvironment()
      this.indexerClient = new algosdk.Indexer(
        config.token as any || '',
        config.server,
        config.port as any || ''
      )
    }
    return this.indexerClient
  }

  // Decode base64 to string
  private static decodeBase64(data: string): string {
    try {
      return atob(data)
    } catch {
      return data
    }
  }

  // Register a new deployed fundraiser contract (stores locally for immediate visibility)
  static registerFundraiser(metadata: ContractMetadata): void {
    try {
      // Get existing local contracts
      const stored = localStorage.getItem(FUNDRAISER_LOCAL_KEY)
      const contracts: ContractMetadata[] = stored ? JSON.parse(stored) : []
      
      // Avoid duplicates
      if (!contracts.some(c => c.appId === metadata.appId)) {
        contracts.push(metadata)
        localStorage.setItem(FUNDRAISER_LOCAL_KEY, JSON.stringify(contracts))
        console.log(`✅ Fundraiser ${metadata.appId} stored locally`)
      }
      
      // Clear cache to trigger refresh with new contract
      localStorage.removeItem(FUNDRAISER_CACHE_KEY)
    } catch (error) {
      console.error('Failed to register fundraiser:', error)
    }
  }

  // Register a new deployed ticketing contract (stores locally for immediate visibility)
  static registerTicketing(metadata: ContractMetadata): void {
    try {
      // Get existing local contracts
      const stored = localStorage.getItem(TICKETING_LOCAL_KEY)
      const contracts: ContractMetadata[] = stored ? JSON.parse(stored) : []
      
      // Avoid duplicates
      if (!contracts.some(c => c.appId === metadata.appId)) {
        contracts.push(metadata)
        localStorage.setItem(TICKETING_LOCAL_KEY, JSON.stringify(contracts))
        console.log(`✅ Ticketing contract ${metadata.appId} stored locally`)
      }
      
      // Clear cache to trigger refresh with new contract
      localStorage.removeItem(TICKETING_CACHE_KEY)
    } catch (error) {
      console.error('Failed to register ticketing contract:', error)
    }
  }

  // Get all fundraiser contracts (merges local + indexer results with caching)
  static async getFundraisers(): Promise<ContractMetadata[]> {
    // Get locally stored contracts (immediate)
    const localStored = localStorage.getItem(FUNDRAISER_LOCAL_KEY)
    const localContracts: ContractMetadata[] = localStored ? JSON.parse(localStored) : []
    
    // Check cache first for indexer results
    const cached = this.getCache(FUNDRAISER_CACHE_KEY)
    if (cached) {
      console.log(`📦 Using cached data: ${localContracts.length} local + ${cached.length} indexer = ${this.mergeUnique(localContracts, cached).length} total`)
      return this.mergeUnique(localContracts, cached)
    }

    console.log('🔍 Discovering fundraiser contracts from blockchain indexer...')
    
    try {
      const indexer = this.getIndexer()
      
      // Search for all applications (limited to recent ones for performance)
      const apps = await indexer.searchForApplications().limit(1000).do()
      
      const indexerContracts: ContractMetadata[] = []
      
      for (const app of apps.applications) {
        if (!app.params || !app.params.globalState) continue
        
        // Check if this is a fundraiser contract by looking for specific keys
        const globalState = app.params.globalState
        const keys = globalState.map((item: any) => this.decodeBase64(item.key))
        
        // Fundraiser contracts have these specific keys
        const isFundraiser = keys.includes('goal_amount') && 
                           keys.includes('raised_amount') && 
                           keys.includes('milestone_count')
        
        if (isFundraiser) {
          indexerContracts.push({
            appId: Number(app.id),
            creator: String(app.params.creator || ''),
            createdAt: Number(app.createdAtRound || 0),
          })
        }
      }
      
      console.log(`✅ Discovered: ${localContracts.length} local + ${indexerContracts.length} indexer contracts`)
      
      // Cache the indexer results
      this.setCache(FUNDRAISER_CACHE_KEY, indexerContracts)
      
      // Merge and return unique contracts
      return this.mergeUnique(localContracts, indexerContracts)
    } catch (error) {
      console.error('❌ Indexer query failed, using local contracts only:', error)
      // Fallback to local contracts if indexer fails
      return localContracts
    }
  }

  // Get all ticketing contracts (merges local + indexer results with caching)
  static async getTicketing(): Promise<ContractMetadata[]> {
    // Get locally stored contracts (immediate)
    const localStored = localStorage.getItem(TICKETING_LOCAL_KEY)
    const localContracts: ContractMetadata[] = localStored ? JSON.parse(localStored) : []
    
    // Check cache first for indexer results
    const cached = this.getCache(TICKETING_CACHE_KEY)
    if (cached) {
      console.log(`📦 Using cached data: ${localContracts.length} local + ${cached.length} indexer = ${this.mergeUnique(localContracts, cached).length} total`)
      return this.mergeUnique(localContracts, cached)
    }

    console.log('🔍 Discovering ticketing contracts from blockchain indexer...')
    
    try {
      const indexer = this.getIndexer()
      
      // Search for all applications
      const apps = await indexer.searchForApplications().limit(1000).do()
      
      const indexerContracts: ContractMetadata[] = []
      
      for (const app of apps.applications) {
        if (!app.params || !app.params.globalState) continue
        
        // Check if this is a ticketing contract by looking for specific keys
        const globalState = app.params.globalState
        const keys = globalState.map((item: any) => this.decodeBase64(item.key))
        
        // Ticketing contracts have these specific keys
        const isTicketing = keys.includes('ticket_price') && 
                          keys.includes('max_supply') && 
                          keys.includes('sold_count')
        
        if (isTicketing) {
          indexerContracts.push({
            appId: Number(app.id),
            creator: String(app.params.creator || ''),
            createdAt: Number(app.createdAtRound || 0),
          })
        }
      }
      
      console.log(`✅ Discovered: ${localContracts.length} local + ${indexerContracts.length} indexer contracts`)
      
      // Cache the indexer results
      this.setCache(TICKETING_CACHE_KEY, indexerContracts)
      
      // Merge and return unique contracts
      return this.mergeUnique(localContracts, indexerContracts)
    } catch (error) {
      console.error('❌ Indexer query failed, using local contracts only:', error)
      // Fallback to local contracts if indexer fails
      return localContracts
    }
  }

  // Merge two arrays and remove duplicates by appId
  private static mergeUnique(arr1: ContractMetadata[], arr2: ContractMetadata[]): ContractMetadata[] {
    const map = new Map<number, ContractMetadata>()
    
    // Add all contracts, later ones overwrite earlier ones with same appId
    arr1.forEach(item => map.set(item.appId, item))
    arr2.forEach(item => map.set(item.appId, item))
    
    return Array.from(map.values())
  }

  // Get from cache if fresh
  private static getCache(key: string): ContractMetadata[] | null {
    try {
      const cached = localStorage.getItem(key)
      if (!cached) return null
      
      const data: CachedData = JSON.parse(cached)
      const age = Date.now() - data.timestamp
      
      if (age > CACHE_DURATION) {
        localStorage.removeItem(key)
        return null
      }
      
      return data.contracts
    } catch {
      return null
    }
  }

  // Save to cache
  private static setCache(key: string, contracts: ContractMetadata[]): void {
    try {
      const data: CachedData = {
        contracts,
        timestamp: Date.now()
      }
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to cache contracts:', error)
    }
  }

  // Clear all local storage and caches (force refresh on next load)
  static clear(): void {
    localStorage.removeItem(FUNDRAISER_LOCAL_KEY)
    localStorage.removeItem(TICKETING_LOCAL_KEY)
    localStorage.removeItem(FUNDRAISER_CACHE_KEY)
    localStorage.removeItem(TICKETING_CACHE_KEY)
    console.log('🗑️ All local storage and caches cleared')
  }
}
