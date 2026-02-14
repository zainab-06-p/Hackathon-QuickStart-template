import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import algosdk from 'algosdk'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import { FundraiserFactory } from '../contracts/FundraiserClient'
import { CampusChainRegistryFactory } from '../contracts/RegistryClient'
import { ContractRegistry } from '../utils/contractRegistry'
import { saveCampaignToFirebase, initializeFirebase } from '../utils/firebase'

const CreateCampaignPage = () => {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  
  const [newCampaign, setNewCampaign] = useState({
    title: '',
    description: '',
    goal: '100',
    milestones: '3',
    daysUntilDeadline: '30'
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
      const balance = Number(accountInfo.amount)
      const minBalance = Number(accountInfo.minBalance)
      
      // Need: contract creation fee (1 ALGO) + contract MBR (0.1 ALGO) + user MBR
      const requiredBalance = minBalance + 1_100_000 // 1.1 ALGO extra
      
      if (balance < requiredBalance) {
        enqueueSnackbar(
          `Insufficient balance! You have ${(balance / 1_000_000).toFixed(3)} ALGO but need at least ${(requiredBalance / 1_000_000).toFixed(3)} ALGO. Please add more funds to your wallet.`,
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
          description: newCampaign.description
        })),
        validityWindow: 2000,  // ~8 minutes for signing
        populateAppCallResources: false,
        suppressLog: true
      })

      const appId = Number(result.appId)
      const appAddress = algosdk.getApplicationAddress(appId)
      
      // Fund the contract with minimum balance (0.1 ALGO) so it can send payments later
      enqueueSnackbar('Funding contract with minimum balance...', { variant: 'info' })
      await algorand.send.payment({
        sender: activeAddress,
        receiver: appAddress,
        amount: algokit.algos(0.1),
        validityWindow: 2000,  // ~8 minutes for signing
        suppressLog: true
      })
      
      enqueueSnackbar(`✅ Campaign created! App ID: ${appId}`, { variant: 'success' })

      // Register in localStorage for immediate visibility
      ContractRegistry.registerFundraiser({
        appId,
        creator: activeAddress,
        createdAt: Date.now(),
        title: newCampaign.title,
        description: newCampaign.description
      })

      // 🔥 Save to Firebase for real-time cross-device sync
      try {
        initializeFirebase()
        await saveCampaignToFirebase({
          appId: String(appId),
          title: newCampaign.title,
          description: newCampaign.description,
          goal: newCampaign.goal,
          creator: activeAddress,
          createdAt: Date.now(),
          blockchainTxId: result.transaction?.txID() || result.transactions?.[0]?.txID() || undefined
        })
        console.log('🔥 Campaign saved to Firebase for real-time sync')
        enqueueSnackbar('🔥 Campaign synced across all devices!', { variant: 'info' })
      } catch (firebaseError) {
        console.warn('Firebase save failed (non-critical):', firebaseError)
        // Non-blocking: blockchain + localStorage still work
      }

      // 🎯 Register with on-chain registry for cross-device discovery
      const registryAppId = import.meta.env.VITE_REGISTRY_APP_ID
      if (registryAppId && Number(registryAppId) > 0) {
        try {
          console.log(`📝 Registering campaign ${appId} with registry contract ${registryAppId}...`)
          
          const registryFactory = new CampusChainRegistryFactory({
            algorand,
            defaultSender: activeAddress,
          })
          
          const registryClient = registryFactory.getAppClientById({
            appId: BigInt(registryAppId)
          })
          
          await registryClient.send.registerFundraiser({
            args: { appId: BigInt(appId) }
          })
          
          console.log(`✅ Campaign ${appId} registered in on-chain registry!`)
          enqueueSnackbar('📋 Campaign registered for cross-device discovery!', { variant: 'success' })
        } catch (error) {
          console.warn('Registry registration failed (non-critical):', error)
          // Don't block the user - localStorage registration is enough
        }
      }

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
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              <button 
                onClick={() => navigate('/fundraising')} 
                className="btn btn-ghost btn-xs sm:btn-sm"
              >
                ← Back
              </button>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">🚀 Create Campaign</h1>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="badge badge-info badge-xs sm:badge-sm">TestNet</div>
              {activeAddress && (
                <div className="badge badge-success badge-xs sm:badge-sm hidden sm:inline-flex">{formatAddress(activeAddress)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card bg-white/95 backdrop-blur shadow-2xl border-2 border-purple-200 hover:border-purple-400 transition-all duration-300">
          <div className="card-body">
            <h2 className="card-title text-xl md:text-2xl lg:text-3xl mb-4 md:mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              🚀 Campaign Details
            </h2>
            <div className="alert alert-info bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 shadow-lg mb-4 md:mb-6">
              <span className="text-xs sm:text-sm"><strong>⛓️ Fully Decentralized:</strong> Each campaign deploys its own smart contract. Funds released only when goal is 100% reached!</span>
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
            </div>

            <div className="divider"></div>

            <button 
              className={`btn btn-lg w-full mt-6 text-lg shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 ${creating ? 'loading' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:scale-105 border-0 text-white'}`}
              onClick={createCampaign}
              disabled={creating || !activeAddress || !newCampaign.title || !newCampaign.description}
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
