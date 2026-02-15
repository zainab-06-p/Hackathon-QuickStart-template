import { useState, useEffect } from 'react'
import { Card } from './Base/Card'
import {
  calculateYield,
  getCurrentAPR,
  getDaysElapsed,
  getDaysRemaining,
  estimateFinalYield,
  formatAlgo,
  formatPercent,
  enableYieldFarming,
} from '../utils/defiYield'
import type { YieldData } from '../utils/defiYield'
import { useSnackbar } from 'notistack'
import { TrendingUp, Sprout, Clock, Wallet, Loader2, Zap } from 'lucide-react'
import { BrandButton } from './Base/BrandButton'

interface YieldTrackerProps {
  campaignId: number
  currentAmount: number // Amount raised in ALGO (real from blockchain)
  goalAmount: number
  createdAt: Date
  durationDays?: number
  isCreator?: boolean
}

export const YieldTracker: React.FC<YieldTrackerProps> = ({
  campaignId,
  currentAmount,
  goalAmount,
  createdAt,
  durationDays = 30,
  isCreator = false,
}) => {
  const { enqueueSnackbar } = useSnackbar()
  const [yieldData, setYieldData] = useState<YieldData | null>(null)
  const [apr, setApr] = useState<number>(4.2)
  const [isLoading, setIsLoading] = useState(true)
  const [isYieldEnabled, setIsYieldEnabled] = useState(true) // Auto-enabled

  const daysElapsed = getDaysElapsed(createdAt)
  const daysRemaining = getDaysRemaining(createdAt, durationDays)
  const campaignProgress = goalAmount > 0 ? (currentAmount / goalAmount) * 100 : 0

  useEffect(() => {
    const fetchYieldData = async () => {
      setIsLoading(true)
      try {
        const currentApr = await getCurrentAPR('Folks Finance')
        setApr(currentApr)

        if (currentAmount > 0 && isYieldEnabled) {
          const yield_data = calculateYield(currentAmount, currentApr, daysElapsed)
          setYieldData(yield_data)
        }
      } catch (error) {
        console.error('Error fetching yield data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchYieldData()
    const interval = setInterval(fetchYieldData, 30000) // every 30 s
    return () => clearInterval(interval)
  }, [currentAmount, daysElapsed, isYieldEnabled])

  const handleEnableYield = async () => {
    try {
      const result = await enableYieldFarming(campaignId, currentAmount, 'Folks Finance')
      if (result.success) {
        setIsYieldEnabled(true)
        enqueueSnackbar(result.message, { variant: 'success' })
      }
    } catch {
      enqueueSnackbar('Failed to enable yield farming', { variant: 'error' })
    }
  }

  /* ── Loading state ──────────────────────────────── */
  if (isLoading) {
    return (
      <Card className="border-green-500/10">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
          <span className="text-zinc-400 text-sm">Loading DeFi yield data...</span>
        </div>
      </Card>
    )
  }

  /* ── Yield not enabled ─────────────────────────── */
  if (!isYieldEnabled) {
    return (
      <Card className="border-indigo-500/20 bg-indigo-500/5">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <Sprout className="w-5 h-5 text-green-400" /> Enable DeFi Yield
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              Earn {formatPercent(apr)} APR on locked funds via Folks Finance
            </p>
          </div>
          {isCreator && (
            <BrandButton size="sm" onClick={handleEnableYield} disabled={currentAmount === 0}>
              Enable
            </BrandButton>
          )}
        </div>
      </Card>
    )
  }

  /* ── No funds yet ──────────────────────────────── */
  if (!yieldData || currentAmount === 0) {
    return (
      <Card className="border-green-500/10 bg-green-500/5">
        <div className="flex items-start gap-3">
          <Sprout className="w-5 h-5 text-green-400 mt-0.5" />
          <p className="text-sm text-zinc-400">
            Once donations start, locked funds will automatically earn{' '}
            <span className="text-green-400 font-semibold">{formatPercent(apr)} APR</span> via Folks Finance
          </p>
        </div>
      </Card>
    )
  }

  /* ── Yield Data ────────────────────────────────── */
  const estimatedFinalYieldVal = estimateFinalYield(currentAmount, apr, daysRemaining)
  const totalEstimatedValue = currentAmount + yieldData.yieldEarned + estimatedFinalYieldVal

  return (
    <Card className="border-green-500/20">
      {/* Title */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            <Sprout className="w-5 h-5 text-green-400" /> DeFi Yield Generation
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/10 text-green-400 border border-green-500/20">
              LIVE
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Powered by {yieldData.protocol} &bull; {formatPercent(apr)} APR &bull; Real-time from campaign balance
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Days Locked</p>
          <p className="text-2xl font-bold text-green-400">{daysElapsed}</p>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800 text-center">
          <p className="text-xs text-zinc-500 mb-1">Principal</p>
          <p className="text-lg font-bold text-indigo-400">{formatAlgo(yieldData.principal)} <span className="text-xs font-normal text-zinc-500">ALGO</span></p>
        </div>
        <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800 text-center">
          <p className="text-xs text-zinc-500 mb-1">Yield Earned</p>
          <p className="text-lg font-bold text-green-400">+{formatAlgo(yieldData.yieldEarned)} <span className="text-xs font-normal text-zinc-500">ALGO</span></p>
        </div>
        <div className="p-3 bg-zinc-800/40 rounded-lg border border-zinc-800 text-center">
          <p className="text-xs text-zinc-500 mb-1">Current Value</p>
          <p className="text-lg font-bold text-purple-400">{formatAlgo(yieldData.currentValue)} <span className="text-xs font-normal text-zinc-500">ALGO</span></p>
        </div>
      </div>

      {/* Daily Yield Rate */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 p-4 rounded-lg mb-5">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-zinc-400">Daily Yield Rate</p>
            <p className="text-xl font-bold text-green-400">+{formatAlgo(yieldData.estimatedDailyYield)} ALGO/day</p>
          </div>
          <TrendingUp className="w-8 h-8 text-green-400/50" />
        </div>
      </div>

      {/* Projections */}
      <div className="space-y-2">
        <div className="flex justify-between items-center p-2.5 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
          <span className="text-sm text-zinc-400">Campaign Progress</span>
          <span className="text-sm text-white font-medium">{campaignProgress.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between items-center p-2.5 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
          <span className="text-sm text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Days Remaining</span>
          <span className="text-sm font-bold text-amber-400">{daysRemaining} days</span>
        </div>
        <div className="flex justify-between items-center p-2.5 bg-amber-500/5 rounded-lg border border-amber-500/10">
          <span className="text-sm text-zinc-400">Est. Final Yield</span>
          <span className="text-sm font-bold text-amber-400">+{formatAlgo(estimatedFinalYieldVal)} ALGO</span>
        </div>
        <div className="flex justify-between items-center p-2.5 bg-purple-500/5 rounded-lg border border-purple-500/10">
          <span className="text-sm text-zinc-400 font-medium">Total Est. Value</span>
          <span className="text-lg font-bold text-purple-400">{formatAlgo(totalEstimatedValue)} ALGO</span>
        </div>
      </div>

      {/* Info */}
      <div className="mt-5 p-3 bg-zinc-800/20 border border-zinc-800/50 rounded-lg">
        <p className="text-xs text-zinc-500 font-semibold mb-1 flex items-center gap-1">
          <Zap className="w-3 h-3 text-indigo-400" /> How it works
        </p>
        <ul className="text-xs text-zinc-500 space-y-1 list-disc list-inside">
          <li>Locked funds deposited into Folks Finance protocol</li>
          <li>Campaign <span className="text-green-400">succeeds</span>: Creator gets principal + yield</li>
          <li>Campaign <span className="text-red-400">fails</span>: Donors get refund + proportional yield share</li>
          <li>Zero risk — your funds are always yours</li>
        </ul>
      </div>
    </Card>
  )
}

export default YieldTracker
