/**
 * Blockchain Data Fetchers
 * 
 * All data comes from on-chain sources:
 * - Smart contract global state
 * - Transaction history via indexer
 * - No centralized database
 * 
 * ⚠️ IMPORTANT: WALLET ADDRESS & DATA VISIBILITY
 * ===============================================
 * This application operates as a PUBLIC MARKETPLACE where:
 * ✅ ALL users can see ALL events and campaigns
 * ✅ Events/campaigns created by ANY wallet address are visible to EVERYONE
 * ✅ Students with different wallet addresses can browse and interact with ALL content
 * 
 * The functions in this file NEVER filter by connected wallet address.
 * They fetch data from ALL smart contracts on the blockchain.
 * 
 * For creator-specific views (dashboard), use the optional creatorAddress
 * parameter, but this is NOT used on public marketplace pages.
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { ContractMetadata } from './contractRegistry'

export interface CampaignState {
  appId: number
  creator: string
  title: string
  description: string
  goalAmount: bigint
  raisedAmount: bigint
  currentMilestone: bigint
  milestoneCount: bigint
  contributorCount: bigint
  deadline: bigint
  isActive: boolean
  imageUrl?: string
}

export interface EventState {
  appId: number
  organizer: string
  title: string
  description: string
  venue: string
  ticketPrice: bigint
  maxSupply: bigint
  soldCount: bigint
  eventDate: bigint
  saleEndDate: bigint  // When ticket sales stop (separate from event date)
  uniqueBuyers: bigint
  isSaleActive: boolean
  imageUrl?: string
}

export interface Contributor {
  address: string
  amount: bigint
  timestamp: number
}

export interface TicketPurchase {
  address: string
  ticketId: number
  timestamp: number
  amount: bigint
}

/**
 * Decode Uint8Array or base64 string to text (browser-compatible)
 */
