import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import {
  ArrowLeft, Zap, Star, Trophy, Shield, Crown, Award, Ticket, Heart,
  Calendar, Users, Sparkles, Lock, Loader2, Wallet, AlertTriangle,
} from 'lucide-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { listenToEvents, listenToCampaigns, initializeFirebase } from '../utils/firebase'
import { getEventState, getCampaignState, type EventState, type CampaignState } from '../utils/blockchainData'

// ---- XP Constants (tune as desired) ----
const XP_PER_EVENT_CREATED = 25
const XP_PER_CAMPAIGN_CREATED = 25
const XP_PER_TICKET_SOLD = 3
const XP_PER_CONTRIBUTOR = 5
const XP_PER_ALGO_RAISED = 2 // per whole ALGO raised

interface NFTLevel {
  level: number
  name: string
  minXP: number
  color: string
  bgColor: string
  benefits: string[]
  icon: React.ReactNode
}

const NFT_LEVELS: NFTLevel[] = [
  {
    level: 1, name: 'Bronze Freshman', minXP: 0,
    color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/20',
    benefits: ['Basic event access', '5% ticket discount'],
    icon: <Award className="w-8 h-8 text-orange-400" />,
  },
  {
    level: 2, name: 'Silver Sophomore', minXP: 100,
    color: 'text-zinc-300', bgColor: 'bg-zinc-400/10 border-zinc-400/20',
    benefits: ['Priority registration', '10% ticket discount', 'Exclusive merch'],
    icon: <Shield className="w-8 h-8 text-zinc-300" />,
  },
  {
    level: 3, name: 'Gold Junior', minXP: 300,
    color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/20',
    benefits: ['VIP seating', '15% ticket discount', 'Meet & greet access', 'Voting rights'],
    icon: <Star className="w-8 h-8 text-yellow-400" />,
  },
  {
    level: 4, name: 'Platinum Senior', minXP: 600,
    color: 'text-cyan-400', bgColor: 'bg-cyan-500/10 border-cyan-500/20',
    benefits: ['Backstage access', '20% ticket discount', 'Lifetime merch', 'DAO governance'],
    icon: <Trophy className="w-8 h-8 text-cyan-400" />,
  },
  {
    level: 5, name: 'Diamond Alumni', minXP: 1000,
    color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20',
    benefits: ['All access pass', '30% ticket discount', 'Sponsor events', 'Full DAO control', 'Legacy perks'],
    icon: <Crown className="w-8 h-8 text-purple-400" />,
  },
]

