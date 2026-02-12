import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface UserReputation {
  address: string
  score: number // 0-1000
  trustLevel: 'New' | 'Building' | 'Trusted' | 'Verified' | 'Elite'
  metrics: {
    campaignsCreated: number
    campaignsCompleted: number
    successRate: number // percentage
    totalFundedAmount: number
    averageDeliveryTime: number // days
    disputes: number
    positiveReviews: number
  }
  badges: string[]
  predictions: {
    campaignSuccessChance: number
    estimatedCompletionTime: number
    riskLevel: 'Low' | 'Medium' | 'High'
  }
}

interface DAOProposal {
  id: number
  title: string
  description: string
  proposer: string
  votesFor: number
  votesAgainst: number
  status: 'Active' | 'Passed' | 'Rejected'
  endsAt: Date
}

const ReputationDAOPage = () => {
  const navigate = useNavigate()
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  // Mock user reputation - in real app, fetch from blockchain + ML model
  const [userRep] = useState<UserReputation>({
    address: activeAddress || '',
    score: 811,
    trustLevel: 'Verified',
    metrics: {
      campaignsCreated: 8,
      campaignsCompleted: 7,
      successRate: 87.5,
      totalFundedAmount: 125000,
      averageDeliveryTime: 12,
      disputes: 0,
      positiveReviews: 42
    },
    badges: ['🎯 Goal Crusher', '⚡ Fast Finisher', '💎 Diamond Creator', '🏆 Community Hero'],
    predictions: {
      campaignSuccessChance: 92,
      estimatedCompletionTime: 10,
      riskLevel: 'Low'
    }
  })

  const [proposals] = useState<DAOProposal[]>([
    {
      id: 1,
      title: 'Lower Minimum Trust Score for Event Creation',
      description: 'Reduce minimum trust score from 500 to 300 to allow more new creators',
      proposer: 'ALGO...XYZ',
      votesFor: 1247,
      votesAgainst: 523,
      status: 'Active',
      endsAt: new Date(Date.now() + 172800000)
    },
    {
      id: 2,
      title: 'Increase Rewards for High-Reputation Organizers',
      description: 'Provide 2% platform fee discount for creators with 800+ trust score',
      proposer: 'ALGO...ABC',
      votesFor: 2134,
      votesAgainst: 891,
      status: 'Active',
      endsAt: new Date(Date.now() + 259200000)
    }
  ])

  const getTrustColor = (score: number) => {
    if (score >= 850) return 'from-purple-600 to-pink-600'
    if (score >= 700) return 'from-blue-600 to-cyan-600'
    if (score >= 500) return 'from-green-600 to-teal-600'
    if (score >= 300) return 'from-yellow-600 to-orange-600'
    return 'from-gray-600 to-gray-400'
  }

  const getTrustBadgeIcon = (level: string) => {
    switch (level) {
      case 'Elite': return '👑'
      case 'Verified': return '✅'
      case 'Trusted': return '🛡️'
      case 'Building': return '📈'
      default: return '🌱'
    }
  }

  const formatAddress = (addr: string) => {
    return addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : ''
  }

  const formatTimeRemaining = (endsAt: Date) => {
    const hours = Math.floor((endsAt.getTime() - Date.now()) / 3600000)
    return `${Math.floor(hours / 24)}d ${hours % 24}h`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 animate-gradient-shift">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg border-b-4 border-gradient-to-r from-blue-500 to-purple-500">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              <button 
                onClick={() => navigate('/')} 
                className="btn btn-ghost btn-xs sm:btn-sm"
              >
                ← Back
              </button>
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                🏛️ Reputation DAO
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="badge badge-warning badge-xs sm:badge-sm animate-pulse">DEMO</div>
              <div className="badge badge-info badge-xs sm:badge-sm hidden sm:inline-flex">ML-Powered</div>
              {activeAddress && (
                <div className="badge badge-success badge-xs sm:badge-sm hidden md:inline-flex">{formatAddress(activeAddress)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Demo Mode Notice */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="alert alert-warning shadow-lg mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <h3 className="font-bold">🎭 Demonstration Mode - Mock Data</h3>
            <div className="text-sm">
              This page demonstrates the <strong>Reputation DAO</strong> concept with simulated data (811/1000 trust score, AI predictions, DAO voting). 
              In production, this would fetch REAL data from:
              <ul className="list-disc list-inside mt-1 ml-4">
                <li>On-chain DAO smart contracts for governance votes</li>
                <li>ML model analyzing transaction history for trust scores</li>
                <li>Indexer queries for campaign performance metrics</li>
              </ul>
              <p className="mt-2 font-semibold">✅ Campaign/Event pages use REAL LIVE blockchain data. This advanced feature is conceptual UI.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        {/* Info Banner */}
        <div className="alert bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-2xl mb-8">
          <div>
            <h3 className="font-bold text-xl">🤖 AI-Powered Trust Scoring System</h3>
            <p className="text-sm opacity-90 mt-1">
              Machine learning analyzes your on-chain history to predict campaign success. Higher reputation = more benefits!
            </p>
            <p className="text-xs opacity-75 mt-2">
              💡 Vote on DAO proposals to shape platform rules. Your reputation determines voting power.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trust Score Card */}
          <div className="lg:col-span-2">
            <div className="card bg-white shadow-2xl">
              <div className={`card-body bg-gradient-to-br ${getTrustColor(userRep.score)} text-white rounded-t-2xl`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="card-title text-3xl mb-2">Your Trust Score</h2>
                    <div className="badge badge-lg bg-white/20 border-white/30">
                      {getTrustBadgeIcon(userRep.trustLevel)} {userRep.trustLevel} Creator
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-6xl font-bold">{userRep.score}</div>
                    <div className="text-sm opacity-90">/1000</div>
                  </div>
                </div>

                <div className="mt-6">
                  <progress 
                    className="progress progress-accent w-full h-4 bg-white/30" 
                    value={userRep.score} 
                    max="1000"
                  />
                  <p className="text-sm opacity-90 mt-2">
                    {userRep.score < 1000 
                      ? `${1000 - userRep.score} points until Elite status`
                      : '🎉 Maximum trust achieved!'}
                  </p>
                </div>

                {/* ML Predictions */}
                <div className="mt-6 bg-white/20 rounded-xl p-6">
                  <h3 className="font-bold text-xl mb-4">🔮 AI Predictions</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold">{userRep.predictions.campaignSuccessChance}%</div>
                      <p className="text-xs opacity-75 mt-1">Success Rate</p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold">{userRep.predictions.estimatedCompletionTime}d</div>
                      <p className="text-xs opacity-75 mt-1">Est. Delivery</p>
                    </div>
                    <div className="text-center">
                      <div className={`badge badge-lg ${
                        userRep.predictions.riskLevel === 'Low' ? 'badge-success' :
                        userRep.predictions.riskLevel === 'Medium' ? 'badge-warning' :
                        'badge-error'
                      }`}>
                        {userRep.predictions.riskLevel} Risk
                      </div>
                      <p className="text-xs opacity-75 mt-1">Risk Level</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-body">
                <h3 className="font-bold text-xl mb-4">📊 Performance Metrics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Campaigns Created</p>
                    <p className="text-3xl font-bold text-blue-600">{userRep.metrics.campaignsCreated}</p>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-teal-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-3xl font-bold text-green-600">{userRep.metrics.campaignsCompleted}</p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Success Rate</p>
                    <p className="text-3xl font-bold text-purple-600">{userRep.metrics.successRate}%</p>
                  </div>
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Funded</p>
                    <p className="text-3xl font-bold text-orange-600">₹{(userRep.metrics.totalFundedAmount / 1000).toFixed(0)}K</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="stat bg-base-200 rounded-lg">
                    <div className="stat-title text-xs">Avg Delivery</div>
                    <div className="stat-value text-2xl">{userRep.metrics.averageDeliveryTime}d</div>
                  </div>
                  <div className="stat bg-base-200 rounded-lg">
                    <div className="stat-title text-xs">Disputes</div>
                    <div className="stat-value text-2xl text-success">{userRep.metrics.disputes}</div>
                  </div>
                  <div className="stat bg-base-200 rounded-lg">
                    <div className="stat-title text-xs">Reviews</div>
                    <div className="stat-value text-2xl text-info">{userRep.metrics.positiveReviews}</div>
                  </div>
                </div>

                <div className="divider">Earned Badges</div>
                <div className="flex flex-wrap gap-3">
                  {userRep.badges.map((badge, idx) => (
                    <div key={idx} className="badge badge-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 py-4">
                      {badge}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Benefits & Voting Power */}
          <div className="space-y-6">
            {/* Benefits Card */}
            <div className="card bg-white shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg">🎁 Your Benefits</h3>
                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-green-50 to-teal-50 p-3 rounded-lg">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="font-semibold text-sm">Pre-Approved Campaigns</p>
                      <p className="text-xs text-gray-600">No review needed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-cyan-50 p-3 rounded-lg">
                    <span className="text-2xl">💰</span>
                    <div>
                      <p className="font-semibold text-sm">Higher Funding Limit</p>
                      <p className="text-xs text-gray-600">Up to ₹5L per campaign</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg">
                    <span className="text-2xl">🔥</span>
                    <div>
                      <p className="font-semibold text-sm">Featured Placement</p>
                      <p className="text-xs text-gray-600">Top of homepage</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-red-50 p-3 rounded-lg">
                    <span className="text-2xl">🗳️</span>
                    <div>
                      <p className="font-semibold text-sm">DAO Voting Power</p>
                      <p className="text-xs text-gray-600">8.11 votes (1 vote per 100 score)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works */}
            <div className="card bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg">🤖 How ML Scoring Works</h3>
                <div className="space-y-3 mt-4 text-sm">
                  <div className="flex items-start gap-2">
                    <span>📈</span>
                    <p>AI analyzes 50+ on-chain metrics</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>🎯</span>
                    <p>Predicts campaign success probability</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>⚡</span>
                    <p>Real-time updates with each action</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>🛡️</span>
                    <p>Fraud detection & risk assessment</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>🔮</span>
                    <p>Personalized recommendations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DAO Governance Section */}
        <div className="card bg-white shadow-xl mt-8">
          <div className="card-body">
            <div className="flex justify-between items-center mb-6">
              <h3 className="card-title text-2xl">🗳️ Active DAO Proposals</h3>
              <button className="btn btn-primary btn-sm">
                Create Proposal
              </button>
            </div>

            <div className="space-y-4">
              {proposals.map((proposal) => (
                <div key={proposal.id} className="border-2 border-gray-200 rounded-xl p-6 hover:border-purple-400 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-lg">{proposal.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{proposal.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Proposed by {formatAddress(proposal.proposer)} • Ends in {formatTimeRemaining(proposal.endsAt)}
                      </p>
                    </div>
                    <div className={`badge badge-lg ${
                      proposal.status === 'Active' ? 'badge-info' :
                      proposal.status === 'Passed' ? 'badge-success' :
                      'badge-error'
                    }`}>
                      {proposal.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-green-600">👍 For</span>
                        <span>{proposal.votesFor}</span>
                      </div>
                      <progress 
                        className="progress progress-success w-full" 
                        value={proposal.votesFor} 
                        max={proposal.votesFor + proposal.votesAgainst}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-red-600">👎 Against</span>
                        <span>{proposal.votesAgainst}</span>
                      </div>
                      <progress 
                        className="progress progress-error w-full" 
                        value={proposal.votesAgainst} 
                        max={proposal.votesFor + proposal.votesAgainst}
                      />
                    </div>
                  </div>

                  {proposal.status === 'Active' && (
                    <div className="flex gap-3">
                      <button className="btn btn-success btn-sm flex-1">
                        Vote For (Use 8.11 votes)
                      </button>
                      <button className="btn btn-error btn-sm flex-1">
                        Vote Against
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReputationDAOPage
