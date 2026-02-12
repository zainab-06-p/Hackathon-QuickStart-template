import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'

interface Contributor {
  address: string
  amount: number
  timestamp: number
}

interface Campaign {
  id: string
  title: string
  description: string
  goal: number
  raised: number
  contributors: Contributor[]
  milestones: string[]
  currentMilestone: number
  createdAt: number
  deadline: number
}

const FundraisingPage = () => {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [creating, setCreating] = useState(false)
  const [donating, setDonating] = useState(false)
  const [donationAmount, setDonationAmount] = useState<string>('1')
  
  // Create campaign form
  const [newCampaign, setNewCampaign] = useState({
    title: '',
    description: '',
    goal: '10',
    milestones: ['Project Planning', 'Initial Development', 'Final Launch']
  })

  const { enqueueSnackbar } = useSnackbar()
  const { activeAccount, activeAddress, transactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(transactionSigner)

  // Load campaigns from localStorage (simulating on-chain data)
  useEffect(() => {
    const stored = localStorage.getItem('campaigns')
    if (stored) {
      setCampaigns(JSON.parse(stored))
    } else {
      // Initialize with sample campaigns
      const sampleCampaigns: Campaign[] = [
        {
          id: '1',
          title: 'AI Club Hackathon',
          description: 'Funding needed for VIT AI Club annual hackathon with prizes and resources',
          goal: 30,
          raised: 12.5,
          contributors: [
            { address: 'SAMPLE...ADDR1', amount: 5, timestamp: Date.now() - 86400000 },
            { address: 'SAMPLE...ADDR2', amount: 7.5, timestamp: Date.now() - 43200000 },
          ],
          milestones: ['Venue Booking', 'Prize Pool', 'Marketing & Launch'],
          currentMilestone: 0,
          createdAt: Date.now() - 172800000,
          deadline: Date.now() + 2592000000
        }
      ]
      localStorage.setItem('campaigns', JSON.stringify(sampleCampaigns))
      setCampaigns(sampleCampaigns)
    }
  }, [])

  const createCampaign = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet', { variant: 'error' })
      return
    }

    setCreating(true)
    try {
      const campaign: Campaign = {
        id: Date.now().toString(),
        title: newCampaign.title,
        description: newCampaign.description,
        goal: parseFloat(newCampaign.goal),
        raised: 0,
        contributors: [],
        milestones: newCampaign.milestones,
        currentMilestone: 0,
        createdAt: Date.now(),
        deadline: Date.now() + 2592000000 // 30 days
      }

      const updated = [...campaigns, campaign]
      setCampaigns(updated)
      localStorage.setItem('campaigns', JSON.stringify(updated))
      
      enqueueSnackbar(`Campaign "${campaign.title}" created successfully!`, { variant: 'success' })
      setNewCampaign({
        title: '',
        description: '',
        goal: '10',
        milestones: ['Project Planning', 'Initial Development', 'Final Launch']
      })
    } catch (e) {
      enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const donate = async () => {
    if (!selectedCampaign || !activeAddress) {
      enqueueSnackbar('Please select a campaign and connect wallet', { variant: 'error' })
      return
    }

    if (!donationAmount || parseFloat(donationAmount) <= 0) {
      enqueueSnackbar('Please enter a valid donation amount', { variant: 'error' })
      return
    }

    setDonating(true)
    try {
      const amountInMicroAlgos = Math.floor(parseFloat(donationAmount) * 1_000_000)
      
      // Actual blockchain transaction
      await algorand.send.payment({
        sender: activeAddress,
        receiver: activeAddress, // In production: would be campaign escrow address
        amount: algokit.microAlgos(amountInMicroAlgos),
      })

      // Update campaign data
      const contributor: Contributor = {
        address: activeAddress,
        amount: parseFloat(donationAmount),
        timestamp: Date.now()
      }

      const updatedCampaigns = campaigns.map(c => {
        if (c.id === selectedCampaign.id) {
          return {
            ...c,
            raised: c.raised + parseFloat(donationAmount),
            contributors: [...c.contributors, contributor]
          }
        }
        return c
      })

      setCampaigns(updatedCampaigns)
      localStorage.setItem('campaigns', JSON.stringify(updatedCampaigns))
      setSelectedCampaign(updatedCampaigns.find(c => c.id === selectedCampaign.id) || null)
      
      enqueueSnackbar(
        `Donated ${donationAmount} ALGO successfully!`, 
        { variant: 'success' }
      )
      setDonationAmount('1')
    } catch (e) {
      enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setDonating(false)
    }
  }

  const formatAddress = (addr: string) => {
    if (addr.startsWith('SAMPLE')) return addr
    return `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}`
  }

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const hours = Math.floor(diff / 3600000)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const calculateDaysLeft = (deadline: number) => {
    const diff = deadline - Date.now()
    return Math.max(0, Math.floor(diff / 86400000))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-ghost btn-sm"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-purple-600">🏦 Campus Fundraising</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="badge badge-info">TestNet</div>
            {activeAddress && (
              <div className="badge badge-success">{formatAddress(activeAddress)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="stat bg-white rounded-lg shadow-lg">
            <div className="stat-title">Total Campaigns</div>
            <div className="stat-value text-purple-600">{campaigns.length}</div>
          </div>
          <div className="stat bg-white rounded-lg shadow-lg">
            <div className="stat-title">Total Raised</div>
            <div className="stat-value text-green-600">
              {campaigns.reduce((sum, c) => sum + c.raised, 0).toFixed(2)} ALGO
            </div>
          </div>
          <div className="stat bg-white rounded-lg shadow-lg">
            <div className="stat-title">Total Contributors</div>
            <div className="stat-value text-blue-600">
              {new Set(campaigns.flatMap(c => c.contributors.map(con => con.address))).size}
            </div>
          </div>
          <div className="stat bg-white rounded-lg shadow-lg">
            <div className="stat-title">Active Campaigns</div>
            <div className="stat-value text-orange-600">
              {campaigns.filter(c => c.raised < c.goal).length}
            </div>
          </div>
        </div>

        {/* Create Campaign Section */}
        <div className="card bg-white shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">🚀 Create New Campaign</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Campaign Title</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newCampaign.title}
                  onChange={(e) => setNewCampaign({...newCampaign, title: e.target.value})}
                  placeholder="e.g., Tech Festival 2026"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Goal (ALGO)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  className="input input-bordered"
                  value={newCampaign.goal}
                  onChange={(e) => setNewCampaign({...newCampaign, goal: e.target.value})}
                />
              </div>
              <div className="form-control md:col-span-2">
                <label className="label">
                  <span className="label-text font-semibold">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24"
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({...newCampaign, description: e.target.value})}
                  placeholder="Describe your campaign purpose and goals..."
                />
              </div>
            </div>
            <button 
              className={`btn btn-primary mt-4 ${creating ? 'loading' : ''}`}
              onClick={createCampaign}
              disabled={creating || !activeAddress || !newCampaign.title || !newCampaign.description}
            >
              {creating ? 'Creating...' : '✨ Create Campaign'}
            </button>
          </div>
        </div>

        {/* Campaigns Grid */}
        <h2 className="text-2xl font-bold mb-4">Active Campaigns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {campaigns.map((campaign) => {
            const progress = (campaign.raised / campaign.goal) * 100
            const daysLeft = calculateDaysLeft(campaign.deadline)
            
            return (
              <div 
                key={campaign.id}
                className="card bg-white shadow-xl hover:shadow-2xl transition-all cursor-pointer"
                onClick={() => setSelectedCampaign(campaign)}
              >
                <div className="card-body">
                  <h3 className="card-title text-lg">{campaign.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{campaign.description}</p>
                  
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold">{campaign.raised.toFixed(2)} ALGO</span>
                      <span className="text-gray-500">{campaign.goal.toFixed(2)} ALGO</span>
                    </div>
                    <progress 
                      className="progress progress-primary w-full" 
                      value={progress} 
                      max="100"
                    />
                    <div className="flex justify-between text-xs mt-2">
                      <span>{progress.toFixed(0)}% funded</span>
                      <span>{daysLeft} days left</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <div className="badge badge-outline">
                      👥 {campaign.contributors.length} backers
                    </div>
                    <div className="badge badge-success badge-outline">
                      Milestone {campaign.currentMilestone + 1}/{campaign.milestones.length}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Campaign Detail Modal */}
        {selectedCampaign && (
          <dialog id="campaign_modal" className="modal modal-open">
            <div className="modal-box max-w-4xl">
              <button 
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => setSelectedCampaign(null)}
              >
                ✕
              </button>
              
              <h3 className="font-bold text-2xl mb-2">{selectedCampaign.title}</h3>
              <p className="text-gray-600 mb-4">{selectedCampaign.description}</p>
              
              {/* Progress */}
              <div className="card bg-gradient-to-r from-purple-500 to-pink-500 text-white mb-4">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="text-sm opacity-90">Raised</p>
                      <p className="text-3xl font-bold">{selectedCampaign.raised.toFixed(2)} ALGO</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm opacity-90">Goal</p>
                      <p className="text-2xl font-bold">{selectedCampaign.goal.toFixed(2)} ALGO</p>
                    </div>
                  </div>
                  <progress 
                    className="progress progress-accent w-full h-3" 
                    value={(selectedCampaign.raised / selectedCampaign.goal) * 100} 
                    max="100"
                  />
                  <div className="flex justify-between text-sm mt-2 opacity-90">
                    <span>{((selectedCampaign.raised / selectedCampaign.goal) * 100).toFixed(0)}% Complete</span>
                    <span>{calculateDaysLeft(selectedCampaign.deadline)} Days Remaining</span>
                  </div>
                </div>
              </div>

              {/* Donation Form */}
              <div className="card bg-base-200 mb-4">
                <div className="card-body">
                  <h4 className="font-bold mb-2">💝 Make a Donation</h4>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="input input-bordered flex-1"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      placeholder="Amount in ALGO"
                    />
                    <button 
                      className={`btn btn-primary ${donating ? 'loading' : ''}`}
                      onClick={donate}
                      disabled={donating || !activeAddress}
                    >
                      {donating ? 'Processing...' : 'Donate'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Contributors List */}
              <div className="mb-4">
                <h4 className="font-bold mb-2">👥 Recent Contributors ({selectedCampaign.contributors.length})</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {selectedCampaign.contributors.slice().reverse().map((contributor, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-base-200 p-3 rounded-lg">
                      <div>
                        <p className="font-mono text-sm">{formatAddress(contributor.address)}</p>
                        <p className="text-xs text-gray-500">{formatTime(contributor.timestamp)}</p>
                      </div>
                      <div className="badge badge-success">{contributor.amount.toFixed(2)} ALGO</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestones */}
              <div>
                <h4 className="font-bold mb-2">🎯 Milestones</h4>
                <div className="space-y-2">
                  {selectedCampaign.milestones.map((milestone, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        idx <= selectedCampaign.currentMilestone 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-base-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        idx <= selectedCampaign.currentMilestone 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-300'
                      }`}>
                        {idx <= selectedCampaign.currentMilestone ? '✓' : idx + 1}
                      </div>
                      <span className="font-medium">{milestone}</span>
                    </div>
                  ))}
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

export default FundraisingPage
