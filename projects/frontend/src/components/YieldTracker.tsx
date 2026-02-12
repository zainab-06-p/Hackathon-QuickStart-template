import { useState, useEffect } from 'react'
import { 
  calculateYield, 
  getCurrentAPR, 
  getDaysElapsed, 
  getDaysRemaining,
  estimateFinalYield,
  formatAlgo,
  formatPercent,
  getYieldStatusColor,
  enableYieldFarming
} from '../utils/defiYield'
import type { YieldData } from '../utils/defiYield'
import { useSnackbar } from 'notistack'

interface YieldTrackerProps {
  campaignId: number
  currentAmount: number // Amount raised in ALGO
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
  isCreator = false
}) => {
  const { enqueueSnackbar } = useSnackbar()
  const [yieldData, setYieldData] = useState<YieldData | null>(null)
  const [apr, setApr] = useState<number>(4.2)
  const [isLoading, setIsLoading] = useState(true)
  const [isYieldEnabled, setIsYieldEnabled] = useState(true) // Auto-enabled
  
  const daysElapsed = getDaysElapsed(createdAt)
  const daysRemaining = getDaysRemaining(createdAt, durationDays)
  const campaignProgress = (currentAmount / goalAmount) * 100

  useEffect(() => {
    const fetchYieldData = async () => {
      setIsLoading(true)
      try {
        // Fetch current APR from protocol
        const currentApr = await getCurrentAPR('Folks Finance')
        setApr(currentApr)
        
        // Calculate yield if campaign has funds
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
    
    // Update every 30 seconds
    const interval = setInterval(fetchYieldData, 30000)
    return () => clearInterval(interval)
  }, [currentAmount, daysElapsed, isYieldEnabled])

  const handleEnableYield = async () => {
    try {
      const result = await enableYieldFarming(campaignId, currentAmount, 'Folks Finance')
      if (result.success) {
        setIsYieldEnabled(true)
        enqueueSnackbar(result.message, { variant: 'success' })
      }
    } catch (error) {
      enqueueSnackbar('Failed to enable yield farming', { variant: 'error' })
    }
  }

  if (isLoading) {
    return (
      <div className="card bg-gradient-to-r from-green-50 to-teal-50 shadow-lg">
        <div className="card-body">
          <div className="flex items-center gap-3">
            <span className="loading loading-spinner loading-md text-green-600"></span>
            <span className="text-gray-600">Loading DeFi yield data...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!isYieldEnabled) {
    return (
      <div className="card bg-gradient-to-r from-blue-50 to-cyan-50 shadow-lg">
        <div className="card-body">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg">💰 Enable DeFi Yield Generation</h3>
              <p className="text-sm text-gray-600 mt-1">
                Earn {formatPercent(apr)} APR on locked funds while campaign runs
              </p>
            </div>
            {isCreator && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleEnableYield}
                disabled={currentAmount === 0}
              >
                Enable Yield
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!yieldData || currentAmount === 0) {
    return (
      <div className="card bg-gradient-to-r from-gray-50 to-gray-100 shadow-lg">
        <div className="card-body">
          <p className="text-gray-600 text-sm">
            💡 Once donations start, locked funds will automatically earn {formatPercent(apr)} APR via Folks Finance
          </p>
        </div>
      </div>
    )
  }

  const estimatedFinalYield = estimateFinalYield(currentAmount, apr, daysRemaining)
  const totalEstimatedValue = currentAmount + yieldData.yieldEarned + estimatedFinalYield

  return (
    <div className="card bg-white shadow-xl border-2 border-green-200">
      <div className="card-body">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-xl text-green-700 flex items-center gap-2">
              🌱 DeFi Yield Generation
              <div className="badge badge-warning badge-sm" title="Uses simulated APR - would connect to real DeFi protocol">Demo</div>
              <div className="badge badge-success badge-sm">Live</div>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Powered by {yieldData.protocol} • {formatPercent(apr)} APR (simulated)
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Days Locked</p>
            <p className="text-2xl font-bold text-green-600">{daysElapsed}</p>
          </div>
        </div>

        {/* Main Yield Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-lg text-center">
            <p className="text-xs text-gray-600 mb-1">Principal</p>
            <p className="text-lg font-bold text-blue-600">{formatAlgo(yieldData.principal)} ALGO</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-teal-50 p-4 rounded-lg text-center">
            <p className="text-xs text-gray-600 mb-1">Yield Earned</p>
            <p className={`text-lg font-bold ${getYieldStatusColor(yieldData.yieldEarned, yieldData.principal)}`}>
              +{formatAlgo(yieldData.yieldEarned)} ALGO
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg text-center">
            <p className="text-xs text-gray-600 mb-1">Current Value</p>
            <p className="text-lg font-bold text-purple-600">{formatAlgo(yieldData.currentValue)} ALGO</p>
          </div>
        </div>

        {/* Daily Yield Rate */}
        <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-4 rounded-lg mb-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm opacity-90">Daily Yield Rate</p>
              <p className="text-2xl font-bold">+{formatAlgo(yieldData.estimatedDailyYield)} ALGO/day</p>
            </div>
            <div className="text-5xl">💸</div>
          </div>
        </div>

        {/* Projections */}
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-base-200 p-3 rounded-lg">
            <span className="text-sm font-semibold">Campaign Progress</span>
            <span className="text-sm">{campaignProgress.toFixed(1)}% of goal</span>
          </div>
          <div className="flex justify-between items-center bg-base-200 p-3 rounded-lg">
            <span className="text-sm font-semibold">Days Remaining</span>
            <span className="text-sm font-bold text-orange-600">{daysRemaining} days</span>
          </div>
          <div className="flex justify-between items-center bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg">
            <span className="text-sm font-semibold">Estimated Final Yield</span>
            <span className="text-sm font-bold text-orange-600">+{formatAlgo(estimatedFinalYield)} ALGO</span>
          </div>
          <div className="flex justify-between items-center bg-gradient-to-r from-purple-100 to-pink-100 p-3 rounded-lg">
            <span className="text-sm font-semibold">Total Estimated Value</span>
            <span className="text-lg font-bold text-purple-600">{formatAlgo(totalEstimatedValue)} ALGO</span>
          </div>
        </div>

        {/* Info Footer */}
        <div className="alert bg-blue-50 mt-4">
          <div className="text-xs text-gray-700">
            <p className="font-semibold mb-1">💡 How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Locked funds automatically deposited into Folks Finance</li>
              <li>If campaign <strong>succeeds</strong>: Creator gets principal + yield</li>
              <li>If campaign <strong>fails</strong>: Donors get refund + proportional yield share</li>
              <li>Zero risk - your money is always yours!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default YieldTracker
