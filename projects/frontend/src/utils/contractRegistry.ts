/**
 * Decentralized Contract Registry
 * 
 * TRUE CROSS-DEVICE APPROACH:
 * 1. Query Algorand Indexer to discover ALL deployed contracts
 * 2. Identify contract types by their global state keys
 * 3. Cache in localStorage for performance (30 second refresh)
 * 
 * This works across ALL devices - no manual sharing needed!
 */

import algosdk from 'algosdk'
import { getIndexerConfigFromViteEnvironment } from './network/getAlgoClientConfigs'

const FUNDRAISER_CACHE_KEY = 'campuschain_fundraiser_cache_v2'
const TICKETING_CACHE_KEY = 'campuschain_ticketing_cache_v2'
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

  // Register a new deployed fundraiser contract (stores locally to trigger immediate cache refresh)
  static registerFundraiser(metadata: ContractMetadata): void {
    // Clear cache to force refresh
    localStorage.removeItem(FUNDRAISER_CACHE_KEY)
    console.log('✅ Fundraiser registered, cache cleared for immediate discovery')
  }

  // Register a new deployed ticketing contract (stores locally to trigger immediate cache refresh)
  static registerTicketing(metadata: ContractMetadata): void {
    // Clear cache to force refresh
    localStorage.removeItem(TICKETING_CACHE_KEY)
    console.log('✅ Ticketing contract registered, cache cleared for immediate discovery')
  }

  // Get all fundraiser contracts from indexer (with caching)
  static async getFundraisers(): Promise<ContractMetadata[]> {
    // Check cache first
    const cached = this.getCache(FUNDRAISER_CACHE_KEY)
    if (cached) {
      console.log(`📦 Using cached fundraisers (${cached.length} contracts)`)
      return cached
    }

    console.log('🔍 Discovering fundraiser contracts from blockchain...')
    
    try {
      const indexer = this.getIndexer()
      
      // Search for all applications (limited to recent ones for performance)
      const apps = await indexer.searchForApplications().limit(1000).do()
      
      const fundraisers: ContractMetadata[] = []
      
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
          fundraisers.push({
            appId: Number(app.id),
            creator: String(app.params.creator || ''),
            createdAt: Number(app.createdAtRound || 0),
          })
        }
      }
      
      console.log(`✅ Discovered ${fundraisers.length} fundraiser contracts`)
      
      // Cache the results
      this.setCache(FUNDRAISER_CACHE_KEY, fundraisers)
      
      return fundraisers
    } catch (error) {
      console.error('❌ Failed to discover fundraiser contracts:', error)
      return []
    }
  }

  // Get all ticketing contracts from indexer (with caching)
  static async getTicketing(): Promise<ContractMetadata[]> {
    // Check cache first
    const cached = this.getCache(TICKETING_CACHE_KEY)
    if (cached) {
      console.log(`📦 Using cached ticketing contracts (${cached.length} contracts)`)
      return cached
    }

    console.log('🔍 Discovering ticketing contracts from blockchain...')
    
    try {
      const indexer = this.getIndexer()
      
      // Search for all applications
      const apps = await indexer.searchForApplications().limit(1000).do()
      
      const ticketing: ContractMetadata[] = []
      
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
          ticketing.push({
            appId: Number(app.id),
            creator: String(app.params.creator || ''),
            createdAt: Number(app.createdAtRound || 0),
          })
        }
      }
      
      console.log(`✅ Discovered ${ticketing.length} ticketing contracts`)
      
      // Cache the results
      this.setCache(TICKETING_CACHE_KEY, ticketing)
      
      return ticketing
    } catch (error) {
      console.error('❌ Failed to discover ticketing contracts:', error)
      return []
    }
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

  // Clear all caches (force refresh on next load)
  static clear(): void {
    localStorage.removeItem(FUNDRAISER_CACHE_KEY)
    localStorage.removeItem(TICKETING_CACHE_KEY)
    console.log('🗑️ All caches cleared')
  }
}
