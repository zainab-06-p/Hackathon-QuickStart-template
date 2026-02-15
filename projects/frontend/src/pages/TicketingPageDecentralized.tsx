import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import { TicketingFactory, TicketingClient } from '../contracts/TicketingClient'
import { getEventState, type EventState } from '../utils/blockchainData'
import { listenToEvents, initializeFirebase } from '../utils/firebase'
import { QRCodeSVG } from 'qrcode.react'
import TicketScanner from '../components/TicketScanner'
import algosdk from 'algosdk'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import { Calendar, MapPin, Users, Clock, ArrowLeft, Zap, Ticket, Plus, Award, Globe, Download, X, Scan, DollarSign, Wallet } from 'lucide-react'

const TicketingPageDecentralized = () => {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventState[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventState | null>(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [purchasedTicket, setPurchasedTicket] = useState<{ appId: number; assetId: bigint; holderAddress: string } | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerEventId, setScannerEventId] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [myTickets, setMyTickets] = useState<Array<{ assetId: number; eventTitle: string; eventDate: bigint }>>([])
  const [isCurrentUserOrganizer, setIsCurrentUserOrganizer] = useState(false)
  
  // Ref-based lock to prevent double-execution (synchronous check)
  const buyingRef = useRef(false)

  const { enqueueSnackbar } = useSnackbar()
  const { activeAddress, transactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  
  // Recreate algorand client when transactionSigner changes
  const algorand = useMemo(() => {
    const client = AlgorandClient.fromConfig({
      algodConfig,
      indexerConfig,
    })
    client.setDefaultSigner(transactionSigner)
    client.setDefaultValidityWindow(1000) // Set default validity window to 1000 blocks (~4 minutes, TestNet max)
    return client
  }, [transactionSigner, algodConfig, indexerConfig])

  //  FIREBASE ONLY - No blockchain discovery on page load
  // Firebase real-time listener handles ALL data synchronization
  
  // Load user's purchased tickets
  const loadMyTickets = async (eventStates: EventState[]) => {
    if (!activeAddress) return
    
    try {
      const accountInfo = await algorand.client.algod.accountInformation(activeAddress).do()
      const assets = accountInfo.assets || []
      
      const tickets: Array<{ assetId: number; eventTitle: string; eventDate: bigint }> = []
      
      for (const asset of assets) {
        if (asset.amount > 0) {
          try {
            const assetInfo = await algorand.client.algod.getAssetByID(asset.assetId).do()
            if (assetInfo.params.name === 'Event Ticket' && assetInfo.params.unitName === 'TIX') {
              const assetCreator = assetInfo.params.creator
              let matchedEvent = eventStates.find(e => {
                const factory = new TicketingFactory({ algorand, defaultSender: activeAddress })
                const appClient = factory.getAppClientById({ appId: BigInt(e.appId) })
                return String(appClient.appAddress) === assetCreator
              })
              
              tickets.push({
                assetId: Number(asset.assetId),
                eventTitle: matchedEvent?.title || 'Event Ticket',
                eventDate: matchedEvent?.eventDate || 0n
              })
            }
          } catch (e) {
            // Asset might be deleted or inaccessible, skip
          }
        }
      }
      
      setMyTickets(tickets)
    } catch (error) {
      console.error('Error loading tickets:', error)
    }
  }

  useEffect(() => {
    initializeFirebase()
    
    const loadingTimeout = setTimeout(() => {
      setLoading(false)
    }, 2000)
    
    const unsubscribeFirebase = listenToEvents(async (firebaseEvents) => {
      const eventStates: EventState[] = []
      for (const fbEvent of firebaseEvents) {
        const metadata = {
          appId: parseInt(fbEvent.appId),
          creator: fbEvent.creator,
          createdAt: fbEvent.createdAt,
          title: fbEvent.title,
          description: fbEvent.description,
          venue: fbEvent.venue,
          imageUrl: fbEvent.imageUrl // added to metadata interface in usage
        }
        const state = await getEventState(algorand, metadata)
        if (state) {
          eventStates.push(state)
        }
      }
      
      setEvents(eventStates)
      setLoading(false)
      setLastUpdated(new Date())
      clearTimeout(loadingTimeout)
      
      if (activeAddress) {
        loadMyTickets(eventStates)
      }
    })
    
    return () => {
      unsubscribeFirebase()
    }
  }, [activeAddress])

  // Check if current user is an organizer for the selected event
  useEffect(() => {
    const checkOrganizerStatus = async () => {
      if (!selectedEvent || !activeAddress) {
        setIsCurrentUserOrganizer(false)
        return
      }

      if (activeAddress === selectedEvent.organizer) {
        setIsCurrentUserOrganizer(true)
        return
      }

      try {
        const factory = new TicketingFactory({ algorand, defaultSender: activeAddress })
        const appClient = factory.getAppClientById({ appId: BigInt(selectedEvent.appId) })
        const result = await appClient.send.isOrganizer({ args: { address: activeAddress } })
        setIsCurrentUserOrganizer(result.return || false)
      } catch (error) {
        console.warn('Error checking organizer status:', error)
        setIsCurrentUserOrganizer(false)
      }
    }

    checkOrganizerStatus()
  }, [selectedEvent, activeAddress, algorand])

  const buyTicket = async () => {
    if (!selectedEvent || !activeAddress) {
      enqueueSnackbar('Please select an event and connect wallet', { variant: 'error' })
      return
    }

    if (buyingRef.current) return
    if (buying) {
      enqueueSnackbar('Transaction already in progress...', { variant: 'warning' })
      return
    }

    if (selectedEvent.soldCount >= selectedEvent.maxSupply) {
      enqueueSnackbar('Event is sold out!', { variant: 'error' })
      return
    }

    buyingRef.current = true
    setBuying(true)
    
    try {
      enqueueSnackbar(' Preparing transaction...', { variant: 'info' })

      const factory = new TicketingFactory({ algorand, defaultSender: activeAddress })
      const appClient: TicketingClient = factory.getAppClientById({ appId: BigInt(selectedEvent.appId) })
      
      const uniqueNote = `ticket-${Date.now()}-${Math.random().toString(36).substring(2)}`
      
      const paymentTxn = await algorand.createTransaction.payment({
        sender: activeAddress,
        receiver: appClient.appAddress,
        amount: algokit.microAlgos(Number(selectedEvent.ticketPrice)),
        note: new Uint8Array(Buffer.from(uniqueNote))
      })

      enqueueSnackbar(' Preparing transaction...', { variant: 'info' })

      const buyResult = await appClient.send.buyTicket({
        args: { payment: paymentTxn },
        sender: activeAddress,
        boxReferences: [{ appId: BigInt(selectedEvent.appId), name: algosdk.decodeAddress(activeAddress).publicKey }],
        populateAppCallResources: false,
        coverAppCallInnerTransactionFees: true,
        validityWindow: 1000,
        maxFee: algokit.algos(0.003),
        suppressLog: true
      })

      const ticketAssetId = buyResult.return as bigint
      enqueueSnackbar(` Ticket reserved! Asset ID: ${ticketAssetId}`, { variant: 'success' })
      
      setPurchasedTicket({
        appId: selectedEvent.appId,
        assetId: ticketAssetId,
        holderAddress: activeAddress
      })
      
      enqueueSnackbar(' Please approve opt-in...', { variant: 'info' })
      await algorand.send.assetOptIn({
        sender: activeAddress,
        assetId: ticketAssetId,
        validityWindow: 1000
      })
      
      enqueueSnackbar(' Opted in! Claiming ticket...', { variant: 'info' })
      
      await appClient.send.claimTicket({
        args: { ticketAssetId },
        sender: activeAddress,
        assetReferences: [ticketAssetId],
        boxReferences: [{ appId: BigInt(selectedEvent.appId), name: algosdk.decodeAddress(activeAddress).publicKey }],
        populateAppCallResources: false,
        coverAppCallInnerTransactionFees: true,
        validityWindow: 1000,
        maxFee: algokit.algos(0.002),
        suppressLog: true
      })
      
      enqueueSnackbar(` Ticket claimed successfully!`, { variant: 'success' })
      enqueueSnackbar(' Check "My Tickets" section!', { variant: 'success' })
      
      // Update event state
      const updated = await getEventState(algorand, {
        appId: selectedEvent.appId,
        creator: selectedEvent.organizer,
        createdAt: 0,
        title: selectedEvent.title,
        description: selectedEvent.description,
        venue: selectedEvent.venue,
        imageUrl: selectedEvent.imageUrl
      })
      if (updated) setSelectedEvent(updated)
      
    } catch (e) {
      console.error('Purchase error:', e)
      const errorMsg = (e as Error).message
      
      if (errorMsg.includes('txn dead') || errorMsg.includes('round') || errorMsg.includes('outside')) {
        enqueueSnackbar(' Transaction expired. Check "My Tickets" section if ticket was created.', { variant: 'warning' })
      } else {
        enqueueSnackbar(`Purchase failed: ${errorMsg}`, { variant: 'error' })
      }
    } finally {
      setTimeout(() => {
        buyingRef.current = false
        setBuying(false)
      }, 2000)
    }
  }

  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  const formatAlgo = (microAlgos: bigint) => (Number(microAlgos) / 1_000_000).toFixed(2)
  const formatDate = (timestamp: bigint) => new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  // Loading State
  if (loading && events.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-zinc-400 animate-pulse">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              Ticketing
            </h1>
          </div>
          <p className="text-zinc-400">Decentralized event management and NFT ticketing</p>
        </div>
        
        <div className="flex items-center gap-3">
          <BrandButton 
            onClick={() => navigate('/ticketing/nft-evolution')}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            Evolution
          </BrandButton>
          <BrandButton 
            onClick={() => navigate('/ticketing/create')}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </BrandButton>
        </div>
      </div>

      {/* Connection Info Bar */}
      <div className="flex items-center justify-between text-xs text-zinc-500 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
        <div className="flex items-center gap-4">
           <span className="flex items-center gap-1.5">
             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
             TestNet
           </span>
           {lastUpdated && <span>Updated: {lastUpdated.toLocaleTimeString()}</span>}
        </div>
        {activeAddress && (
          <div className="flex items-center gap-2">
            <Wallet className="w-3 h-3" />
            {formatAddress(activeAddress)}
          </div>
        )}
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card noPadding className="p-4 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border-indigo-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-sm text-zinc-400">Total Events</span>
          </div>
          <div className="text-2xl font-bold">{events.length}</div>
        </Card>
        
        <Card noPadding className="p-4 bg-gradient-to-br from-pink-900/20 to-rose-900/20 border-pink-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-pink-500/10 rounded-lg text-pink-400">
              <Ticket className="w-5 h-5" />
            </div>
            <span className="text-sm text-zinc-400">Tickets Sold</span>
          </div>
          <div className="text-2xl font-bold">{events.reduce((sum, e) => sum + Number(e.soldCount), 0)}</div>
        </Card>
        
        <Card noPadding className="p-4 bg-gradient-to-br from-orange-900/20 to-amber-900/20 border-orange-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-sm text-zinc-400">Attendees</span>
          </div>
          <div className="text-2xl font-bold">{events.reduce((sum, e) => sum + Number(e.uniqueBuyers), 0)}</div>
        </Card>
        
        <Card noPadding className="p-4 bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-blue-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-sm text-zinc-400">Active</span>
          </div>
          <div className="text-2xl font-bold">{events.filter(e => e.isSaleActive).length}</div>
        </Card>
      </div>

      {/* Feature Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card hoverable={true} className="cursor-pointer group relative overflow-hidden" onClick={() => navigate('/ticketing/nft-evolution')}>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="font-bold text-lg flex items-center gap-2 mb-2 text-indigo-400">
            <Award className="w-5 h-5" /> NFT Evolution
          </h3>
          <p className="text-sm text-zinc-400">Tickets level up! Earn XP by attending events. Bronze  Silver  Gold.</p>
        </Card>
        
        <Card hoverable={true} className="cursor-pointer group relative overflow-hidden" onClick={() => navigate('/federation')}>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="font-bold text-lg flex items-center gap-2 mb-2 text-blue-400">
            <Globe className="w-5 h-5" /> Cross-Campus Federation
          </h3>
          <p className="text-sm text-zinc-400">Multi-college events with shared ticketing reputation.</p>
        </Card>
      </div>

      {/* My Tickets */}
      {activeAddress && myTickets.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-indigo-500" /> My Tickets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {myTickets.map((ticket) => (
              <Card key={ticket.assetId} className="border-indigo-500/30">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold truncate pr-2">{ticket.eventTitle}</h3>
                  <span className="text-xs font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                    ID: {ticket.assetId}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                  {ticket.eventDate > 0 ? formatDate(ticket.eventDate) : 'Date TBA'}
                </p>
                <BrandButton 
                  size="sm" 
                  variant="secondary"
                  fullWidth={true}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPurchasedTicket({ appId: 0, assetId: BigInt(ticket.assetId), holderAddress: activeAddress })
                  }}
                >
                  View QR Code
                </BrandButton>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Events Grid */}
      <section>
        <h2 className="text-xl font-bold mb-4">Upcoming Events</h2>
        
        {events.length === 0 ? (
           <Card className="text-center py-12">
             <div className="bg-zinc-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <Calendar className="w-8 h-8 text-zinc-600" />
             </div>
             <h3 className="text-lg font-bold mb-2">No events yet</h3>
             <p className="text-zinc-500 mb-4">Create the first event on the platform.</p>
             <BrandButton onClick={() => navigate('/ticketing/create')}>
               Create Event
             </BrandButton>
           </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const availability = Number(event.maxSupply) - Number(event.soldCount)
              const percentage = (Number(event.soldCount) / Number(event.maxSupply)) * 100
              const isUpcoming = Number(event.eventDate) * 1000 > Date.now()
              const saleStillOpen = Number(event.saleEndDate) * 1000 > Date.now()
              
              return (
                <Card 
                  key={event.appId} 
                  hoverable={true}
                  className="cursor-pointer group flex flex-col h-full"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold truncate pr-2 group-hover:text-indigo-400 transition-colors">
                      {event.title}
                    </h3>
                    {!isUpcoming ? (
                      <span className="px-2 py-0.5 text-xs rounded bg-red-500/10 text-red-500 border border-red-500/20">Past</span>
                    ) : availability === 0 ? (
                      <span className="px-2 py-0.5 text-xs rounded bg-red-500/10 text-red-500 border border-red-500/20">Sold Out</span>
                    ) : !saleStillOpen ? (
                      <span className="px-2 py-0.5 text-xs rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">Closed</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-500/10 text-green-500 border border-green-500/20">Active</span>
                    )}
                  </div>
                  
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-4 flex-grow">{event.description}</p>
                  
                  <div className="space-y-2 text-sm text-zinc-300 mb-4">
                    <div className="flex items-center gap-2">
                       <MapPin className="w-4 h-4 text-zinc-500" /> {event.venue}
                    </div>
                    <div className="flex items-center gap-2">
                       <Clock className="w-4 h-4 text-zinc-500" /> {formatDate(event.eventDate)}
                    </div>
                    <div className="flex items-center gap-2">
                       <DollarSign className="w-4 h-4 text-zinc-500" /> 
                       <span className="font-mono text-indigo-400">{formatAlgo(event.ticketPrice)} ALGO</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-zinc-800">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>{availability} left</span>
                      <span>{Number(event.soldCount)}/{Number(event.maxSupply)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${availability === 0 ? 'bg-zinc-600' : 'bg-indigo-500'}`} 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center mt-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {Number(event.uniqueBuyers)}
                      </span>
                      <span className="font-mono">ID: {event.appId}</span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <Card className="relative overflow-visible">
              <button 
                onClick={() => setSelectedEvent(null)}
                className="absolute right-4 top-4 p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">{selectedEvent.title}</h2>
                <div className="flex flex-wrap gap-2 text-sm text-zinc-400">
                   <span className="bg-zinc-800 px-2 py-1 rounded">Organizer: {formatAddress(selectedEvent.organizer)}</span>
                   <span className="bg-zinc-800 px-2 py-1 rounded">ID: {selectedEvent.appId}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="md:col-span-2 space-y-6">
                  <div className="prose prose-invert max-w-none">
                    <h3 className="text-lg font-semibold text-white mb-2">About Event</h3>
                    <p className="text-zinc-400 whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-800">
                       <div className="flex items-center gap-2 mb-1 text-zinc-400 text-sm">
                         <MapPin className="w-4 h-4" /> Venue
                       </div>
                       <div className="font-semibold">{selectedEvent.venue}</div>
                    </div>
                    <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-800">
                       <div className="flex items-center gap-2 mb-1 text-zinc-400 text-sm">
                         <Clock className="w-4 h-4" /> Date & Time
                       </div>
                       <div className="font-semibold">{formatDate(selectedEvent.eventDate)}</div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-1 space-y-4">
                   <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                      <div className="text-center mb-4">
                         <div className="text-zinc-400 text-sm mb-1">Price</div>
                         <div className="text-3xl font-bold text-indigo-400">
                           {formatAlgo(selectedEvent.ticketPrice)} <span className="text-lg text-zinc-500">ALGO</span>
                         </div>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-400">Availability</span>
                          <span>{Number(selectedEvent.maxSupply) - Number(selectedEvent.soldCount)} / {Number(selectedEvent.maxSupply)}</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-700 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-indigo-500 rounded-full" 
                             style={{ width: `${(Number(selectedEvent.soldCount) / Number(selectedEvent.maxSupply)) * 100}%` }}
                           />
                        </div>
                      </div>

                      {(() => {
                        const now = Date.now()
                        const saleEnded = Number(selectedEvent.saleEndDate) * 1000 < now
                        const eventPassed = Number(selectedEvent.eventDate) * 1000 < now
                        
                        if (eventPassed) return <div className="p-2 bg-red-500/10 text-red-400 text-center rounded text-sm">Event finished</div>
                        if (saleEnded) return <div className="p-2 bg-orange-500/10 text-orange-400 text-center rounded text-sm">Sales ended</div>
                        if (!selectedEvent.isSaleActive) return <div className="p-2 bg-orange-500/10 text-orange-400 text-center rounded text-sm">Sales paused</div>
                        if (Number(selectedEvent.maxSupply) <= Number(selectedEvent.soldCount)) return <div className="p-2 bg-red-500/10 text-red-400 text-center rounded text-sm">Sold Out</div>

                        return (
                          <BrandButton 
                            fullWidth={true}
                            size="lg"
                            onClick={buyTicket}
                            isLoading={buying}
                            disabled={!activeAddress}
                          >
                             {activeAddress ? 'Confirm Purchase' : 'Connect Wallet'}
                          </BrandButton>
                        )
                      })()}
                   </div>
                   
                   {/* Organizer Tools */}
                   {isCurrentUserOrganizer && (
                     <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 space-y-3">
                       <h4 className="font-bold text-indigo-400 flex items-center gap-2">
                         <Zap className="w-4 h-4" /> Organizer Tools
                       </h4>
                       <BrandButton 
                         variant="outline" 
                         fullWidth={true}
                         size="sm"
                         onClick={() => { setScannerEventId(selectedEvent.appId); setScannerOpen(true); }}
                         className="flex items-center gap-2 justify-center"
                       >
                         <Scan className="w-4 h-4" /> Scan Tickets
                       </BrandButton>
                       <BrandButton 
                         variant="secondary"
                         fullWidth={true}
                         size="sm"
                         onClick={async () => {
                            if (!activeAddress) return
                            try {
                              const factory = new TicketingFactory({ algorand, defaultSender: activeAddress })
                              const appClient = factory.getAppClientById({ appId: BigInt(selectedEvent.appId) })
                              await appClient.send.toggleSale({ args: [] })
                              enqueueSnackbar(`Sales ${selectedEvent.isSaleActive ? 'closed' : 'reopened'}`, { variant: 'success' })
                              const updated = await getEventState(algorand, selectedEvent)
                              if (updated) setSelectedEvent(updated)
                            } catch(e) { console.error(e) }
                         }}
                       >
                         {selectedEvent.isSaleActive ? 'Pause Sales' : 'Resume Sales'}
                       </BrandButton>
                     </div>
                   )}
                </div>
              </div>
            </Card>
          </div>
          <div className="fixed inset-0 -z-10" onClick={() => setSelectedEvent(null)} />
        </div>
      )}

      {/* Ticket QR Modal */}
      {purchasedTicket && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <Card className="max-w-sm w-full bg-zinc-900 border-zinc-700 relative overflow-visible">
              <button 
                onClick={() => setPurchasedTicket(null)}
                className="absolute -right-3 -top-3 p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors border border-zinc-700"
                type="button"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">Your Ticket</h3>
                <p className="text-sm text-zinc-400">Scan this code at the venue</p>
              </div>

              <div className="bg-white p-4 rounded-xl mb-6 mx-auto w-fit" id="qr-code-container">
                  <QRCodeSVG 
                    value={`ALGO_TICKET_${purchasedTicket.appId}_${purchasedTicket.assetId}_${purchasedTicket.holderAddress}`}
                    size={200}
                    level="H"
                    id="ticket-qr-code"
                  />
              </div>

              <div className="text-center space-y-4">
                 <div className="text-xs font-mono bg-zinc-800 py-2 rounded text-zinc-400">
                   Asset ID: {purchasedTicket.assetId.toString()}
                 </div>
                 <BrandButton 
                   fullWidth={true}
                   onClick={() => {
                      const svg = document.getElementById('ticket-qr-code') as unknown as SVGElement
                      if (svg) {
                        const canvas = document.createElement('canvas')
                        const ctx = canvas.getContext('2d')
                        const svgData = new XMLSerializer().serializeToString(svg)
                        const img = new Image()
                        canvas.width = 256; canvas.height = 256
                        img.onload = () => {
                          ctx?.drawImage(img, 0, 0)
                          const link = document.createElement('a')
                          link.download = `ticket-${purchasedTicket.assetId}.png`
                          link.href = canvas.toDataURL('image/png')
                          link.click()
                          enqueueSnackbar('Saved!', { variant: 'success' })
                        }
                        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
                      }
                   }}
                   className="flex items-center gap-2 justify-center"
                 >
                   <Download className="w-4 h-4" /> Save to Photos
                 </BrandButton>
              </div>
           </Card>
        </div>
      )}

      {/* Scanner Wrapper */}
      {scannerOpen && scannerEventId && (
        <TicketScanner
          appId={scannerEventId}
          onVerified={(assetId) => console.log('Verified', assetId)}
          onClose={() => { setScannerOpen(false); setScannerEventId(null); }}
        />
      )}
    </div>
  )
}

export default TicketingPageDecentralized
