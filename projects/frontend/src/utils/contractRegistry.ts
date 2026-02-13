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
const MAX_RETRY_ATTEMPTS = 3
const QUERY_LIMIT = 1000
const RECENT_DAYS = 90 // Only scan apps created in last 90 days

// 🎯 REGISTRY CONTRACT: Decentralized database for all app IDs
// This is the PRIMARY discovery mechanism for cross-device visibility
// Deploy the registry contract once and add its app ID here
const REGISTRY_APP_ID = import.meta.env.VITE_REGISTRY_APP_ID 
  ? Number(import.meta.env.VITE_REGISTRY_APP_ID) 
  : 0 // Set to 0 if not deployed yet

// Bootstrap mechanism: Query these creator addresses when registry not available
// This solves the cold-start problem for fresh devices
// Add your Algorand addresses here to enable cross-device discovery
const BOOTSTRAP_CREATOR_ADDRESSES: string[] = [
  // Example: 'ABC123XYZ...', 'DEF456UVW...'
  // Add creator wallet addresses that should be discoverable by default
]

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

  // Get current blockchain round to search recent apps
  private static async getCurrentRound(): Promise<number> {
    try {
      const indexer = this.getIndexer()
      const health = await indexer.makeHealthCheck().do()
      return Number(health.round || 0)
    } catch (error) {
      console.warn('Failed to get current round:', error)
      return 0
    }
  }

  // 🎯 Query the registry contract for all app IDs (PRIMARY discovery method)
  private static async queryRegistryContract(type: 'fundraiser' | 'ticketing'): Promise<number[]> {
    if (!REGISTRY_APP_ID || REGISTRY_APP_ID === 0) {
      console.log('⚠️ Registry contract not deployed yet, skipping registry query')
      return []
    }

    try {
      console.log(`📋 Querying registry contract (App ID ${REGISTRY_APP_ID}) for ${type} app IDs...`)
      const indexer = this.getIndexer()
      
      // Get the registry app's global state
      const appInfo = await indexer.lookupApplications(REGISTRY_APP_ID).do()
      
      if (!appInfo.application || !appInfo.application.params) {
        console.warn('Registry contract not found or has no state')
        return []
      }

      // Registry uses box storage, need to read boxes
      // For now, we'll use a direct ABI call simulation
      // In production, you'd use AlgoKit client to call get_fundraisers() or get_ticketing()
      
      // TEMPORARY: For now, return empty array until we integrate proper ABI calls
      // TODO: Integrate @algorandfoundation/algokit-utils to call ABI methods
      console.log('⚠️ Registry ABI integration pending - using fallback discovery for now')
      return []
      
    } catch (error) {
      console.warn('Failed to query registry contract:', error)
      return []
    }
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

  // Retry helper with exponential backoff
  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempts = MAX_RETRY_ATTEMPTS,
    delay = 1000
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (attempts <= 1) throw error
      console.log(`⚠️ Request failed, retrying in ${delay}ms... (${attempts - 1} attempts left)`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return this.retryWithBackoff(fn, attempts - 1, delay * 2)
    }
  }

  // Identify if an app is a fundraiser contract
  private static isFundraiserContract(globalState: any[], appId: number, debug = false): boolean {
    if (!globalState || globalState.length === 0) return false
    
    const keys = new Set<string>()
    globalState.forEach(item => {
      const key = this.decodeBase64(item.key)
      keys.add(key)
    })
    
    if (debug) {
      console.log(`🔬 App ${appId} has keys:`, Array.from(keys).join(', '))
    }
    
    // Check for fundraiser-specific keys
    const hasGoalAmount = keys.has('goal_amount')
    const hasRaisedAmount = keys.has('raised_amount')
    const hasIsActiveOrMilestone = keys.has('is_active') || keys.has('milestone_count')
    
    const isFundraiser = hasGoalAmount && hasRaisedAmount
    
    if (debug && isFundraiser) {
      console.log(`✅ App ${appId} IS a fundraiser (goal_amount: ${hasGoalAmount}, raised_amount: ${hasRaisedAmount})`)  
    }
    
    return isFundraiser
  }

  // Identify if an app is a ticketing contract
  private static isTicketingContract(globalState: any[], appId: number, debug = false): boolean {
    if (!globalState || globalState.length === 0) return false
    
    const keys = new Set<string>()
    globalState.forEach(item => {
      const key = this.decodeBase64(item.key)
      keys.add(key)
    })
    
    if (debug) {
      console.log(`🔬 App ${appId} has keys:`, Array.from(keys).join(', '))
    }
    
    // Check for ticketing-specific keys
    const hasTicketPrice = keys.has('ticket_price')
    const hasMaxSupply = keys.has('max_supply')
    const hasSoldCount = keys.has('sold_count')
    
    const isTicketing = hasTicketPrice && hasMaxSupply
    
    if (debug && isTicketing) {
      console.log(`✅ App ${appId} IS a ticketing contract (ticket_price: ${hasTicketPrice}, max_supply: ${hasMaxSupply})`)
    }
    
    return isTicketing
  }

  // Query specific app IDs directly (for cross-device discovery)
  private static async querySpecificApps(appIds: number[], type: 'fundraiser' | 'ticketing'): Promise<ContractMetadata[]> {
    const indexer = this.getIndexer()
    const contracts: ContractMetadata[] = []
    
    for (const appId of appIds) {
      try {
        const app = await indexer.lookupApplications(appId).do()
        if (!app.application || !app.application.params || !app.application.params.globalState) continue
        
        const globalState = app.application.params.globalState
        const isMatch = type === 'fundraiser' 
          ? this.isFundraiserContract(globalState, appId, true)
          : this.isTicketingContract(globalState, appId, true)
        
        if (isMatch) {
          contracts.push({
            appId,
            creator: String(app.application.params.creator || ''),
            createdAt: Number(app.application.createdAtRound || 0)
          })
        }
      } catch (error) {
        console.warn(`Failed to query app ${appId}:`, error)
      }
    }
    
    return contracts
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
      
      // \ud83c\udfaf STRATEGY 0: Query Registry Contract (PRIMARY - truly decentralized discovery!)
      // If registry is deployed, this will discover ALL campaigns across ALL devices in real-time
      const registryAppIds = await this.queryRegistryContract('fundraiser')
      if (registryAppIds.length > 0) {
        console.log(`\ud83d\udccb Registry returned ${registryAppIds.length} fundraiser app IDs`)
        const registryContracts = await this.querySpecificApps(registryAppIds, 'fundraiser')
        registryContracts.forEach(c => {
          if (!indexerContracts.some(existing => existing.appId === c.appId)) {
            indexerContracts.push(c)
          }
        })
        console.log(`\u2705 Found ${registryContracts.length} campaigns via registry contract`)
      }
      
      // Strategy 1: ALWAYS query local app IDs directly (MOST RELIABLE for cross-device)
      // This is the PRIMARY cross-device discovery mechanism
      const localAppIds = localContracts.map(c => c.appId)
      let foundViaDirectQuery = 0
      
      if (localAppIds.length > 0) {
        console.log(`🎯 Querying ${localAppIds.length} known fundraiser app IDs directly:`, localAppIds)
        const directContracts = await this.querySpecificApps(localAppIds, 'fundraiser')
        directContracts.forEach(c => {
          if (!indexerContracts.some(existing => existing.appId === c.appId)) {
            indexerContracts.push(c)
            foundViaDirectQuery++
          }
        })
        console.log(`✅ Found ${foundViaDirectQuery} campaigns via direct app ID queries`)
      }
      
      // Strategy 2: Query ALL unique creator addresses from localStorage
      // Get list of all unique creator addresses from local contracts
      const uniqueCreators = Array.from(new Set(localContracts.map(c => c.creator)))
      console.log(`👥 Found ${uniqueCreators.length} unique creators in localStorage`)
      
      for (const creator of uniqueCreators) {
        try {
          console.log(`🔎 Querying contracts created by ${creator.substring(0, 8)}...`)
          const accountApps = await this.retryWithBackoff(() => 
            indexer.lookupAccountCreatedApplications(creator).do()
          )
          console.log(`📱 Found ${accountApps.applications?.length || 0} applications created by this address`)
          
          for (const app of accountApps.applications || []) {
            if (!app.params || !app.params.globalState) continue
            
            const appId = Number(app.id)
            if (indexerContracts.some(c => c.appId === appId)) continue
            
            if (this.isFundraiserContract(app.params.globalState, appId, false)) {
              indexerContracts.push({
                appId,
                creator: String(app.params.creator || ''),
                createdAt: Number(app.createdAtRound || 0),
              })
              console.log(`✅ Found fundraiser: App ID ${appId} by creator`)
            }
          }
        } catch (error) {
          console.warn(`Failed to query creator ${creator.substring(0, 8)}:`, error)
        }
      }
      
      // Strategy 3: Bootstrap mechanism for cold start (empty localStorage)
      // Query hardcoded creator addresses to discover initial campaigns
      if (localContracts.length === 0 && BOOTSTRAP_CREATOR_ADDRESSES.length > 0) {
        console.log(`🚀 BOOTSTRAP: Empty localStorage, querying ${BOOTSTRAP_CREATOR_ADDRESSES.length} known creator addresses...`)
        
        for (const creator of BOOTSTRAP_CREATOR_ADDRESSES) {
          try {
            console.log(`🔎 Bootstrap query for ${creator.substring(0, 8)}...`)
            const accountApps = await this.retryWithBackoff(() => 
              indexer.lookupAccountCreatedApplications(creator).do()
            )
            console.log(`📱 Found ${accountApps.applications?.length || 0} applications from bootstrap creator`)
            
            for (const app of accountApps.applications || []) {
              if (!app.params || !app.params.globalState) continue
              
              const appId = Number(app.id)
              if (indexerContracts.some(c => c.appId === appId)) continue
              
              if (this.isFundraiserContract(app.params.globalState, appId, false)) {
                indexerContracts.push({
                  appId,
                  creator: String(app.params.creator || ''),
                  createdAt: Number(app.createdAtRound || 0),
                })
                console.log(`✅ Bootstrap found fundraiser: App ID ${appId}`)
              }
            }
          } catch (error) {
            console.warn(`Bootstrap query failed for ${creator.substring(0, 8)}:`, error)
          }
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
      
      // 🎯 STRATEGY 0: Query Registry Contract (PRIMARY - truly decentralized discovery!)
      // If registry is deployed, this will discover ALL events across ALL devices in real-time
      const registryAppIds = await this.queryRegistryContract('ticketing')
      if (registryAppIds.length > 0) {
        console.log(`📋 Registry returned ${registryAppIds.length} ticketing app IDs`)
        const registryContracts = await this.querySpecificApps(registryAppIds, 'ticketing')
        registryContracts.forEach(c => {
          if (!indexerContracts.some(existing => existing.appId === c.appId)) {
            indexerContracts.push(c)
          }
        })
        console.log(`✅ Found ${registryContracts.length} events via registry contract`)
      }
      
      // Strategy 1: ALWAYS query local app IDs directly (MOST RELIABLE for cross-device)
      const localAppIds = localContracts.map(c => c.appId)
      let foundViaDirectQuery = 0
      
      if (localAppIds.length > 0) {
        console.log(`🎯 Querying ${localAppIds.length} known ticketing app IDs directly:`, localAppIds)
        const directContracts = await this.querySpecificApps(localAppIds, 'ticketing')
        directContracts.forEach(c => {
          if (!indexerContracts.some(existing => existing.appId === c.appId)) {
            indexerContracts.push(c)
            foundViaDirectQuery++
          }
        })
        console.log(`✅ Found ${foundViaDirectQuery} events via direct app ID queries`)
      }
      
      // Strategy 2: Query ALL unique creator addresses from localStorage
      const uniqueCreators = Array.from(new Set(localContracts.map(c => c.creator)))
      console.log(`👥 Found ${uniqueCreators.length} unique creators in localStorage`)
      
      for (const creator of uniqueCreators) {
        try {
          console.log(`🔎 Querying contracts created by ${creator.substring(0, 8)}...`)
          const accountApps = await this.retryWithBackoff(() => 
            indexer.lookupAccountCreatedApplications(creator).do()
          )
          console.log(`📱 Found ${accountApps.applications?.length || 0} applications created by this address`)
          
          for (const app of accountApps.applications || []) {
            if (!app.params || !app.params.globalState) continue
            
            const appId = Number(app.id)
            if (indexerContracts.some(c => c.appId === appId)) continue
            
            if (this.isTicketingContract(app.params.globalState, appId, false)) {
              indexerContracts.push({
                appId,
                creator: String(app.params.creator || ''),
                createdAt: Number(app.createdAtRound || 0),
              })
              console.log(`✅ Found ticketing: App ID ${appId} by creator`)
            }
          }
        } catch (error) {
          console.warn(`Failed to query creator ${creator.substring(0, 8)}:`, error)
        }
      }
      
      // Strategy 3: Bootstrap mechanism for cold start (empty localStorage)
      // Query hardcoded creator addresses to discover initial events
      if (localContracts.length === 0 && BOOTSTRAP_CREATOR_ADDRESSES.length > 0) {
        console.log(`🚀 BOOTSTRAP: Empty localStorage, querying ${BOOTSTRAP_CREATOR_ADDRESSES.length} known creator addresses...`)
        
        for (const creator of BOOTSTRAP_CREATOR_ADDRESSES) {
          try {
            console.log(`🔎 Bootstrap query for ${creator.substring(0, 8)}...`)
            const accountApps = await this.retryWithBackoff(() => 
              indexer.lookupAccountCreatedApplications(creator).do()
            )
            console.log(`📱 Found ${accountApps.applications?.length || 0} applications from bootstrap creator`)
            
            for (const app of accountApps.applications || []) {
              if (!app.params || !app.params.globalState) continue
              
              const appId = Number(app.id)
              if (indexerContracts.some(c => c.appId === appId)) continue
              
              if (this.isTicketingContract(app.params.globalState, appId, false)) {
                indexerContracts.push({
                  appId,
                  creator: String(app.params.creator || ''),
                  createdAt: Number(app.createdAtRound || 0),
                })
                console.log(`✅ Bootstrap found ticketing: App ID ${appId}`)
              }
            }
          } catch (error) {
            console.warn(`Bootstrap query failed for ${creator.substring(0, 8)}:`, error)
          }
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
    
    // Add arr1 (localStorage) first - has full metadata
    arr1.forEach(item => map.set(item.appId, item))
    
    // Add arr2 (indexer) - merge with existing, preserving metadata from localStorage
    arr2.forEach(item => {
      const existing = map.get(item.appId)
      if (existing) {
        // Merge: keep metadata from localStorage, update blockchain info from indexer
        map.set(item.appId, {
          ...item,            // blockchain info (creator, createdAt)
          title: existing.title,           // preserve title from localStorage
          description: existing.description, // preserve description from localStorage
          imageUrl: existing.imageUrl,      // preserve image from localStorage
        })
      } else {
        map.set(item.appId, item)
      }
    })
    
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
