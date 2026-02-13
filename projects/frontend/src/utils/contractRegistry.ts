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
      
      // Strategy 1: Query local fundraiser app IDs directly from other devices
      const localAppIds = localContracts.map(c => c.appId)
      if (localAppIds.length > 0) {
        console.log(`🎯 Querying ${localAppIds.length} known fundraiser app IDs directly:`, localAppIds)
        const directContracts = await this.querySpecificApps(localAppIds, 'fundraiser')
        directContracts.forEach(c => {
          if (!indexerContracts.some(existing => existing.appId === c.appId)) {
            indexerContracts.push(c)
          }
        })
      }
      
      // Strategy 2: Query by creator address if provided
      if (creatorAddress) {
        console.log(`🔎 Querying contracts created by ${creatorAddress}`)
        try {
          const accountApps = await this.retryWithBackoff(() => 
            indexer.lookupAccountCreatedApplications(creatorAddress).do()
          )
          console.log(`📱 Found ${accountApps.applications?.length || 0} applications created by this address`)
          
          for (const app of accountApps.applications || []) {
            if (!app.params || !app.params.globalState) continue
            
            if (this.isFundraiserContract(app.params.globalState, Number(app.id), false)) {
              if (!indexerContracts.some(c => c.appId === Number(app.id))) {
                indexerContracts.push({
                  appId: Number(app.id),
                  creator: String(app.params.creator || ''),
                  createdAt: Number(app.createdAtRound || 0),
                })
                console.log(`✅ Found fundraiser: App ID ${app.id} by ${creatorAddress}`)
              }
            }
          }
        } catch (error) {
          console.warn('Failed to query by creator address, falling back to general search:', error)
        }
      }
      
      // Strategy 3: Scan apps created in RECENT BLOCKCHAIN ROUNDS
      // CRITICAL FIX: Apps at ID 755M, can't scan all TestNet apps
      // Solution: Get current round, scan larger set, filter by recent creation
      const currentRound = await this.getCurrentRound()
      const searchFromRound = Math.max(0, currentRound - 100000) // Last ~100k rounds
      
      console.log(`🔎 Current round: ${currentRound}, will filter apps created after round ${searchFromRound}...`)
      
      // Scan more apps but filter by creation round
      const result: any = await this.retryWithBackoff(() => 
        indexer.searchForApplications()
          .limit(QUERY_LIMIT * 10) // 10k apps
          .do()
      )
      const apps = result.applications || []
      console.log(`🔎 Indexer returned ${apps.length} applications, filtering by recent rounds...`)
      
      let debugCount = 0
      let scannedCount = 0
      let recentCount = 0
      
      for (const app of apps) {
        scannedCount++
        
        if (!app.params || !app.params.globalState) continue
        
        const appId = Number(app.id)
        const createdAt = Number(app.createdAtRound || 0)
        
        // Skip if already found
        if (indexerContracts.some(c => c.appId === appId)) continue
        
        // CRITICAL: Filter by creation round to only check recent apps
        if (createdAt < searchFromRound) {
          continue // Skip old apps
        }
        
        recentCount++
        
        // Debug first 5 recent apps
        const shouldDebug = debugCount < 5 && !localAppIds.includes(appId)
        if (shouldDebug) {
          debugCount++
          console.log(`🔍 Checking app ${appId} (created at round ${createdAt})`)
        }
        
        if (this.isFundraiserContract(app.params.globalState, appId, shouldDebug)) {
          indexerContracts.push({
            appId,
            creator: String(app.params.creator || ''),
            createdAt,
          })
          console.log(`✅ Found fundraiser: App ID ${appId} (created round ${createdAt}, creator: ${String(app.params.creator).substring(0, 8)}...)`)
        }
      }
      
      console.log(`📊 Scanned ${scannedCount} total apps, ${recentCount} were recent, found ${indexerContracts.length} fundraisers`)
      
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
      
      // Strategy 1: Query local ticketing app IDs directly from other devices
      const localAppIds = localContracts.map(c => c.appId)
      if (localAppIds.length > 0) {
        console.log(`🎯 Querying ${localAppIds.length} known ticketing app IDs directly:`, localAppIds)
        const directContracts = await this.querySpecificApps(localAppIds, 'ticketing')
        directContracts.forEach(c => {
          if (!indexerContracts.some(existing => existing.appId === c.appId)) {
            indexerContracts.push(c)
          }
        })
      }
      
      // Strategy 2: Query by creator address if provided
      if (creatorAddress) {
        console.log(`🔎 Querying contracts created by ${creatorAddress}`)
        try {
          const accountApps = await this.retryWithBackoff(() => 
            indexer.lookupAccountCreatedApplications(creatorAddress).do()
          )
          console.log(`📱 Found ${accountApps.applications?.length || 0} applications created by this address`)
          
          for (const app of accountApps.applications || []) {
            if (!app.params || !app.params.globalState) continue
            
            if (this.isTicketingContract(app.params.globalState, Number(app.id), false)) {
              if (!indexerContracts.some(c => c.appId === Number(app.id))) {
                indexerContracts.push({
                  appId: Number(app.id),
                  creator: String(app.params.creator || ''),
                  createdAt: Number(app.createdAtRound || 0),
                })
                console.log(`✅ Found ticketing: App ID ${app.id} by ${creatorAddress}`)
              }
            }
          }
        } catch (error) {
          console.warn('Failed to query by creator address, falling back to general search:', error)
        }
      }
      
      // Strategy 3: Scan apps created in RECENT BLOCKCHAIN ROUNDS (Ticketing)
      // CRITICAL FIX: Apps at ID 755M, can't scan all TestNet apps
      // Solution: Get current round, scan larger set, filter by recent creation
      const currentRound = await this.getCurrentRound()
      const searchFromRound = Math.max(0, currentRound - 100000) // Last ~100k rounds
      
      console.log(`🔎 Current round: ${currentRound}, will filter apps created after round ${searchFromRound}...`)
      
      // Scan more apps but filter by creation round
      const result: any = await this.retryWithBackoff(() => 
        indexer.searchForApplications()
          .limit(QUERY_LIMIT * 10) // 10k apps
          .do()
      )
      const apps = result.applications || []
      console.log(`🔎 Indexer returned ${apps.length} applications, filtering by recent rounds...`)
      
      let debugCount = 0
      let scannedCount = 0
      let recentCount = 0
      
      for (const app of apps) {
        scannedCount++
        
        if (!app.params || !app.params.globalState) continue
        
        const appId = Number(app.id)
        const createdAt = Number(app.createdAtRound || 0)
        
        // Skip if already found
        if (indexerContracts.some(c => c.appId === appId)) continue
        
        // CRITICAL: Filter by creation round to only check recent apps
        if (createdAt < searchFromRound) {
          continue // Skip old apps
        }
        
        recentCount++
        
        // Debug first 5 recent apps
        const shouldDebug = debugCount < 5 && !localAppIds.includes(appId)
        if (shouldDebug) {
          debugCount++
          console.log(`🔍 Checking app ${appId} (created at round ${createdAt})`)
        }
        
        if (this.isTicketingContract(app.params.globalState, appId, shouldDebug)) {
          indexerContracts.push({
            appId,
            creator: String(app.params.creator || ''),
            createdAt,
          })
          console.log(`✅ Found ticketing: App ID ${appId} (created round ${createdAt}, creator: ${String(app.params.creator).substring(0, 8)}...)`)
        }
      }
      
      console.log(`📊 Scanned ${scannedCount} total apps, ${recentCount} were recent, found ${indexerContracts.length} events`)
      
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
