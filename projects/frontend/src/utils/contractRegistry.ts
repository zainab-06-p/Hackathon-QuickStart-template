/**
 * Decentralized Contract Registry
 * 
 * Stores deployed contract App IDs for discovery.
 * This is the ONLY centralized part (just for App ID tracking).
 * All actual data comes from blockchain queries.
 * 
 * In production, you could:
 * - Use indexer to discover contracts by creator address
 * - Use IPFS pinned list
 * - Use on-chain registry contract
 */

const FUNDRAISER_REGISTRY_KEY = 'decentralized_fundraiser_contracts'
const TICKETING_REGISTRY_KEY = 'decentralized_ticketing_contracts'

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
    contracts.push(metadata)
    localStorage.setItem(FUNDRAISER_REGISTRY_KEY, JSON.stringify(contracts))
  }

  // Register a new deployed ticketing contract
  static registerTicketing(metadata: ContractMetadata): void {
    const contracts = this.getTicketing()
    contracts.push(metadata)
    localStorage.setItem(TICKETING_REGISTRY_KEY, JSON.stringify(contracts))
  }

  // Get all registered fundraiser App IDs
  static getFundraisers(): ContractMetadata[] {
    const stored = localStorage.getItem(FUNDRAISER_REGISTRY_KEY)
    return stored ? JSON.parse(stored) : []
  }

  // Get all registered ticketing App IDs
  static getTicketing(): ContractMetadata[] {
    const stored = localStorage.getItem(TICKETING_REGISTRY_KEY)
    return stored ? JSON.parse(stored) : []
  }

  // Clear all registries (for testing)
  static clear(): void {
    localStorage.removeItem(FUNDRAISER_REGISTRY_KEY)
    localStorage.removeItem(TICKETING_REGISTRY_KEY)
  }
}
