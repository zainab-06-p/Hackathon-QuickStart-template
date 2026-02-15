import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { listenToCampaigns, initializeFirebase, type FirebaseCampaign } from '../utils/firebase'
import { getCampaignState, type CampaignState } from '../utils/blockchainData'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import { ProgressBar } from '../components/Base/ProgressBar'
import { ImpactBadge } from '../components/Base/ImpactBadge'
import { Activity, ArrowLeft, ShieldCheck, PieChart, FileText, CheckCircle2, History } from 'lucide-react'

// Interfaces kept same as original for compatibility
interface EscrowState {
  appId: number
  totalRaised: bigint
  totalReleased: bigint
  requestCount: bigint
  rejectionCount: bigint
  isFrozen: boolean
  votingWindow: bigint
  currentMilestone: bigint
  milestoneCount: bigint
  goalAmount: bigint
  creator: string
  title: string
  description: string
}

interface WithdrawalRequest {
  id: number
  amount: number
  status: string
  votesFor: number
  votesAgainst: number
  totalWeight: number
  aiScore: number
}

const FundTrackerPage = () => {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<CampaignState[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignState | null>(null)
  const [escrowState, setEscrowState] = useState<EscrowState | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'audit'>('overview')

  // Mock withdrawal requests
  const [withdrawalRequests] = useState<WithdrawalRequest[]>([
    { id: 1, amount: 50, status: 'Released', votesFor: 8, votesAgainst: 1, totalWeight: 100, aiScore: 92 },
    { id: 2, amount: 30, status: 'Pending Vote', votesFor: 3, votesAgainst: 0, totalWeight: 100, aiScore: 87 },
    { id: 3, amount: 20, status: 'AI Review', votesFor: 0, votesAgainst: 0, totalWeight: 100, aiScore: 0 },
  ])

  const { enqueueSnackbar } = useSnackbar()
  const { activeAddress, transactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
  algorand.setDefaultSigner(transactionSigner)

  useEffect(() => {
    initializeFirebase()
    const unsubscribe = listenToCampaigns(async (firebaseCampaigns: FirebaseCampaign[]) => {
      const campaignStates: CampaignState[] = []
      for (const fb of firebaseCampaigns) {
        const metadata = {
          appId: parseInt(fb.appId),
          creator: fb.creator,
          createdAt: fb.createdAt,
          title: fb.title,
          description: fb.description
        }
        const state = await getCampaignState(algorand, metadata)
        if (state) campaignStates.push(state)
      }
      setCampaigns(campaignStates)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const selectCampaign = (campaign: CampaignState) => {
    setSelectedCampaign(campaign)
    setEscrowState({
      appId: campaign.appId,
      totalRaised: campaign.raisedAmount,
      totalReleased: campaign.raisedAmount * BigInt(Number(campaign.currentMilestone)) / (campaign.milestoneCount > 0n ? campaign.milestoneCount : 1n),
      requestCount: BigInt(3),
      rejectionCount: BigInt(0),
      isFrozen: false,
      votingWindow: BigInt(172800),
      currentMilestone: campaign.currentMilestone,
      milestoneCount: campaign.milestoneCount,
      goalAmount: campaign.goalAmount,
      creator: campaign.creator,
      title: campaign.title,
      description: campaign.description,
    })
  }

  const formatAlgo = (microAlgos: bigint) => (Number(microAlgos) / 1_000_000).toFixed(2)
  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Released': return 'success';
      case 'Pending Vote': return 'warning';
      case 'AI Review': return 'indigo';
      case 'Approved': return 'success';
      case 'Rejected': return 'rose';
      default: return 'default';
    }
  }

  const escrowed = escrowState ? escrowState.totalRaised - escrowState.totalReleased : BigInt(0)

  if (loading && campaigns.length === 0) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center space-y-4'>
          <div className='loading loading-spinner loading-lg text-indigo-500'></div>
          <p className='text-zinc-500 font-medium'>Syncing Blockchain Data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-7xl mx-auto pb-20 space-y-8'>
        
        {/* Header */}
        <div className='flex justify-between items-center py-6 border-b border-zinc-800'>
          <div className='flex items-center gap-4'>
            <button onClick={() => navigate('/')} className='p-2 -ml-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800'>
              <ArrowLeft className='w-5 h-5' />
            </button>
            <div>
              <h1 className='text-2xl font-display font-semibold text-white flex items-center gap-3'>
                <Activity className='text-indigo-500 w-6 h-6' />
                Fund Tracker
              </h1>
              <p className='text-sm text-zinc-500'>Real-time escrow auditing & milestone tracking</p>
            </div>
          </div>
          <div className='text-sm font-medium text-zinc-500 px-3 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800'>
            {activeAddress ? `Wallet: ${formatAddress(activeAddress)}` : 'Wallet Disconnected'}
          </div>
        </div>

        <div>
          {!selectedCampaign ? (
            /* Campaign Selection */
            <div className='space-y-6'>
              <h2 className='text-lg font-medium text-white'>Active Projects</h2>
              {campaigns.length === 0 ? (
                <Card>
                  <div className='text-center py-12'>
                    <p className='text-zinc-500'>No active campaigns found on-chain.</p>
                  </div>
                </Card>
              ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                  {campaigns.map((c) => (
                    <div key={c.appId} onClick={() => selectCampaign(c)} className='cursor-pointer group'>
                      <Card hoverable className='h-full'>
                        <div className='space-y-4'>
                          <div className='flex justify-between items-start'>
                            <h3 className='font-semibold text-lg text-white group-hover:text-indigo-400 transition-colors'>{c.title}</h3>
                            <ImpactBadge 
                              label={c.isActive ? 'Active' : 'Ended'} 
                              color={c.isActive ? 'success' : 'default'} 
                              size='sm'
                            />
                          </div>
                          
                          <ProgressBar 
                            progress={Number(c.raisedAmount)} 
                            max={Number(c.goalAmount)} 
                            label='Funding'
                            sublabel={formatAlgo(c.raisedAmount) + ' ALGO'}
                            color='indigo'
                          />
                          
                          <div className='flex justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800/50'>
                            <span>Milestone {Number(c.currentMilestone)}/{Number(c.milestoneCount)}</span>
                            <span className='font-mono'>APP ID: {Number(c.appId)}</span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Fund Tracker Dashboard */
            <div className='space-y-8 animate-fade-in'>
              <div className='flex items-center gap-2 text-sm text-zinc-500 mb-2'>
                <button onClick={() => { setSelectedCampaign(null); setEscrowState(null) }} className='hover:text-white transition-colors'>Projects</button>
                <span>/</span>
                <span className='text-indigo-400'>{selectedCampaign.title}</span>
              </div>

              <div className='space-y-2'>
                <h2 className='text-3xl font-display font-semibold text-white'>{selectedCampaign.title}</h2>
                <p className='text-zinc-400 max-w-3xl leading-relaxed'>{selectedCampaign.description}</p>
              </div>

              {/* Fund Flow Overview Cards */}
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                {[ 
                  { label: 'Total Raised', value: formatAlgo(escrowState?.totalRaised || BigInt(0)) + ' A', color: 'indigo' },
                  { label: 'In Escrow', value: formatAlgo(escrowed) + ' A', color: 'amber' },
                  { label: 'Released', value: formatAlgo(escrowState?.totalReleased || BigInt(0)) + ' A', color: 'emerald' },
                  { label: 'Health Score', value: '100%', color: 'zinc' },
                ].map((stat, i) => (
                  <Card key={i} className='p-5'>
                    <div className='text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2'>{stat.label}</div>
                    <div className='text-2xl font-semibold text-white tracking-tight'>{stat.value}</div>
                  </Card>
                ))}
              </div>

              {/* Milestone Progress */}
              <Card>
                <h3 className='text-lg font-medium text-white mb-6'>Milestone Timeline</h3>
                <div className='relative'>
                  <div className='absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -translate-y-1/2' />
                  <div className='relative flex justify-between'>
                    {escrowState && Array.from({ length: Number(escrowState.milestoneCount) }, (_, i) => {
                       const isCompleted = i < Number(escrowState.currentMilestone);
                       const isCurrent = i === Number(escrowState.currentMilestone);
                       
                       return (
                        <div key={i} className='flex flex-col items-center gap-3'>
                          <div className={`w-4 h-4 rounded-full border-4 z-10 box-content transition-colors duration-500 ${
                            isCompleted ? 'bg-emerald-500 border-zinc-900' : 
                            isCurrent ? 'bg-indigo-500 border-zinc-900 ring-4 ring-indigo-500/20' : 
                            'bg-zinc-800 border-zinc-900'
                          }`} />
                          <span className={`text-xs font-medium ${isCurrent ? 'text-indigo-400' : 'text-zinc-500'}`}>
                            Stage {i + 1}
                          </span>
                        </div>
                       )
                    })}
                  </div>
                </div>
              </Card>

              {/* Tabs */}
              <div className='flex gap-1 bg-zinc-900/50 p-1 rounded-lg w-fit'>
                {['overview', 'requests', 'audit'].map((tab) => (
                  <button 
                    key={tab}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      activeTab === tab 
                        ? 'bg-zinc-800 text-white shadow-sm' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                    }`}
                    onClick={() => setActiveTab(tab as any)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <Card>
                  <h3 className='text-lg font-medium text-white mb-6'>Capital Flow Analysis</h3>
                  <div className='flex items-center justify-between gap-4 py-8 px-4'>
                    <div className='text-center space-y-2'>
                      <div className='w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-500'>
                        <Activity />
                      </div>
                      <div className='font-medium text-white'>Supporters</div>
                      <div className='text-sm text-zinc-500'>{formatAlgo(escrowState?.totalRaised || BigInt(0))} A</div>
                    </div>
                    <div className='flex-1 border-t border-dashed border-zinc-700' />
                    <div className='text-center space-y-2'>
                      <div className='w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto text-amber-500'>
                        <ShieldCheck />
                      </div>
                      <div className='font-medium text-white'>Escrow Vault</div>
                      <div className='text-sm text-zinc-500'>{formatAlgo(escrowed)} A</div>
                    </div>
                    <div className='flex-1 border-t border-dashed border-zinc-700' />
                    <div className='text-center space-y-2'>
                      <div className='w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-500'>
                        <PieChart />
                      </div>
                      <div className='font-medium text-white'>Project</div>
                      <div className='text-sm text-zinc-500'>{formatAlgo(escrowState?.totalReleased || BigInt(0))} A</div>
                    </div>
                  </div>
                </Card>
              )}

              {activeTab === 'requests' && (
                <div className='space-y-4'>
                  {withdrawalRequests.map((req) => (
                    <Card key={req.id} noPadding className='overflow-hidden'>
                      <div className='p-6 flex justify-between items-start'>
                        <div>
                          <div className='flex items-center gap-3 mb-1'>
                            <h4 className='font-medium text-white'>Milestone #{req.id} Release</h4>
                            <ImpactBadge label={req.status} color={getStatusBadgeColor(req.status) as any} size='sm' />
                          </div>
                          <p className='text-sm text-zinc-500 font-mono'>Requested Amount: {req.amount} ALGO</p>
                        </div>
                      </div>

                      {req.aiScore > 0 && (
                        <div className='bg-zinc-900/50 px-6 py-4 border-t border-zinc-800'>
                          <div className='flex justify-between text-sm mb-2'>
                            <span className='text-zinc-400 flex items-center gap-2'><FileText className='w-4 h-4' /> AI Confidence Score</span>
                            <span className={req.aiScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                              {req.aiScore}% Probability
                            </span>
                          </div>
                          <ProgressBar progress={req.aiScore} color={req.aiScore >= 80 ? 'emerald' : 'amber'} />
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {activeTab === 'audit' && (
                <Card noPadding>
                   <div className='overflow-x-auto'>
                    <table className='w-full text-left text-sm'>
                      <thead className='bg-zinc-900/50 text-zinc-400 font-medium border-b border-zinc-800'>
                        <tr>
                          <th className='px-6 py-3'>Event Type</th>
                          <th className='px-6 py-3'>Value</th>
                          <th className='px-6 py-3'>Verification</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-zinc-800 text-zinc-300'>
                        <tr>
                          <td className='px-6 py-4 flex items-center gap-2'><History className='w-4 h-4 text-zinc-500'/> Contract Initialization</td>
                          <td className='px-6 py-4 text-zinc-500'>-</td>
                          <td className='px-6 py-4 text-emerald-400 flex items-center gap-1'><CheckCircle2 className='w-4 h-4'/> Confirmed</td>
                        </tr>
                        <tr>
                          <td className='px-6 py-4 flex items-center gap-2'><Activity className='w-4 h-4 text-zinc-500'/> Funding Injection</td>
                          <td className='px-6 py-4'>{formatAlgo(escrowState?.totalRaised || BigInt(0))} A</td>
                          <td className='px-6 py-4 text-emerald-400 flex items-center gap-1'><CheckCircle2 className='w-4 h-4'/> Confirmed</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
    </div>
  )
}

export default FundTrackerPage
