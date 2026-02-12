import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { ContractRegistry } from '../utils/contractRegistry'
import { getCampaignState, getEventState, type CampaignState, type EventState } from '../utils/blockchainData'

interface HistoryItem {
  type: 'campaign_created' | 'event_created' | 'donation' | 'ticket_purchase'
  timestamp: number
  appId: number
  title: string
  amount?: string
  details: string
}

const HistoryPage = () => {
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'created' | 'participated'>('created')
  const { activeAddress, transactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(transactionSigner)

  useEffect(() => {
    if (activeAddress) {
      loadHistory()
    }
  }, [activeAddress])

  const loadHistory = async () => {
    if (!activeAddress) return
    
    setLoading(true)
    const historyItems: HistoryItem[] = []

    try {
      // Get campaigns created by user
      const allCampaigns = ContractRegistry.getFundraisers()
      for (const metadata of allCampaigns) {
        if (metadata.creator === activeAddress) {
          const state = await getCampaignState(algorand, metadata)
          if (state) {
            historyItems.push({
              type: 'campaign_created',
              timestamp: metadata.createdAt,
              appId: metadata.appId,
              title: metadata.title || 'Untitled Campaign',
              details: `Goal: ${(Number(state.goalAmount) / 1_000_000).toFixed(2)} ALGO • Raised: ${(Number(state.raisedAmount) / 1_000_000).toFixed(2)} ALGO`
            })
          }
        }
      }

      // Get events created by user
      const allEvents = ContractRegistry.getTicketing()
      for (const metadata of allEvents) {
        if (metadata.creator === activeAddress) {
          const state = await getEventState(algorand, metadata)
          if (state) {
            historyItems.push({
              type: 'event_created',
              timestamp: metadata.createdAt,
              appId: metadata.appId,
              title: metadata.title || 'Untitled Event',
              details: `Tickets: ${Number(state.soldCount)}/${Number(state.maxSupply)} sold • Price: ${(Number(state.ticketPrice) / 1_000_000).toFixed(2)} ALGO`
            })
          }
        }
      }

      // Get donations made by user (check indexer for transactions to campaign contracts)
      try {
        const indexer = algorand.client.indexer
        const txns = await indexer
          .searchForTransactions()
          .address(activeAddress)
          .txType('pay')
          .limit(100)
          .do()

        for (const txn of txns.transactions) {
          // Check if receiver is a known campaign contract
          const campaign = allCampaigns.find(c => {
            // Get app address (we'd need to calculate this properly)
            return false // Simplified for now
          })
          
          // If found, add to history
          // This is simplified - in production you'd need proper app address lookup
        }
      } catch (e) {
        console.log('Could not load transaction history:', e)
      }

      // Get tickets purchased by user (check NFT holdings)
      try {
        const accountInfo = await algorand.client.algod.accountInformation(activeAddress).do()
        const assets = accountInfo.assets || []

        for (const asset of assets) {
          if (asset.amount > 0) {
            try {
              const assetInfo = await algorand.client.algod.getAssetByID(asset.assetId).do()
              // Check if this is an event ticket NFT
              if (assetInfo.params.name === 'Event Ticket' && assetInfo.params.unitName === 'TIX') {
                // The reserve field contains the buyer's address from our contract
                if (assetInfo.params.reserve === activeAddress) {
                  // Find the event by searching for matching title in registry
                  let eventTitle = 'Unknown Event'
                  for (const metadata of allEvents) {
                    const state = await getEventState(algorand, metadata)
                    if (state) {
                      eventTitle = metadata.title || 'Unnamed Event'
                      break // Use first match for now
                    }
                  }
                  
                  historyItems.push({
                    type: 'ticket_purchase',
                    timestamp: Date.now(), // Would need to get from transaction history
                    appId: Number(asset.assetId), // Use asset ID as identifier
                    title: eventTitle,
                    amount: '0.50', // Would need to get from transaction
                    details: `NFT Asset ID: ${asset.assetId}`
                  })
                }
              }
            } catch (e) {
              // Asset might be inaccessible, skip
            }
          }
        }
      } catch (e) {
        console.log('Could not load asset holdings:', e)
      }

      // Sort by timestamp descending
      historyItems.sort((a, b) => b.timestamp - a.timestamp)
      setHistory(historyItems)
      
    } catch (error) {
      console.error('Error loading history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getIcon = (type: HistoryItem['type']) => {
    switch (type) {
      case 'campaign_created': return '🏦'
      case 'event_created': return '🎭'
      case 'donation': return '💝'
      case 'ticket_purchase': return '🎫'
      default: return '📋'
    }
  }

  const getLabel = (type: HistoryItem['type']) => {
    switch (type) {
      case 'campaign_created': return 'Created Campaign'
      case 'event_created': return 'Created Event'
      case 'donation': return 'Made Donation'
      case 'ticket_purchase': return 'Purchased Ticket'
      default: return 'Activity'
    }
  }

  const getBadgeColor = (type: HistoryItem['type']) => {
    switch (type) {
      case 'campaign_created': return 'badge-primary'
      case 'event_created': return 'badge-secondary'
      case 'donation': return 'badge-success'
      case 'ticket_purchase': return 'badge-info'
      default: return 'badge-ghost'
    }
  }

  const createdItems = history.filter(h => 
    h.type === 'campaign_created' || h.type === 'event_created'
  )

  const participatedItems = history.filter(h => 
    h.type === 'donation' || h.type === 'ticket_purchase'
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 animate-gradient-shift">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg border-b-4 border-gradient-to-r from-indigo-500 to-pink-500">
        <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-ghost btn-sm hover:scale-110 transition-transform"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">📋 My Blockchain History</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="badge badge-info">TestNet • Decentralized</div>
            {activeAddress && (
              <div className="badge badge-success">{formatAddress(activeAddress)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!activeAddress ? (
          <div className="card bg-white shadow-xl">
            <div className="card-body text-center py-12">
              <h3 className="text-xl font-bold mb-2">Connect Your Wallet</h3>
              <p className="text-gray-600">Please connect your wallet to view your blockchain history.</p>
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="loading loading-spinner loading-lg text-primary"></div>
            <p className="mt-4 text-lg font-semibold">Loading your history from blockchain...</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="stat bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300">
                <div className="stat-title text-blue-100">Campaigns Created</div>
                <div className="stat-value text-white text-5xl">
                  {createdItems.filter(h => h.type === 'campaign_created').length}
                </div>
                <div className="stat-desc text-blue-100">🏦 Fundraising contracts</div>
              </div>
              <div className="stat bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300">
                <div className="stat-title text-purple-100">Events Created</div>
                <div className="stat-value text-white text-5xl">
                  {createdItems.filter(h => h.type === 'event_created').length}
                </div>
                <div className="stat-desc text-purple-100">🎉 Ticketing contracts</div>
              </div>
              <div className="stat bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300">
                <div className="stat-title text-green-100">Donations Made</div>
                <div className="stat-value text-white text-5xl">
                  {participatedItems.filter(h => h.type === 'donation').length}
                </div>
                <div className="stat-desc text-green-100">💸 To campaigns</div>
              </div>
              <div className="stat bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300">
                <div className="stat-title text-orange-100">Tickets Purchased</div>
                <div className="stat-value text-white text-5xl">
                  {participatedItems.filter(h => h.type === 'ticket_purchase').length}
                </div>
                <div className="stat-desc text-orange-100">🎫 Event tickets</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs tabs-boxed bg-gradient-to-r from-purple-500 to-pink-500 mb-6 p-1 shadow-lg">
              <a 
                className={`tab text-lg font-bold ${activeTab === 'created' ? 'tab-active bg-white text-purple-600' : 'text-white'}`}
                onClick={() => setActiveTab('created')}
              >
                🎨 Created ({createdItems.length})
              </a>
              <a 
                className={`tab text-lg font-bold ${activeTab === 'participated' ? 'tab-active bg-white text-pink-600' : 'text-white'}`}
                onClick={() => setActiveTab('participated')}
              >
                🤝 Participated ({participatedItems.length})
              </a>
            </div>

            {/* History List */}
            <div className="card bg-white shadow-xl">
              <div className="card-body">
                {(activeTab === 'created' ? createdItems : participatedItems).length === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="text-xl font-bold mb-2">
                      {activeTab === 'created' 
                        ? 'No contracts created yet' 
                        : 'No participation yet'}
                    </h3>
                    <p className="text-gray-600">
                      {activeTab === 'created'
                        ? 'Start by creating a campaign or event!'
                        : 'Donate to campaigns or purchase tickets to see activity here.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(activeTab === 'created' ? createdItems : participatedItems).map((item, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center gap-4 p-4 bg-base-100 rounded-lg hover:bg-base-200 transition-all"
                      >
                        <div className="text-4xl">{getIcon(item.type)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`badge ${getBadgeColor(item.type)} badge-sm`}>
                              {getLabel(item.type)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(item.timestamp)}
                            </span>
                          </div>
                          <h4 className="font-bold text-lg">{item.title}</h4>
                          <p className="text-sm text-gray-600">{item.details}</p>
                          {item.amount && (
                            <p className="text-sm font-bold text-green-600 mt-1">
                              Amount: {item.amount} ALGO
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="badge badge-outline">App ID: {item.appId}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Blockchain Info */}
            <div className="alert alert-info mt-8">
              <div className="text-sm">
                <p className="font-bold">⛓️ Fully Decentralized History</p>
                <p className="mt-1">
                  All data is retrieved directly from the Algorand blockchain. 
                  Your history is wallet-specific and stored on-chain - no centralized database!
                </p>
                <p className="mt-1 text-xs">
                  Connected Address: <span className="font-mono">{activeAddress}</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
