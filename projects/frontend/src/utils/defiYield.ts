// DeFi Yield Generation Utilities for Locked Campaign Funds
// Integrates with Algorand DeFi protocols (Folks Finance, Algofi)

export interface YieldData {
  principal: number // Original amount in ALGO
  currentValue: number // Principal + accrued yield
  yieldEarned: number // Total yield earned
  apr: number // Annual Percentage Rate
  daysLocked: number
  estimatedDailyYield: number
  protocol: 'Folks Finance' | 'Algofi' | 'Tinyman Pool'
}

export interface CampaignYieldInfo {
  campaignId: number
  isYieldEnabled: boolean
  yieldData: YieldData | null
  lastUpdated: Date
}

/**
 * Simulates yield calculation for locked campaign funds
 * In production, this would integrate with actual DeFi protocols via smart contracts
 */
export function calculateYield(
  principal: number, 
  aprPercent: number, 
  daysLocked: number
): YieldData {
  const apr = aprPercent / 100
  const dailyRate = apr / 365
  const yieldEarned = principal * dailyRate * daysLocked
  const currentValue = principal + yieldEarned
  const estimatedDailyYield = principal * dailyRate

  return {
    principal,
    currentValue,
    yieldEarned,
    apr: aprPercent,
    daysLocked,
    estimatedDailyYield,
    protocol: 'Folks Finance' // Default protocol
  }
}

/**
 * Get real-time APR from DeFi protocols
 * In production, fetch from on-chain liquidity pools
 */
export async function getCurrentAPR(protocol: 'Folks Finance' | 'Algofi' | 'Tinyman Pool'): Promise<number> {
  // Simulated APRs - in production, fetch from smart contracts
  const aprs: Record<string, number> = {
    'Folks Finance': 4.2, // 4.2% APR for ALGO lending
    'Algofi': 3.8, // 3.8% APR
    'Tinyman Pool': 5.5 // 5.5% APR for LP tokens (higher risk)
  }
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  return aprs[protocol] || 4.0
}

/**
 * Calculate days until campaign goal deadline
 */
export function getDaysRemaining(createdAt: Date, durationDays: number = 30): number {
  const now = new Date()
  const endDate = new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(0, daysRemaining)
}

/**
 * Calculate days elapsed since campaign creation
 */
export function getDaysElapsed(createdAt: Date): number {
  const now = new Date()
  return Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * Estimate total yield by campaign end
 */
export function estimateFinalYield(
  currentAmount: number,
  apr: number,
  daysRemaining: number
): number {
  const dailyRate = (apr / 100) / 365
  return currentAmount * dailyRate * daysRemaining
}

/**
 * Format currency with proper decimals
 */
export function formatAlgo(amount: number): string {
  return amount.toFixed(4)
}

/**
 * Format percentage with 2 decimals
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

/**
 * Get yield status color based on performance
 */
export function getYieldStatusColor(yieldEarned: number, principal: number): string {
  const yieldPercent = (yieldEarned / principal) * 100
  if (yieldPercent >= 5) return 'text-green-600'
  if (yieldPercent >= 2) return 'text-blue-600'
  return 'text-gray-600'
}

/**
 * Mock function to enable yield farming for a campaign
 * In production, this would call smart contract to deposit into DeFi protocol
 */
export async function enableYieldFarming(
  campaignId: number,
  amount: number,
  protocol: 'Folks Finance' | 'Algofi' | 'Tinyman Pool'
): Promise<{ success: boolean; message: string }> {
  console.log(`Enabling yield farming for campaign ${campaignId}`)
  console.log(`Depositing ${amount} ALGO into ${protocol}`)
  
  // Simulate blockchain transaction
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  return {
    success: true,
    message: `Successfully deposited ${formatAlgo(amount)} ALGO into ${protocol}. Earning ${await getCurrentAPR(protocol)}% APR.`
  }
}

/**
 * Mock function to withdraw funds + yield from DeFi protocol
 * Called when campaign succeeds or fails
 */
export async function withdrawWithYield(
  campaignId: number,
  yieldData: YieldData
): Promise<{ success: boolean; totalAmount: number; yieldEarned: number }> {
  console.log(`Withdrawing from DeFi protocol for campaign ${campaignId}`)
  
  // Simulate blockchain transaction
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  return {
    success: true,
    totalAmount: yieldData.currentValue,
    yieldEarned: yieldData.yieldEarned
  }
}

/**
 * Calculate refund with yield for failed campaigns
 * Donors get original donation + proportional yield share
 */
export function calculateDonorRefund(
  donationAmount: number,
  totalDonations: number,
  totalYield: number
): { refundAmount: number; yieldShare: number; total: number } {
  const donorPercentage = donationAmount / totalDonations
  const yieldShare = totalYield * donorPercentage
  const refundAmount = donationAmount
  const total = refundAmount + yieldShare
  
  return {
    refundAmount,
    yieldShare,
    total
  }
}