const NFTEvolutionPage = () => {
  const navigate = useNavigate()
  const { activeAddress, transactionSigner } = useWallet()

  const [events, setEvents] = useState<EventState[]>([])
  const [campaigns, setCampaigns] = useState<CampaignState[]>([])
  const [loading, setLoading] = useState(true)

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()

  const algorand = useMemo(() => {
    const client = AlgorandClient.fromConfig({ algodConfig, indexerConfig })
    client.setDefaultSigner(transactionSigner)
    client.setDefaultValidityWindow(1000)
    return client
  }, [transactionSigner, algodConfig, indexerConfig])

  // Load all events and campaigns from Firebase → blockchain
  useEffect(() => {
    initializeFirebase()

    const unsubEvents = listenToEvents(async (firebaseEvents) => {
      const states: EventState[] = []
      for (const fb of firebaseEvents) {
        try {
          const metadata = {
            appId: parseInt(fb.appId),
            creator: fb.creator,
            createdAt: fb.createdAt,
            title: fb.title,
            description: fb.description,
            venue: fb.venue,
          }
          const state = await getEventState(algorand, metadata)
          if (state) states.push(state)
        } catch {
          // skip broken entries
        }
      }
      setEvents(states)
      setLoading(false)
    })

    const unsubCampaigns = listenToCampaigns(async (firebaseCampaigns) => {
      const states: CampaignState[] = []
      for (const fb of firebaseCampaigns) {
        try {
          const metadata = {
            appId: parseInt(fb.appId),
            creator: fb.creator,
            createdAt: fb.createdAt,
            title: fb.title,
            description: fb.description,
          }
          const state = await getCampaignState(algorand, metadata)
          if (state) states.push(state)
        } catch {
          // skip broken entries
        }
      }
      setCampaigns(states)
      setLoading(false)
    })

    const timeout = setTimeout(() => setLoading(false), 10000)
    return () => { unsubEvents(); unsubCampaigns(); clearTimeout(timeout) }
  }, [algorand])

  // ---- Compute user-specific stats from real data ----
  const myEvents = useMemo(
    () => (activeAddress ? events.filter((e) => e.organizer === activeAddress) : []),
    [events, activeAddress],
  )
  const myCampaigns = useMemo(
    () => (activeAddress ? campaigns.filter((c) => c.creator === activeAddress) : []),
    [campaigns, activeAddress],
  )

  const myTicketsSold = useMemo(
    () => myEvents.reduce((s, e) => s + Number(e.soldCount), 0),
    [myEvents],
  )
  const myFundsRaised = useMemo(
    () => myCampaigns.reduce((s, c) => s + Number(c.raisedAmount), 0),
    [myCampaigns],
  )
  const myContributors = useMemo(
    () => myCampaigns.reduce((s, c) => s + Number(c.contributorCount), 0),
    [myCampaigns],
  )

  // XP = real on-chain activity
  const totalXP = useMemo(() => {
    return (
      myEvents.length * XP_PER_EVENT_CREATED +
      myCampaigns.length * XP_PER_CAMPAIGN_CREATED +
      myTicketsSold * XP_PER_TICKET_SOLD +
      myContributors * XP_PER_CONTRIBUTOR +
      Math.floor(myFundsRaised / 1_000_000) * XP_PER_ALGO_RAISED
    )
  }, [myEvents, myCampaigns, myTicketsSold, myContributors, myFundsRaised])

  const currentLevel = useMemo(() => {
    for (let i = NFT_LEVELS.length - 1; i >= 0; i--) {
      if (totalXP >= NFT_LEVELS[i].minXP) return NFT_LEVELS[i]
    }
    return NFT_LEVELS[0]
  }, [totalXP])

  const nextLevel = useMemo(
    () => NFT_LEVELS.find((l) => l.level === currentLevel.level + 1) || NFT_LEVELS[NFT_LEVELS.length - 1],
    [currentLevel],
  )

  const progressToNext =
    currentLevel.level < 5
      ? ((totalXP - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100
      : 100

  const formatAlgo = (microAlgos: number) => (microAlgos / 1_000_000).toFixed(2)

  const xpBreakdown = [
    { action: 'Create Event', xpEach: XP_PER_EVENT_CREATED, count: myEvents.length, icon: <Calendar className="w-4 h-4 text-indigo-400" /> },
    { action: 'Create Campaign', xpEach: XP_PER_CAMPAIGN_CREATED, count: myCampaigns.length, icon: <Heart className="w-4 h-4 text-pink-400" /> },
    { action: 'Ticket Sold', xpEach: XP_PER_TICKET_SOLD, count: myTicketsSold, icon: <Ticket className="w-4 h-4 text-green-400" /> },
    { action: 'Contributor Gained', xpEach: XP_PER_CONTRIBUTOR, count: myContributors, icon: <Users className="w-4 h-4 text-cyan-400" /> },
    { action: 'ALGO Raised', xpEach: XP_PER_ALGO_RAISED, count: Math.floor(myFundsRaised / 1_000_000), icon: <Sparkles className="w-4 h-4 text-amber-400" /> },
  ]

  // ----- Render -----

  if (loading && events.length === 0 && campaigns.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto" />
          <p className="text-zinc-400 animate-pulse">Loading your on-chain reputation...</p>
        </div>
      </div>
    )
  }

  if (!activeAddress) {
    return (
      <div className="space-y-8 animate-fadeIn">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate('/ticketing')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
            NFT Evolution
          </h1>
        </div>
        <Card className="border-amber-500/20 bg-amber-500/5 text-center py-12">
          <Wallet className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-zinc-400 mb-4">Connect your Algorand wallet to view your on-chain reputation and XP level.</p>
          <p className="text-sm text-zinc-500">Your XP is computed from real blockchain activity — events created, tickets sold, campaigns funded.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate('/ticketing')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
              NFT Evolution
            </h1>
          </div>
          <p className="text-zinc-400">Your on-chain campus reputation — XP computed from real blockchain activity</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs rounded bg-green-500/10 text-green-400 border border-green-500/20">LIVE DATA</span>
          <span className="px-2 py-1 text-xs rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Gamification</span>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-purple-500/20 bg-purple-500/5">
        <div className="flex items-start gap-4">
          <div className="bg-purple-500/10 p-3 rounded-lg">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white mb-1">Your XP is Real!</h3>
            <p className="text-sm text-zinc-400">
              Every event you create, every ticket sold, every campaign funded — it all counts. XP is computed live from Algorand smart contract state.
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Higher levels unlock VIP access, discounts, and DAO governance power.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* NFT Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card className={`${currentLevel.bgColor}`}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Your Campus NFT</h2>
                <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-400 font-mono">
                  Wallet: {activeAddress.substring(0, 8)}...{activeAddress.substring(activeAddress.length - 4)}
                </span>
              </div>
              <div className="text-right">
                <div className={`text-5xl font-bold ${currentLevel.color}`}>{currentLevel.level}</div>
                <div className="text-xs text-zinc-500">Level</div>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className={`font-bold text-lg ${currentLevel.color}`}>{currentLevel.name}</span>
                <span className="text-sm text-zinc-400">
                  {totalXP} / {currentLevel.level < 5 ? nextLevel.minXP : currentLevel.minXP} XP
                </span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                {currentLevel.level < 5
                  ? `${nextLevel.minXP - totalXP} XP until ${nextLevel.name}`
                  : 'Max level reached!'}
              </p>
            </div>

            {/* NFT Visual */}
            <div className="bg-zinc-800/50 rounded-xl p-8 text-center border border-zinc-700/50 mb-6">
              <div className="mb-4">{currentLevel.icon}</div>
              <div className="text-6xl mb-4">
                {currentLevel.level === 1 ? '🥉' :
                 currentLevel.level === 2 ? '🥈' :
                 currentLevel.level === 3 ? '🥇' :
                 currentLevel.level === 4 ? '💎' : '👑'}
              </div>
              <p className={`font-bold text-2xl ${currentLevel.color}`}>{currentLevel.name}</p>
              <p className="text-sm text-zinc-500 mt-2">Powered by real on-chain activity</p>
            </div>

            {/* Current Benefits */}
            <div>
              <h3 className="font-bold text-lg mb-3">Current Benefits</h3>
              <div className="space-y-2">
                {currentLevel.benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                    <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span className="text-sm font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Level */}
            {currentLevel.level < 5 && (
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <h3 className="font-bold text-lg mb-3 text-zinc-400">Next Level Unlocks</h3>
                <div className="space-y-2">
                  {nextLevel.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-800/20 rounded-lg border border-zinc-800/50 opacity-60">
                      <Lock className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Stats & XP Sidebar */}
        <div className="space-y-6">
          {/* Activity Stats from real data */}
          <Card>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-indigo-400" /> Your Activity
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Events Created', value: myEvents.length, color: 'text-indigo-400' },
                { label: 'Campaigns Created', value: myCampaigns.length, color: 'text-green-400' },
                { label: 'Tickets Sold', value: myTicketsSold, color: 'text-cyan-400' },
                { label: 'Contributors Gained', value: myContributors, color: 'text-amber-400' },
                { label: 'Total Raised', value: `${formatAlgo(myFundsRaised)} ALGO`, color: 'text-purple-400' },
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">{stat.label}</span>
                  <span className={`font-bold text-lg ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>

            {myEvents.length === 0 && myCampaigns.length === 0 && (
              <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-400">
                    No activity yet! Create an event or campaign to start earning XP.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* XP Breakdown */}
          <Card className="border-indigo-500/20 bg-indigo-500/5">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-400" /> XP Breakdown
            </h3>
            <p className="text-sm text-zinc-400 mb-4">How your {totalXP} XP was earned:</p>
            <div className="space-y-2">
              {xpBreakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
                  <span className="text-sm flex items-center gap-2">
                    {item.icon}
                    {item.action}
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 mr-2">{item.count} × {item.xpEach}</span>
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                      +{item.count * item.xpEach} XP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <h3 className="font-bold text-lg mb-3">Earn More XP</h3>
            <div className="space-y-2">
              <BrandButton fullWidth size="sm" onClick={() => navigate('/ticketing/create')} className="flex items-center gap-2 justify-center">
                <Calendar className="w-4 h-4" /> Create Event (+{XP_PER_EVENT_CREATED} XP)
              </BrandButton>
              <BrandButton fullWidth size="sm" variant="secondary" onClick={() => navigate('/create-campaign')} className="flex items-center gap-2 justify-center">
                <Heart className="w-4 h-4" /> Create Campaign (+{XP_PER_CAMPAIGN_CREATED} XP)
              </BrandButton>
            </div>
          </Card>
        </div>
      </div>

      {/* Evolution Path */}
      <Card>
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Star className="w-5 h-5 text-indigo-400" /> Evolution Path
        </h3>

        {/* Desktop */}
        <div className="hidden lg:block">
          <div className="flex items-start justify-between">
            {NFT_LEVELS.map((level, idx) => (
              <div key={level.level} className="flex flex-col items-center flex-1 relative">
                {idx < NFT_LEVELS.length - 1 && (
                  <div
                    className={`absolute top-8 left-1/2 w-full h-0.5 ${
                      totalXP >= NFT_LEVELS[idx + 1].minXP ? 'bg-indigo-500' : 'bg-zinc-800'
                    }`}
                  />
                )}
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl relative z-10 border-2 ${
                    totalXP >= level.minXP
                      ? `${level.bgColor} ${level.color}`
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-600'
                  }`}
                >
                  {level.level === 1 ? '🥉' :
                   level.level === 2 ? '🥈' :
                   level.level === 3 ? '🥇' :
                   level.level === 4 ? '💎' : '👑'}
                </div>
                <p className={`font-bold mt-2 text-sm text-center ${
                  totalXP >= level.minXP ? level.color : 'text-zinc-600'
                }`}>{level.name}</p>
                <p className="text-xs text-zinc-500">{level.minXP} XP</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden space-y-3">
          {NFT_LEVELS.map((level) => (
            <div
              key={level.level}
              className={`p-4 rounded-lg border flex items-center gap-4 ${
                totalXP >= level.minXP ? level.bgColor : 'bg-zinc-800/20 border-zinc-800 opacity-50'
              }`}
            >
              <div className="text-3xl">
                {level.level === 1 ? '🥉' :
                 level.level === 2 ? '🥈' :
                 level.level === 3 ? '🥇' :
                 level.level === 4 ? '💎' : '👑'}
              </div>
              <div>
                <p className={`font-bold ${totalXP >= level.minXP ? level.color : 'text-zinc-500'}`}>{level.name}</p>
                <p className="text-xs text-zinc-500">{level.minXP} XP required</p>
              </div>
              {currentLevel.level === level.level && (
                <span className="ml-auto px-2 py-0.5 text-xs rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Current</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

export default NFTEvolutionPage