function decodeBase64(data: Uint8Array | string): string {
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

/**
 * Fetch campaign state from smart contract
 */
export async function getCampaignState(
  algorand: AlgorandClient,
  metadata: ContractMetadata
): Promise<CampaignState | null> {
  try {
    // Query contract global state
    const appInfo = await algorand.client.algod.getApplicationByID(metadata.appId).do()
    const globalState = appInfo.params.globalState || []
    
    // Parse state (keys are base64 encoded)
    const state: any = {}
    for (const item of globalState) {
      const key = decodeBase64(item.key)
      // Properly handle uint values including 0 (falsy)
      if (item.value.uint !== undefined) {
        state[key] = item.value.uint
      } else if (item.value.bytes) {
        state[key] = item.value.bytes
      } else {
        state[key] = 0
      }
    }

    // Debug log to see actual state
    console.log(`📊 Campaign ${metadata.appId} state:`, {
      is_active: state.is_active,
      raised_amount: state.raised_amount,
      goal_amount: state.goal_amount
    })

    return {
      appId: metadata.appId,
      creator: metadata.creator,
      title: metadata.title || 'Untitled Campaign',
      description: metadata.description || '',
      goalAmount: BigInt(state.goal_amount || 0),
      raisedAmount: BigInt(state.raised_amount || 0),
      currentMilestone: BigInt(state.current_milestone || 0),
      milestoneCount: BigInt(state.milestone_count || 0),
      contributorCount: BigInt(state.contributor_count || 0),
      deadline: BigInt(state.deadline || 0),
      // Boolean check: 1 means active, 0 or undefined means inactive (handle BigInt with Number())
      isActive: Number(state.is_active) === 1,
      imageUrl: metadata.imageUrl
    }
  } catch (error) {
    console.error(`Error fetching campaign ${metadata.appId}:`, error)
    return null
  }
}

/**
 * Fetch event state from smart contract
 */
export async function getEventState(
  algorand: AlgorandClient,
  metadata: ContractMetadata
): Promise<EventState | null> {
  try {
    const appInfo = await algorand.client.algod.getApplicationByID(metadata.appId).do()
    const globalState = appInfo.params.globalState || []
    
    const state: any = {}
    for (const item of globalState) {
      const key = decodeBase64(item.key)
      // Properly handle uint values including 0 (falsy)
      if (item.value.uint !== undefined) {
        state[key] = item.value.uint
      } else if (item.value.bytes) {
        state[key] = item.value.bytes
      } else {
        state[key] = 0
      }
    }

    // Debug log to see actual state
    console.log(`🎫 Event ${metadata.appId} state:`, {
      is_sale_active: state.is_sale_active,
      sold_count: state.sold_count,
      max_supply: state.max_supply,
      sale_end_date: state.sale_end_date,
      event_date: state.event_date,
      current_timestamp: Math.floor(Date.now() / 1000)
    })

    return {
      appId: metadata.appId,
      organizer: metadata.creator,
      title: metadata.title || 'Untitled Event',
      description: metadata.description || '',
      venue: metadata.venue || 'TBA',
      ticketPrice: BigInt(state.ticket_price || 0),
      maxSupply: BigInt(state.max_supply || 0),
      soldCount: BigInt(state.sold_count || 0),
      eventDate: BigInt(state.event_date || 0),
      saleEndDate: BigInt(state.sale_end_date || 0),  // Read sale end date from state
      uniqueBuyers: BigInt(state.unique_buyers || 0),
      // Boolean check: 1 means active, 0 or undefined means inactive (handle both BigInt and Number)
      isSaleActive: Number(state.is_sale_active) === 1,
      imageUrl: metadata.imageUrl
    }
  } catch (error) {
    console.error(`Error fetching event ${metadata.appId}:`, error)
    return null
  }
}

/**
 * Fetch contributors from indexer transaction history
 */
export async function getCampaignContributors(
  algorand: AlgorandClient,
  appId: number
): Promise<Contributor[]> {
  try {
    // Query indexer for all payment transactions to this application
    const indexer = algorand.client.indexer
    
    // Get application info to find its address
    const appInfo = await algorand.client.algod.getApplicationByID(appId).do()
    const appAddress = appInfo.params['creator'] // This is the app creator, not app address
    
    // Query transactions with application-id filter
    const txns = await indexer
      .searchForTransactions()
      .applicationID(appId)
      .txType('appl')
      .do()

    // Parse contributors from payment transactions in group
    const contributors: Contributor[] = []
    for (const txn of txns.transactions || []) {
      if (txn.sender && txn.roundTime) {
        // Look for payment transaction in the group (atomic transfer)
        // In real implementation, parse the grouped payment amounts
        contributors.push({
          address: txn.sender,
          amount: BigInt(0), // Would need to parse from grouped payment
          timestamp: txn.roundTime
        })
      }
    }
    
    return contributors
  } catch (error) {
    console.error(`Error fetching contributors for app ${appId}:`, error)
    return []
  }
}

/**
 * Fetch ticket purchases from indexer
 */
export async function getTicketPurchases(
  algorand: AlgorandClient,
  appId: number
): Promise<TicketPurchase[]> {
  try {
    // Query indexer for all application call transactions
    const indexer = algorand.client.indexer
    
    const txns = await indexer
      .searchForTransactions()
      .applicationID(appId)
      .txType('appl')
      .do()

    // Parse ticket purchases from transactions
    const purchases: TicketPurchase[] = []
    let ticketCounter = 1
    
    for (const txn of txns.transactions || []) {
      // Check if this is a buy_ticket call
      if (txn.applicationTransaction?.applicationArgs?.[0]) {
        const methodName = decodeBase64(txn.applicationTransaction.applicationArgs[0])
        if (methodName.includes('buy_ticket') && txn.sender && txn.roundTime) {
          purchases.push({
            address: txn.sender,
            ticketId: ticketCounter++,
            timestamp: txn.roundTime,
            amount: BigInt(0) // Would need to parse from grouped payment
          })
        }
      }
    }
    
    return purchases
  } catch (error) {
    console.error(`Error fetching purchases for app ${appId}:`, error)
    return []
  }
}
