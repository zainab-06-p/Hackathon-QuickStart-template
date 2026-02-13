/**
 * Decentralized Contract Registry
 * 
 * HYBRID CROSS-DEVICE APPROACH:
 * 1. Store newly created contracts in localStorage (immediate visibility)
 * 2. Query Algorand Indexer to discover contracts from other devices
 * 3. Merge both sources with 5-second cache
 * 
 * This provides:
 * - Instant visibility of locally created contracts
 * - Cross-device discovery via blockchain indexer
 * - Efficient caching to reduce API calls
 * 
 * ⚠️ CRITICAL: WALLET ADDRESS & DATA VISIBILITY
 * ==============================================
 * PUBLIC MARKETPLACE MODEL:
 * - getFundraisers() WITHOUT creatorAddress → Returns ALL campaigns from ALL creators
 * - getTicketing() WITHOUT creatorAddress → Returns ALL events from ALL creators
 * - Everyone sees the same content regardless of wallet address
 * 
 * CREATOR DASHBOARD MODEL (optional):
 * - getFundraisers(false, myAddress) → Returns ONLY my campaigns (use on dashboard only)
 * - getTicketing(false, myAddress) → Returns ONLY my events (use on dashboard only)
 * 
 * DEFAULT BEHAVIOR: Show everything to everyone (marketplace)
 * ONLY filter by creator on explicit creator dashboard pages
 */

import algosdk from 'algosdk'
import { getIndexerConfigFromViteEnvironment } from './network/getAlgoClientConfigs'

