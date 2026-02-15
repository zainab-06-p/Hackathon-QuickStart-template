import { useWallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import { FundraiserFactory } from '../contracts/FundraiserClient'
import { saveCampaignToFirebase, initializeFirebase } from '../utils/firebase'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import { Rocket, Shield, Target, Calendar, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const CreateCampaignPage = () => {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  
  const [newCampaign, setNewCampaign] = useState({
    title: '',
    description: '',
    goal: '5',
    milestones: '3',
    daysUntilDeadline: '30'
  })
  
  const [approvers, setApprovers] = useState({
    approver1: '',
    approver2: '',
    approver3: ''
  })

  const { activeAddress, transactionSigner } = useWallet()

  const createCampaign = async () => {
    if (!activeAddress) {
      toast.error('Please connect your wallet first')
      return
    }
    
    setCreating(true)
    try {
      initializeFirebase()

      const algodConfig = getAlgodConfigFromViteEnvironment()
      const indexerConfig = getIndexerConfigFromViteEnvironment()
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
      algorand.setDefaultSigner(transactionSigner)
      algorand.setDefaultValidityWindow(1000)

      const factory = new FundraiserFactory({
        defaultSender: activeAddress,
        algorand,
      })

      toast.loading('Deploying contract — please approve in your wallet...', { id: 'create' })
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + parseInt(newCampaign.daysUntilDeadline) * 24 * 60 * 60
      const { result } = await factory.send.create.createCampaign({
        args: [
          BigInt(parseFloat(newCampaign.goal) * 1_000_000),
          BigInt(newCampaign.milestones),
          BigInt(deadlineTimestamp),
          approvers.approver1 || activeAddress,
          approvers.approver2 || activeAddress,
          approvers.approver3 || activeAddress,
        ]
      })

      if (!result.appId) throw new Error('Failed to get App ID')
      const appId = Number(result.appId)

      toast.loading('Saving campaign details...', { id: 'create' })
      await saveCampaignToFirebase({
        appId: appId.toString(),
        creator: activeAddress,
        title: newCampaign.title,
        description: newCampaign.description,
        goal: newCampaign.goal,
        createdAt: Date.now()
      })

      toast.success(`Campaign created! App ID: ${appId}`, { id: 'create' })
      navigate('/fundraise')
    } catch (error: any) {
      console.error(error)
      const msg = error?.message || String(error)
      if (msg.includes('overspend') || msg.includes('underflow') || msg.includes('MicroAlgos:{Raw:0}')) {
        toast.error('Insufficient ALGO balance. Fund your wallet on TestNet first.', { id: 'create' })
      } else if (msg.includes('user rejected') || msg.includes('cancelled') || msg.includes('User Rejected')) {
        toast.error('Transaction cancelled by user', { id: 'create' })
      } else if (msg.includes('popup') || msg.includes('blocked')) {
        toast.error('Wallet popup was blocked. Allow popups for this site and try again.', { id: 'create' })      } else if (msg.includes('txn dead') || msg.includes('outside of')) {
        toast.error('Transaction expired. Please try again — approve faster in your wallet.', { id: 'create' })      } else {
        toast.error(`Failed: ${msg.substring(0, 100)}`, { id: 'create' })
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="mb-8">
        <button onClick={() => navigate(-1)} className="flex items-center text-zinc-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>
        <h1 className="text-3xl font-display font-semibold text-white">Start a Campaign</h1>
        <p className="text-zinc-400 mt-2">Launch your fundraising initiative on the blockchain.</p>
      </div>

      <Card className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Campaign Title</label>
          <input 
            type="text" 
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            placeholder="e.g. Solar Power for Campus Library"
            value={newCampaign.title}
            onChange={(e) => setNewCampaign({...newCampaign, title: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
          <textarea 
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white h-32 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            placeholder="Describe your project goals and impact..."
            value={newCampaign.description}
            onChange={(e) => setNewCampaign({...newCampaign, description: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Funding Goal (ALGO)</label>
            <div className="relative">
               <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
               <input 
                type="number"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                value={newCampaign.goal}
                onChange={(e) => setNewCampaign({...newCampaign, goal: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Milestones</label>
            <div className="relative">
               <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
               <input 
                type="number"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                value={newCampaign.milestones}
                onChange={(e) => setNewCampaign({...newCampaign, milestones: e.target.value})}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Duration (Days)</label>
            <div className="relative">
               <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
               <input 
                type="number"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                value={newCampaign.daysUntilDeadline}
                onChange={(e) => setNewCampaign({...newCampaign, daysUntilDeadline: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
           <div className="border-t border-zinc-800 pt-6 mb-6">
             <h3 className="text-lg font-medium text-white mb-1 flex items-center gap-2">
               <Shield className="w-5 h-5 text-indigo-400" /> Multi-Sig Approvers
             </h3>
             <p className="text-sm text-zinc-500 mb-4">
               Three wallet addresses must approve each milestone before funds are released. Leave blank to use your own address (for demo/testing).
             </p>
             <div className="space-y-4">
               {[1, 2, 3].map((n) => (
                 <div key={n}>
                   <label className="block text-sm font-medium text-zinc-300 mb-1.5">Approver {n}</label>
                   <input
                     type="text"
                     className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors placeholder-zinc-600"
                     placeholder={`Approver ${n} wallet address (58 chars)`}
                     value={approvers[`approver${n}` as keyof typeof approvers]}
                     onChange={(e) => setApprovers({ ...approvers, [`approver${n}`]: e.target.value.trim() })}
                   />
                 </div>
               ))}
             </div>
           </div>
           <BrandButton 
            fullWidth 
            size="lg" 
            onClick={createCampaign}
            isLoading={creating}
            disabled={!newCampaign.title || !newCampaign.description}
          >
            <Rocket className="w-4 h-4 mr-2" /> Launch Campaign
          </BrandButton>
        </div>
      </Card>
    </div>
  )
}

export default CreateCampaignPage
