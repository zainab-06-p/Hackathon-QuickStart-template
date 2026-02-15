import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import { ArrowLeft, Globe, Users, Building2, Plus, Calendar, MapPin, Link2, Ticket, TrendingUp, Loader2 } from 'lucide-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { listenToEvents, listenToCampaigns, initializeFirebase } from '../utils/firebase'
import { getEventState, getCampaignState, type EventState, type CampaignState } from '../utils/blockchainData'

const FederationPage = () => {
  const navigate = useNavigate()
  const { transactionSigner } = useWallet()

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

  // Real-time Firebase listeners → blockchain state
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
        } catch (err) {
          console.warn(`⚠️ Could not fetch event ${fb.appId}:`, err)
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
        } catch (err) {
          console.warn(`⚠️ Could not fetch campaign ${fb.appId}:`, err)
        }
      }
      setCampaigns(states)
      setLoading(false)
    })

    // Safety timeout so page doesn't stay loading forever
    const timeout = setTimeout(() => setLoading(false), 10000)

    return () => {
      unsubEvents()
      unsubCampaigns()
      clearTimeout(timeout)
    }
  }, [algorand])

  // Derive unique organizers/creators as "network members"
  const uniqueCreators = useMemo(() => {
    const addresses = new Set<string>()
    events.forEach((e) => addresses.add(e.organizer))
    campaigns.forEach((c) => addresses.add(c.creator))
    return Array.from(addresses)
  }, [events, campaigns])

  const totalTicketsSold = useMemo(() => {
    return events.reduce((sum, e) => sum + Number(e.soldCount), 0)
  }, [events])

  const totalParticipants = useMemo(() => {
    return events.reduce((sum, e) => sum + Number(e.uniqueBuyers), 0) +
           campaigns.reduce((sum, c) => sum + Number(c.contributorCount), 0)
  }, [events, campaigns])

  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  const formatAlgo = (microAlgos: number) => (microAlgos / 1_000_000).toFixed(2)
  const formatDate = (timestamp: bigint) =>
    new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (loading && events.length === 0 && campaigns.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
          <p className="text-zinc-400 animate-pulse">Loading federation data from blockchain...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              Federation
            </h1>
          </div>
          <p className="text-zinc-400">Real-time cross-campus events and campaigns — live from blockchain</p>
        </div>
        <div className="flex items-center gap-3">
          <BrandButton onClick={() => navigate('/ticketing/create')} variant="secondary" className="flex items-center gap-2">
            <Ticket className="w-4 h-4" /> Create Event
          </BrandButton>
          <BrandButton onClick={() => navigate('/create-campaign')} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Campaign
          </BrandButton>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-indigo-500/20 bg-indigo-500/5">
        <div className="flex items-start gap-4">
          <div className="bg-indigo-500/10 p-3 rounded-lg">
            <Globe className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white mb-1">Live Campus Network</h3>
            <p className="text-sm text-zinc-400">
              {uniqueCreators.length} active wallet{uniqueCreators.length !== 1 ? 's' : ''} • {events.length} event{events.length !== 1 ? 's' : ''} • {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} — all on Algorand TestNet
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Data is fetched in real-time from Firebase metadata + Algorand smart contract state
            </p>
          </div>
        </div>
      </Card>

      {/* Stats from real data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Network Members', value: uniqueCreators.length, icon: Users, color: 'text-blue-400' },
          { label: 'Total Events', value: events.length, icon: Calendar, color: 'text-purple-400' },
          { label: 'Total Campaigns', value: campaigns.length, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Tickets Sold', value: totalTicketsSold, icon: Ticket, color: 'text-orange-400' },
        ].map((stat, i) => (
          <Card key={i}>
            <div className="flex items-center gap-3">
              <div className="bg-zinc-800 p-2 rounded-lg">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-zinc-500">{stat.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Network Members (unique creators) */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-400" /> Network Members
        </h2>
        {uniqueCreators.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-zinc-500">No network members yet. Create an event or campaign to join!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {uniqueCreators.map((addr) => {
              const memberEvents = events.filter((e) => e.organizer === addr)
              const memberCampaigns = campaigns.filter((c) => c.creator === addr)
              return (
                <Card key={addr} hoverable className="group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 font-bold text-lg">
                      {addr.substring(0, 2)}
                    </div>
                    <span className="px-2 py-0.5 text-xs rounded bg-green-500/10 text-green-500 border border-green-500/20">Active</span>
                  </div>
                  <h3 className="font-mono text-sm font-bold group-hover:text-indigo-400 transition-colors">{formatAddress(addr)}</h3>
                  <div className="mt-2 space-y-1 text-xs text-zinc-500">
                    <div>{memberEvents.length} event{memberEvents.length !== 1 ? 's' : ''} created</div>
                    <div>{memberCampaigns.length} campaign{memberCampaigns.length !== 1 ? 's' : ''} created</div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                    <Link2 className="w-3 h-3" /> On-chain verified
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Live Events */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-400" /> Live Events
        </h2>
        {events.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-zinc-500 mb-3">No events deployed yet.</p>
            <BrandButton onClick={() => navigate('/ticketing/create')} size="sm">Create First Event</BrandButton>
          </Card>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const availability = Number(event.maxSupply) - Number(event.soldCount)
              const isUpcoming = Number(event.eventDate) * 1000 > Date.now()
              return (
                <Card key={event.appId} hoverable className="cursor-pointer" onClick={() => navigate('/ticketing')}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold">{event.title}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded border ${
                            isUpcoming
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}
                        >
                          {isUpcoming ? 'UPCOMING' : 'PAST'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.venue}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(event.eventDate)}</span>
                        <span className="font-mono text-xs text-zinc-500">Organizer: {formatAddress(event.organizer)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-1">Price</div>
                      <div className="font-bold text-indigo-400">{formatAlgo(Number(event.ticketPrice))} ALGO</div>
                    </div>
                    <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-1">Sold</div>
                      <div className="font-bold text-green-400">{Number(event.soldCount)} / {Number(event.maxSupply)}</div>
                    </div>
                    <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-1">Available</div>
                      <div className="font-bold text-amber-400">{availability}</div>
                    </div>
                    <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-1">Revenue</div>
                      <div className="font-bold text-purple-400">{formatAlgo(Number(event.ticketPrice) * Number(event.soldCount))} ALGO</div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Live Campaigns */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" /> Live Campaigns
        </h2>
        {campaigns.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-zinc-500 mb-3">No campaigns deployed yet.</p>
            <BrandButton onClick={() => navigate('/create-campaign')} size="sm">Create First Campaign</BrandButton>
          </Card>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const progress =
                Number(campaign.goalAmount) > 0
                  ? (Number(campaign.raisedAmount) / Number(campaign.goalAmount)) * 100
                  : 0
              return (
                <Card key={campaign.appId} hoverable className="cursor-pointer" onClick={() => navigate(`/project/${campaign.appId}`)}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold">{campaign.title}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded border ${
                            campaign.isActive
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                          }`}
                        >
                          {campaign.isActive ? 'ACTIVE' : 'CLOSED'}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-1">{campaign.description}</p>
                      <span className="font-mono text-xs text-zinc-500">Creator: {formatAddress(campaign.creator)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-1">Goal</div>
                      <div className="font-bold text-indigo-400">{formatAlgo(Number(campaign.goalAmount))} ALGO</div>
                    </div>
                    <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-1">Raised</div>
                      <div className="font-bold text-green-400">{formatAlgo(Number(campaign.raisedAmount))} ALGO</div>
                    </div>
                    <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-1">Contributors</div>
                      <div className="font-bold text-amber-400">{Number(campaign.contributorCount)}</div>
                    </div>
                    <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
                      <div className="text-xs text-zinc-500 mb-1">Milestone</div>
                      <div className="font-bold text-purple-400">
                        {Number(campaign.currentMilestone)} / {Number(campaign.milestoneCount)}
                      </div>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 text-right">{progress.toFixed(1)}% funded</div>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default FederationPage
