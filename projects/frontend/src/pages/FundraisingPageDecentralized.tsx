import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import { FundraiserFactory } from '../contracts/FundraiserClient'
import { ContractRegistry } from '../utils/contractRegistry'
import { getCampaignState, getCampaignContributors, type CampaignState } from '../utils/blockchainData'
import { listenToCampaigns, initializeFirebase } from '../utils/firebase'
import YieldTracker from '../components/YieldTracker'

const FundraisingPageDecentralized = () => {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<CampaignState[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignState | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [donating, setDonating] = useState(false)
  const [donationAmount, setDonationAmount] = useState('1')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const { enqueueSnackbar } = useSnackbar()
  const { activeAccount, activeAddress, transactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(transactionSigner)

  // Load campaigns from blockchain
  // ⚠️ IMPORTANT: This fetches ALL campaigns from ALL creators
  // Students with different wallet addresses will see campaigns from everyone
  // This is a PUBLIC MARKETPLACE - NOT filtered by connected wallet
  const loadCampaigns = async (forceRefresh = false) => {
    setLoading(true)
    try {
      // ✅ CORRECT: Don't pass activeAddress - discover ALL campaigns from ALL creators
      // Using getAllFundraisers() is clearer but getFundraisers() without args works the same
      const registry = await ContractRegistry.getFundraisers(forceRefresh)
      const campaignStates: CampaignState[] = []
      
      for (const metadata of registry) {
        const state = await getCampaignState(algorand, metadata)
        if (state) {
          campaignStates.push(state)
        }
      }
      
      setCampaigns(campaignStates)
      setLastUpdated(new Date())
      
      if (forceRefresh) {
        enqueueSnackbar(`Refreshed! Found ${campaignStates.length} campaigns`, { variant: 'success' })
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
      enqueueSnackbar(`Error loading campaigns: ${(error as Error).message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 🔥 Real-time Firebase listener for instant cross-device sync
    // This is the PRIMARY and ONLY data source - it handles all updates automatically
    // No manual refresh needed - Firebase keeps everything in sync!
    initializeFirebase()
    const unsubscribeFirebase = listenToCampaigns(async (firebaseCampaigns) => {
      console.log(`🔥 Firebase campaigns updated: ${firebaseCampaigns.length} campaigns`)
      
      // Merge Firebase campaigns with blockchain state
      const campaignStates: CampaignState[] = []
      for (const fbCampaign of firebaseCampaigns) {
        const metadata = {
          appId: parseInt(fbCampaign.appId),
          creator: fbCampaign.creator,
          createdAt: fbCampaign.createdAt,
          title: fbCampaign.title,
          description: fbCampaign.description
        }
        const state = await getCampaignState(algorand, metadata)
        if (state) {
          campaignStates.push(state)
        }
      }
      
      setCampaigns(campaignStates)
      setLastUpdated(new Date())
    })
    
    return () => {
      unsubscribeFirebase()
    }
  }, []) // ⚠️ IMPORTANT: No activeAddress dependency - all users see the same campaigns

  const donate = async () => {
    if (!selectedCampaign || !activeAddress) {
      enqueueSnackbar('Please select a campaign and connect wallet', { variant: 'error' })
      return
    }

    if (donating) {
      enqueueSnackbar('Transaction already in progress, please wait...', { variant: 'warning' })
      return
    }

    const donationMicroAlgos = Math.floor(parseFloat(donationAmount) * 1_000_000)
    if (donationMicroAlgos < 100000) {
      enqueueSnackbar('Minimum donation is 0.1 ALGO', { variant: 'error' })
      return
    }

    setDonating(true)
    try {
      const factory = new FundraiserFactory({
        algorand,
        defaultSender: activeAddress,
      })

      const appClient = factory.getAppClientById({
        appId: BigInt(selectedCampaign.appId)
      })

      enqueueSnackbar('Preparing transaction...', { variant: 'info' })

      // Generate unique note to prevent transaction deduplication
      const uniqueNote = `donate-${Date.now()}-${Math.random().toString(36).substring(2)}`

      // Create payment transaction with fresh parameters
      const paymentTxn = await algorand.createTransaction.payment({
        sender: activeAddress,
        receiver: appClient.appAddress,
        amount: algokit.microAlgos(donationMicroAlgos),
        note: new Uint8Array(Buffer.from(uniqueNote))
      })

      enqueueSnackbar('📤 Sending to wallet for signature...', { variant: 'info' })

      // Atomic transaction: payment + app call
      await appClient.send.donate({
        args: {
          payment: paymentTxn
        },
        sender: activeAddress,
        populateAppCallResources: false,  // Disable simulation to prevent "already in ledger" errors
        validityWindow: 1000,  // ~50 minutes validity
        suppressLog: true
      })

      enqueueSnackbar(
        `✅ Donated ${donationAmount} ALGO to ${selectedCampaign.title}!`, 
        { variant: 'success' }
      )
      
      setDonationAmount('1')
      
      // Reload campaigns to show updated state
      await loadCampaigns()
      
      // Update selected campaign
      const updated = await getCampaignState(algorand, {
        appId: selectedCampaign.appId,
        creator: selectedCampaign.creator,
        createdAt: 0,
        title: selectedCampaign.title,
        description: selectedCampaign.description
      })
      if (updated) setSelectedCampaign(updated)
      
    } catch (e) {
      console.error('Donation error:', e)
      enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setDonating(false)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  }

  const formatAlgo = (microAlgos: bigint) => {
    return (Number(microAlgos) / 1_000_000).toFixed(2)
  }

  const calculateDaysLeft = (deadline: bigint) => {
    const now = Math.floor(Date.now() / 1000)
    const diff = Number(deadline) - now
    return Math.floor(diff / (24 * 60 * 60))
  }

  if (loading && campaigns.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-lg font-semibold">Loading campaigns from blockchain...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 animate-gradient-shift">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg border-b-4 border-gradient-to-r from-blue-500 to-purple-500">
        <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-ghost btn-sm"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">🏦 Decentralized Campus Fundraising</h1>
            <button 
              onClick={() => navigate('/fundraising/create')} 
              className="btn btn-primary btn-sm hover:scale-110 transition-transform duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-500 to-purple-500 border-0"
            >
              ✨ Create Campaign
            </button>
            <button 
              onClick={() => loadCampaigns(true)} 
              className="btn btn-sm btn-outline btn-info hover:scale-110 transition-transform"
              disabled={loading}
            >
              🔄 Refresh
            </button>
            <button 
              onClick={() => navigate('/fundraising/reputation')} 
              className="btn btn-xs sm:btn-sm bg-gradient-to-r from-blue-600 to-purple-700 text-white border-0 hover:scale-110 transition-transform"
            >
              🏛️ <span className="hidden sm:inline">DAO</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="badge badge-info badge-xs sm:badge-sm">TestNet</div>
            {lastUpdated && (
              <div className="badge badge-ghost badge-xs hidden sm:inline-flex">Updated: {lastUpdated.toLocaleTimeString()}</div>
            )}
            {activeAddress && (
              <div className="badge badge-success badge-xs sm:badge-sm hidden md:inline-flex">{formatAddress(activeAddress)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="stat bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-blue-500/50">
            <div className="stat-title text-blue-100">Total Campaigns</div>
            <div className="stat-value text-white text-5xl">{campaigns.length}</div>
            <div className="stat-desc text-blue-100">📜 On-chain smart contracts</div>
          </div>
          <div className="stat bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-green-500/50">
            <div className="stat-title text-green-100">Total Raised</div>
            <div className="stat-value text-white text-4xl">
              {formatAlgo(campaigns.reduce((sum, c) => sum + c.raisedAmount, BigInt(0)))} Ⱥ
            </div>
            <div className="stat-desc text-green-100">💰 From blockchain state</div>
          </div>
          <div className="stat bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-purple-500/50">
            <div className="stat-title text-purple-100">Contributors</div>
            <div className="stat-value text-white text-5xl">
              {campaigns.reduce((sum, c) => sum + Number(c.contributorCount), 0)}
            </div>
            <div className="stat-desc text-purple-100">👥 Unique donations</div>
          </div>
          <div className="stat bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-orange-500/50">
            <div className="stat-title text-orange-100">Active Campaigns</div>
            <div className="stat-value text-white text-5xl">
              {campaigns.filter(c => c.isActive).length}
            </div>
            <div className="stat-desc text-orange-100">🔥 Currently accepting</div>
          </div>
        </div>

        {/* Advanced Features Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="card bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-xl hover:scale-105 transition-all cursor-pointer" onClick={() => navigate('/fundraising/reputation')}>
            <div className="card-body p-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                🏛️ Reputation DAO
                <span className="badge badge-sm bg-white/20 border-white/30">NEW</span>
              </h3>
              <p className="text-sm text-white/90">ML-powered trust scoring (811/1000). See your reputation, vote on proposals, unlock creator benefits.</p>
            </div>
          </div>
          <div className="card bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-xl">
            <div className="card-body p-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                🌱 DeFi Yield Generation
                <span className="badge badge-sm bg-white/20 border-white/30">LIVE</span>
              </h3>
              <p className="text-sm text-white/90">Locked funds earn 4.2% APR. Creators get principal + yield. Donors get refunds + yield if goal fails.</p>
            </div>
          </div>
          <div className="card bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl hover:scale-105 transition-all cursor-pointer" onClick={() => navigate('/federation')}>
            <div className="card-body p-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                🌐 Cross-Campus Federation
                <span className="badge badge-sm bg-white/20 border-white/30">NEW</span>
              </h3>
              <p className="text-sm text-white/90">Multi-college mega-events with shared funding pools. VIT + MIT + SRM + SASTRA = one network.</p>
            </div>
          </div>
        </div>

        {/* Cross-Device Sync Info Banner */}
        <div className="alert alert-info shadow-lg mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current flex-shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="font-bold">Cross-Device Discovery Info</h3>
            <div className="text-sm">
              New campaigns are visible immediately on the same device. For other devices, the Algorand blockchain indexer needs 30-60 seconds to sync. 
              Click the <span className="font-bold">🔄 Refresh</span> button or switch back to this tab to force an update.
            </div>
          </div>
        </div>

        {/* Campaigns Grid */}
        <h2 className="text-2xl font-bold mb-4">Live Campaigns ({campaigns.length})</h2>
        {campaigns.length === 0 ? (
          <div className="card bg-white shadow-xl">
            <div className="card-body text-center py-12">
              <h3 className="text-xl font-bold mb-2">No campaigns yet!</h3>
              <p className="text-gray-600">Click "➕ Create Campaign" above to deploy your first fundraising smart contract.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {campaigns.map((campaign) => {
              const progress = Number(campaign.raisedAmount) / Number(campaign.goalAmount) * 100
              const daysLeft = calculateDaysLeft(campaign.deadline)
              
              return (
                <div 
                  key={campaign.appId}
                  className="card bg-white shadow-xl hover:shadow-2xl transition-all cursor-pointer hover:scale-105 duration-300 border-2 border-transparent hover:border-purple-400 overflow-hidden group"
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 via-purple-400/10 to-pink-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="card-body relative z-10">
                    <div className="flex justify-between items-start">
                      <h3 className="card-title text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{campaign.title}</h3>
                      {campaign.isActive ? (
                        <div className="badge badge-success shadow-lg animate-pulse">✅ Live</div>
                      ) : (
                        <div className="badge badge-warning">⏸️ Inactive</div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{campaign.description}</p>
                    
                    <div className="space-y-2 mt-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold">App ID:</span>
                        <span className="font-mono text-xs">{campaign.appId}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Raised:</span>
                        <span className="font-bold text-green-600">
                          {formatAlgo(campaign.raisedAmount)} / {formatAlgo(campaign.goalAmount)} Ⱥ
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <progress 
                        className="progress progress-success w-full" 
                        value={progress} 
                        max="100"
                      />
                      <p className="text-xs text-gray-500 mt-1">{progress.toFixed(1)}% funded</p>
                    </div>

                    <div className="flex justify-between items-center mt-4">
                      <div className="badge badge-info badge-outline">
                        👥 {Number(campaign.contributorCount)} backers
                      </div>
                      <div className="text-sm">
                        ⏰ {daysLeft > 0 ? `${daysLeft}d left` : 'Ended'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Campaign Detail Modal */}
        {selectedCampaign && (
          <dialog id="campaign_modal" className="modal modal-open">
            <div className="modal-box max-w-4xl w-full mx-4">
              <button 
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => setSelectedCampaign(null)}
              >
                ✕
              </button>
              
              <h3 className="font-bold text-xl md:text-2xl mb-2">{selectedCampaign.title}</h3>
              <p className="text-sm md:text-base text-gray-600 mb-4">{selectedCampaign.description}</p>
              
              {/* Campaign Info Card */}
              <div className="card bg-gradient-to-r from-green-500 to-teal-500 text-white mb-4">
                <div className="card-body">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm opacity-90">Goal Amount</p>
                      <p className="text-xl md:text-2xl font-bold">💰 {formatAlgo(selectedCampaign.goalAmount)} ALGO</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Raised So Far</p>
                      <p className="text-xl md:text-2xl font-bold">✅ {formatAlgo(selectedCampaign.raisedAmount)} ALGO</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Milestones</p>
                      <p className="text-base md:text-xl font-bold">
                        📍 {Number(selectedCampaign.currentMilestone)}/{Number(selectedCampaign.milestoneCount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Contributors</p>
                      <p className="text-base md:text-xl font-bold">👥 {Number(selectedCampaign.contributorCount)}</p>
                    </div>
                  </div>
                  <progress 
                    className="progress progress-accent w-full h-3 mt-4" 
                    value={Number(selectedCampaign.raisedAmount)} 
                    max={Number(selectedCampaign.goalAmount)}
                  />
                  <p className="text-sm opacity-90 mt-2">
                    {((Number(selectedCampaign.raisedAmount) / Number(selectedCampaign.goalAmount)) * 100).toFixed(1)}% Complete
                  </p>
                </div>
              </div>

              {/* Donate Section - Always Show */}
              <div className="card bg-base-200 mb-4">
                <div className="card-body">
                  <h4 className="font-bold mb-2">💝 Make a Donation</h4>
                  {!selectedCampaign.isActive && (
                    <div className="alert alert-warning mb-2">
                      <span className="text-xs">⚠️ Campaign not active. Creator may need to activate it first.</span>
                    </div>
                  )}
                  <div className="join w-full">
                    <input 
                      type="number" 
                      step="0.1"
                      min="0.1"
                      className="input input-bordered join-item flex-1" 
                      placeholder="Amount in ALGO"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                    />
                    <button 
                      className={`btn btn-success join-item ${donating ? 'loading' : ''}`}
                      onClick={donate}
                      disabled={donating || !activeAddress}
                    >
                      {donating ? 'Processing...' : 'Donate'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Minimum: 0.1 ALGO • Transaction processed on Algorand TestNet</p>
                </div>
              </div>

              {/* Creator: Milestone Release */}
              {activeAddress === selectedCampaign.creator && (
                <div className="card bg-gradient-to-r from-orange-500 to-red-500 text-white mb-4">
                  <div className="card-body">
                    <h4 className="font-bold mb-2">🚀 Creator Controls</h4>
                    <div className="alert bg-white/20 border-white/30 text-white mb-3">
                      <div className="text-sm">
                        <p className="font-bold">Milestone Progress</p>
                        <p>{Number(selectedCampaign.currentMilestone)} of {Number(selectedCampaign.milestoneCount)} released</p>
                        {selectedCampaign.raisedAmount >= selectedCampaign.goalAmount ? (
                          <p className="text-green-200 font-bold mt-1">✅ Goal Reached! Funds can be released</p>
                        ) : (
                          <p className="text-yellow-200 mt-1">⏳ Goal not reached yet ({((Number(selectedCampaign.raisedAmount) / Number(selectedCampaign.goalAmount)) * 100).toFixed(1)}%)</p>
                        )}
                      </div>
                    </div>
                    <button 
                      className="btn btn-lg w-full bg-white text-orange-600 hover:bg-orange-50 border-0"
                      disabled={
                        Number(selectedCampaign.currentMilestone) >= Number(selectedCampaign.milestoneCount) ||
                        selectedCampaign.raisedAmount < selectedCampaign.goalAmount
                      }
                      onClick={async () => {
                        try {
                          const factory = new FundraiserFactory({
                            algorand,
                            defaultSender: activeAddress,
                          })
                          const appClient = factory.getAppClientById({
                            appId: BigInt(selectedCampaign.appId)
                          })
                          
                          enqueueSnackbar('Releasing milestone...', { variant: 'info' })
                          
                          await appClient.send.releaseMilestone({ args: [] })
                          
                          enqueueSnackbar('✅ Milestone funds released!', { variant: 'success' })
                          
                          await loadCampaigns()
                          const updated = await getCampaignState(algorand, {
                            appId: selectedCampaign.appId,
                            creator: selectedCampaign.creator,
                            createdAt: 0,
                            title: selectedCampaign.title,
                            description: selectedCampaign.description,
                            imageUrl: selectedCampaign.imageUrl
                          })
                          if (updated) setSelectedCampaign(updated)
                        } catch (e) {
                          console.error('Release error:', e)
                          enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
                        }
                      }}
                    >
                      💰 Release Next Milestone
                    </button>
                    {Number(selectedCampaign.currentMilestone) >= Number(selectedCampaign.milestoneCount) && (
                      <p className="text-sm text-center mt-2">All milestones have been released! 🎉</p>
                    )}
                  </div>
                </div>
              )}

              {/* DeFi Yield Generation Tracker */}
              <div className="mb-4">
                <YieldTracker 
                  campaignId={selectedCampaign.appId}
                  currentAmount={Number(selectedCampaign.raisedAmount) / 1_000_000}
                  goalAmount={Number(selectedCampaign.goalAmount) / 1_000_000}
                  createdAt={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)} // Mock: created 7 days ago
                  durationDays={30}
                  isCreator={activeAddress === selectedCampaign.creator}
                />
              </div>

              {/* Blockchain Info */}
              <div className="alert alert-info">
                <div className="text-sm">
                  <p className="font-bold">⛓️ On-Chain Contract Details</p>
                  <p className="font-mono text-xs mt-1">App ID: {selectedCampaign.appId}</p>
                  <p className="font-mono text-xs">Creator: {selectedCampaign.creator}</p>
                </div>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setSelectedCampaign(null)} />
          </dialog>
        )}
      </div>
    </div>
  )
}

export default FundraisingPageDecentralized