const FUNDRAISER_LOCAL_KEY = 'campuschain_fundraiser_local_v3'
const TICKETING_LOCAL_KEY = 'campuschain_ticketing_local_v3'
const FUNDRAISER_CACHE_KEY = 'campuschain_fundraiser_cache_v3'
const TICKETING_CACHE_KEY = 'campuschain_ticketing_cache_v3'
const CACHE_DURATION = 2 * 1000 // 2 seconds for faster cross-device sync

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
  private static decodeBase64(data: string | Uint8Array): string {
    try {
      if (typeof data === 'string') {
        return atob(data)
      }
      // Convert Uint8Array to string
      return new TextDecoder().decode(data)
    } catch {
      return String(data)
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
  // ⚠️ DEFAULT: Shows ALL campaigns from ALL creators (public marketplace)
  // Pass creatorAddress ONLY for creator dashboard pages
  static async getFundraisers(forceRefresh = false, creatorAddress?: string): Promise<ContractMetadata[]> {
    // Get locally stored contracts (immediate)
    const localStored = localStorage.getItem(FUNDRAISER_LOCAL_KEY)
    const localContracts: ContractMetadata[] = localStored ? JSON.parse(localStored) : []
    
    // Check cache first for indexer results (unless force refresh)
    if (!forceRefresh) {
      const cached = this.getCache(FUNDRAISER_CACHE_KEY)
      if (cached) {
        const total = this.mergeUnique(localContracts, cached)
        console.log(`📦 Cached: ${localContracts.length} local + ${cached.length} indexer = ${total.length} total fundraisers`)
        return total
      }
    } else {
      console.log('🔄 Force refresh - clearing cache')
      localStorage.removeItem(FUNDRAISER_CACHE_KEY)
    }

    console.log('🔍 Discovering ALL fundraiser contracts from blockchain indexer...')
    
    try {
      const indexer = this.getIndexer()
      const indexerContracts: ContractMetadata[] = []
      
      // Strategy 1: Query by creator address if provided (optional optimization)
      if (creatorAddress) {
        console.log(`🔎 Querying contracts created by ${creatorAddress}`)
        try {
          const accountApps = await indexer.lookupAccountCreatedApplications(creatorAddress).do()
          console.log(`📱 Found ${accountApps.applications?.length || 0} applications created by this address`)
          
          for (const app of accountApps.applications || []) {
            if (!app.params || !app.params.globalState) continue
            
            const globalState = app.params.globalState
            const stateObj: any = {}
            for (const item of globalState) {
              const key = this.decodeBase64(item.key)
              stateObj[key] = item.value
            }
            
            const isFundraiser = 'goal_amount' in stateObj && 
                               'raised_amount' in stateObj && 
                               'milestone_count' in stateObj
            
            if (isFundraiser) {
              indexerContracts.push({
                appId: Number(app.id),
                creator: String(app.params.creator || ''),
                createdAt: Number(app.createdAtRound || 0),
              })
              console.log(`✅ Found fundraiser: App ID ${app.id} by ${creatorAddress}`)
            }
          }
        } catch (error) {
          console.warn('Failed to query by creator address, falling back to general search:', error)
        }
      }
      
      // Strategy 2: Scan ALL recent applications - INCREASED LIMIT for better discovery
      console.log('🔎 Scanning recent applications for ALL fundraisers...')
      const apps = await indexer.searchForApplications().limit(5000).do()
      console.log(`🔎 Indexer returned ${apps.applications?.length || 0} total applications`)
      
      for (const app of apps.applications) {
        if (!app.params || !app.params.globalState) continue
        
        // Skip if already found
        if (indexerContracts.some(c => c.appId === Number(app.id))) continue
        
        const globalState = app.params.globalState
        const stateObj: any = {}
        for (const item of globalState) {
          const key = this.decodeBase64(item.key)
          stateObj[key] = item.value
        }
        
        const isFundraiser = 'goal_amount' in stateObj && 
                           'raised_amount' in stateObj && 
                           'milestone_count' in stateObj
        
        if (isFundraiser) {
          indexerContracts.push({
            appId: Number(app.id),
            creator: String(app.params.creator || ''),
            createdAt: Number(app.createdAtRound || 0),
          })
          console.log(`✅ Found fundraiser: App ID ${app.id} (creator: ${String(app.params.creator).substring(0, 8)}...)`)
        }
      }
      
      console.log(`✅ Total discovered: ${localContracts.length} local + ${indexerContracts.length} indexer = ${this.mergeUnique(localContracts, indexerContracts).length} unique fundraisers`)
      
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
  // ⚠️ DEFAULT: Shows ALL events from ALL creators (public marketplace)
  // Pass creatorAddress ONLY for creator dashboard pages
  static async getTicketing(forceRefresh = false, creatorAddress?: string): Promise<ContractMetadata[]> {
    // Get locally stored contracts (immediate)
    const localStored = localStorage.getItem(TICKETING_LOCAL_KEY)
    const localContracts: ContractMetadata[] = localStored ? JSON.parse(localStored) : []
    
    // Check cache first for indexer results (unless force refresh)
    if (!forceRefresh) {
      const cached = this.getCache(TICKETING_CACHE_KEY)
      if (cached) {
        const total = this.mergeUnique(localContracts, cached)
        console.log(`📦 Cached: ${localContracts.length} local + ${cached.length} indexer = ${total.length} total events`)
        return total
      }
    } else {
      console.log('🔄 Force refresh - clearing cache')
      localStorage.removeItem(TICKETING_CACHE_KEY)
    }

    console.log('🔍 Discovering ALL ticketing contracts from blockchain indexer...')
    
    try {
      const indexer = this.getIndexer()
      const indexerContracts: ContractMetadata[] = []
      
      // Strategy 1: Query by creator address if provided (optional optimization)
      if (creatorAddress) {
        console.log(`🔎 Querying contracts created by ${creatorAddress}`)
        try {
          const accountApps = await indexer.lookupAccountCreatedApplications(creatorAddress).do()
          console.log(`📱 Found ${accountApps.applications?.length || 0} applications created by this address`)
          
          for (const app of accountApps.applications || []) {
            if (!app.params || !app.params.globalState) continue
            
            const globalState = app.params.globalState
            const stateObj: any = {}
            for (const item of globalState) {
              const key = this.decodeBase64(item.key)
              stateObj[key] = item.value
            }
            
            const isTicketing = 'ticket_price' in stateObj && 
                              'max_supply' in stateObj && 
                              'sold_count' in stateObj
            
            if (isTicketing) {
              indexerContracts.push({
                appId: Number(app.id),
                creator: String(app.params.creator || ''),
                createdAt: Number(app.createdAtRound || 0),
              })
              console.log(`✅ Found ticketing: App ID ${app.id} by ${creatorAddress}`)
            }
          }
        } catch (error) {
          console.warn('Failed to query by creator address, falling back to general search:', error)
        }
      }
      
      // Strategy 2: Scan ALL recent applications - INCREASED LIMIT for better discovery
      console.log('🔎 Scanning recent applications for ALL events...')
      const apps = await indexer.searchForApplications().limit(5000).do()
      console.log(`🔎 Indexer returned ${apps.applications?.length || 0} total applications`)
      
      for (const app of apps.applications) {
        if (!app.params || !app.params.globalState) continue
        
        // Skip if already found
        if (indexerContracts.some(c => c.appId === Number(app.id))) continue
        
        const globalState = app.params.globalState
        const stateObj: any = {}
        for (const item of globalState) {
          const key = this.decodeBase64(item.key)
          stateObj[key] = item.value
        }
        
        const isTicketing = 'ticket_price' in stateObj && 
                          'max_supply' in stateObj && 
                          'sold_count' in stateObj
        
        if (isTicketing) {
          indexerContracts.push({
            appId: Number(app.id),
            creator: String(app.params.creator || ''),
            createdAt: Number(app.createdAtRound || 0),
          })
          console.log(`✅ Found ticketing: App ID ${app.id} (creator: ${String(app.params.creator).substring(0, 8)}...)`)
        }
      }
      
      console.log(`✅ Total discovered: ${localContracts.length} local + ${indexerContracts.length} indexer = ${this.mergeUnique(localContracts, indexerContracts).length} unique events`)
      
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

  // ========================================================================
  // CONVENIENCE METHODS FOR EXPLICIT USE CASES
  // ========================================================================

  /**
   * Get ALL fundraisers from ALL creators (PUBLIC MARKETPLACE)
   * Use this for public pages where everyone should see everything
   * 
   * @param forceRefresh - Skip cache and fetch fresh data
   * @returns All fundraising campaigns from all wallet addresses
   */
  static async getAllFundraisers(forceRefresh = false): Promise<ContractMetadata[]> {
    // Explicitly pass undefined for creatorAddress to get ALL campaigns
    return this.getFundraisers(forceRefresh, undefined)
  }

  /**
   * Get ONLY fundraisers created by specific wallet (CREATOR DASHBOARD)
   * Use this ONLY for creator dashboard pages showing "My Campaigns"
   * 
   * @param creatorAddress - Wallet address of the creator
   * @param forceRefresh - Skip cache and fetch fresh data
   * @returns Only campaigns created by the specified wallet address
   */
  static async getMyFundraisers(creatorAddress: string, forceRefresh = false): Promise<ContractMetadata[]> {
    const allCampaigns = await this.getFundraisers(forceRefresh, creatorAddress)
    // Note: The method already optimizes by querying this creator first,
    // but still scans all contracts. We filter here for extra safety.
    return allCampaigns.filter(c => c.creator === creatorAddress)
  }

  /**
   * Get ALL events from ALL creators (PUBLIC MARKETPLACE)
   * Use this for public pages where everyone should see everything
   * 
   * @param forceRefresh - Skip cache and fetch fresh data
   * @returns All events from all wallet addresses
   */
  static async getAllEvents(forceRefresh = false): Promise<ContractMetadata[]> {
    // Explicitly pass undefined for creatorAddress to get ALL events
    return this.getTicketing(forceRefresh, undefined)
  }

  /**
   * Get ONLY events created by specific wallet (CREATOR DASHBOARD)
   * Use this ONLY for creator dashboard pages showing "My Events"
   * 
   * @param creatorAddress - Wallet address of the creator
   * @param forceRefresh - Skip cache and fetch fresh data
   * @returns Only events created by the specified wallet address
   */
  static async getMyEvents(creatorAddress: string, forceRefresh = false): Promise<ContractMetadata[]> {
    const allEvents = await this.getTicketing(forceRefresh, creatorAddress)
    // Note: The method already optimizes by querying this creator first,
    // but still scans all contracts. We filter here for extra safety.
    return allEvents.filter(e => e.creator === creatorAddress)
  }
}
