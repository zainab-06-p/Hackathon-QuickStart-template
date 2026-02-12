import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import { FundraiserFactory } from '../contracts/FundraiserClient'
import { ContractRegistry } from '../utils/contractRegistry'
import { pinFileToIPFS, ipfsHttpUrl } from '../utils/pinata'

const CreateCampaignPage = () => {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const [newCampaign, setNewCampaign] = useState({
    title: '',
    description: '',
    goal: '100',
    milestones: '3',
    daysUntilDeadline: '30',
    imageUrl: ''
  })

  const { enqueueSnackbar } = useSnackbar()
  const { activeAddress, transactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(transactionSigner)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      enqueueSnackbar('Please upload an image or video file', { variant: 'error' })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      enqueueSnackbar('File size must be less than 10MB', { variant: 'error' })
      return
    }

    setUploading(true)
    try {
      enqueueSnackbar('Uploading to IPFS...', { variant: 'info' })
      const result = await pinFileToIPFS(file)
      const url = ipfsHttpUrl(result.IpfsHash)
      setNewCampaign({ ...newCampaign, imageUrl: url })
      enqueueSnackbar('✅ Media uploaded successfully!', { variant: 'success' })
    } catch (e) {
      console.error('Upload error:', e)
      enqueueSnackbar(`Upload failed: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const createCampaign = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet', { variant: 'error' })
      return
    }

    setCreating(true)
    try {
      const goalInMicroAlgos = Math.floor(parseFloat(newCampaign.goal) * 1_000_000)
      const milestonesCount = parseInt(newCampaign.milestones)
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + 
        (parseInt(newCampaign.daysUntilDeadline) * 24 * 60 * 60)

      const factory = new FundraiserFactory({
        algorand,
        defaultSender: activeAddress,
      })

      // Check account balance first
      const accountInfo = await algorand.client.algod.accountInformation(activeAddress).do()
      const balance = accountInfo.amount
      const minBalance = accountInfo['min-balance']
      
      if (balance < minBalance + 1000000) { // Need at least 1 ALGO extra for contract creation
        enqueueSnackbar(
          `Insufficient balance! You have ${(balance / 1_000_000).toFixed(3)} ALGO but need at least ${((minBalance + 1000000) / 1_000_000).toFixed(3)} ALGO. Please add more funds to your wallet.`,
          { variant: 'error' }
        )
        return
      }

      enqueueSnackbar('Deploying smart contract...', { variant: 'info' })

      const { result } = await factory.send.create.createCampaign({
        args: {
          goal: BigInt(goalInMicroAlgos),
          milestones: BigInt(milestonesCount),
          deadline: BigInt(deadlineTimestamp)
        },
        note: new TextEncoder().encode(JSON.stringify({
          type: 'campaign',
          title: newCampaign.title,
          description: newCampaign.description,
          imageUrl: newCampaign.imageUrl
        })),
        populateAppCallResources: false,
        suppressLog: true
      })

      const appId = Number(result.appId)
      
      enqueueSnackbar(`✅ Campaign created! App ID: ${appId}`, { variant: 'success' })

      ContractRegistry.registerFundraiser({
        appId,
        creator: activeAddress,
        createdAt: Date.now(),
        title: newCampaign.title,
        description: newCampaign.description,
        imageUrl: newCampaign.imageUrl
      })

      // Navigate back to campaigns list
      setTimeout(() => {
        navigate('/fundraising')
      }, 2000)
      
    } catch (e) {
      console.error('Error creating campaign:', e)
      enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/fundraising')} 
              className="btn btn-ghost btn-sm"
            >
              ← Back to Campaigns
            </button>
            <h1 className="text-2xl font-bold text-blue-600">🚀 Create New Campaign</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="badge badge-info">TestNet</div>
            {activeAddress && (
              <div className="badge badge-success">{formatAddress(activeAddress)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card bg-white/95 backdrop-blur shadow-2xl border-2 border-purple-200 hover:border-purple-400 transition-all duration-300">
          <div className="card-body">
            <h2 className="card-title text-3xl mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              🚀 Campaign Details
            </h2>
            <div className="alert alert-info bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 shadow-lg mb-6">
              <span><strong>⛓️ Fully Decentralized:</strong> Each campaign deploys its own smart contract. Funds released only when goal is 100% reached!</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Campaign Title *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newCampaign.title}
                  onChange={(e) => setNewCampaign({...newCampaign, title: e.target.value})}
                  placeholder="e.g., Tech Fest 2026 Funding"
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Goal Amount (ALGO) *</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="input input-bordered"
                  value={newCampaign.goal}
                  onChange={(e) => setNewCampaign({...newCampaign, goal: e.target.value})}
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Milestones *</span>
                </label>
                <input
                  type="number"
                  min="1"
                  className="input input-bordered"
                  value={newCampaign.milestones}
                  onChange={(e) => setNewCampaign({...newCampaign, milestones: e.target.value})}
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Days Until Deadline *</span>
                </label>
                <input
                  type="number"
                  min="1"
                  className="input input-bordered"
                  value={newCampaign.daysUntilDeadline}
                  onChange={(e) => setNewCampaign({...newCampaign, daysUntilDeadline: e.target.value})}
                />
              </div>
              
              <div className="form-control md:col-span-2">
                <label className="label">
                  <span className="label-text font-semibold">Description *</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24"
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({...newCampaign, description: e.target.value})}
                  placeholder="Describe your campaign..."
                />
              </div>
              
              <div className="form-control md:col-span-2">
                <label className="label">
                  <span className="label-text font-semibold">Campaign Image/Video (Optional)</span>
                </label>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="file-input file-input-bordered w-full"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
                {uploading && (
                  <span className="label-text-alt text-info mt-2">
                    📤 Uploading to IPFS...
                  </span>
                )}
                {newCampaign.imageUrl && (
                  <div className="mt-2">
                    <span className="label-text-alt text-success">✅ Media uploaded!</span>
                    {newCampaign.imageUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img src={newCampaign.imageUrl} alt="Preview" className="mt-2 max-h-32 rounded" />
                    ) : (
                      <video src={newCampaign.imageUrl} className="mt-2 max-h-32 rounded" controls />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="divider"></div>

            <button 
              className={`btn btn-lg w-full mt-6 text-lg shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 ${creating ? 'loading' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:scale-105 border-0 text-white'}`}
              onClick={createCampaign}
              disabled={creating || !activeAddress || !newCampaign.title || !newCampaign.description || uploading}
            >
              {creating ? 'Deploying Contract...' : '⛓️ Deploy Campaign Contract'}
            </button>

            {!activeAddress && (
              <div className="alert alert-warning mt-4">
                <span>⚠️ Please connect your wallet to create a campaign</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateCampaignPage
