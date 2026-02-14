import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import { TicketingFactory, TicketingClient } from '../contracts/TicketingClient'
import { ContractRegistry } from '../utils/contractRegistry'
import { getEventState, type EventState } from '../utils/blockchainData'
import { listenToEvents, initializeFirebase } from '../utils/firebase'
import { QRCodeSVG } from 'qrcode.react'
import TicketScanner from '../components/TicketScanner'
import algosdk from 'algosdk'

const TicketingPageDecentralized = () => {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventState[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventState | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [purchasedTicket, setPurchasedTicket] = useState<{ appId: number; assetId: bigint; holderAddress: string } | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerEventId, setScannerEventId] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [myTickets, setMyTickets] = useState<Array<{ assetId: number; eventTitle: string; eventDate: bigint }>>([])
  
  // Ref-based lock to prevent double-execution (synchronous check)
  const buyingRef = useRef(false)

  const { enqueueSnackbar } = useSnackbar()
  const { activeAccount, activeAddress, transactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  
  // Recreate algorand client when transactionSigner changes
  const algorand = useMemo(() => {
    const client = AlgorandClient.fromConfig({
      algodConfig,
      indexerConfig,
    })
    client.setDefaultSigner(transactionSigner)
    return client
  }, [transactionSigner, algodConfig, indexerConfig])

  // 🔥 FIREBASE ONLY - No blockchain discovery on page load
  // Firebase real-time listener handles ALL data synchronization
  // No manual refresh or blockchain discovery needed!
  
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
            // Check if this is an event ticket NFT
            if (assetInfo.params.name === 'Event Ticket' && assetInfo.params.unitName === 'TIX') {
              // Find the corresponding event by matching the asset creator (app address) with event app addresses
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
              
              console.log('Found ticket:', {
                assetId: asset.assetId,
                creator: assetCreator,
                matchedEvent: matchedEvent?.title
              })
            }
          } catch (e) {
            console.error('Error loading asset info:', e)
            // Asset might be deleted or inaccessible, skip
          }
        }
      }
      
      console.log('Total tickets found:', tickets.length)
      setMyTickets(tickets)
    } catch (error) {
      console.error('Error loading tickets:', error)
    }
  }

  useEffect(() => {
    // 🔥 Real-time Firebase listener for instant cross-device sync
    // This is the PRIMARY and ONLY data source - it handles all updates automatically
    // No manual refresh needed - Firebase keeps everything in sync!
    initializeFirebase()
    const unsubscribeFirebase = listenToEvents(async (firebaseEvents) => {
      console.log(`🔥 Firebase events updated: ${firebaseEvents.length} events`)
      
      // Merge Firebase events with blockchain state
      const eventStates: EventState[] = []
      for (const fbEvent of firebaseEvents) {
        const metadata = {
          appId: parseInt(fbEvent.appId),
          creator: fbEvent.creator,
          createdAt: fbEvent.createdAt,
          title: fbEvent.title,
          description: fbEvent.description,
          venue: fbEvent.venue
        }
        const state = await getEventState(algorand, metadata)
        if (state) {
          eventStates.push(state)
        }
      }
      
      setEvents(eventStates)
      setLoading(false) // Mark loading complete after Firebase data loads
      
      // Load user's tickets if wallet is connected
      if (activeAddress) {
        loadMyTickets(eventStates)
      }
    })
    
    return () => {
      unsubscribeFirebase()
    }
  }, [])

  const buyTicket = async () => {
    if (!selectedEvent || !activeAddress) {
      enqueueSnackbar('Please select an event and connect wallet', { variant: 'error' })
      return
    }

    // Synchronous ref check to prevent double-execution
    if (buyingRef.current) {
      console.log('Purchase already in progress (ref check)')
      return
    }

    if (buying) {
      enqueueSnackbar('Transaction already in progress, please wait...', { variant: 'warning' })
      return
    }

    if (selectedEvent.soldCount >= selectedEvent.maxSupply) {
      enqueueSnackbar('Event is sold out!', { variant: 'error' })
      return
    }

    // Check if user already has a ticket for this event
    try {
      const accountInfo = await algorand.client.algod.accountInformation(activeAddress).do()
      const assets = accountInfo.assets || []
      
      // Check if any asset is a ticket for this event by checking creator/reserve
      for (const asset of assets) {
        if (asset.amount > 0) {
          try {
            const assetInfo = await algorand.client.algod.getAssetByID(asset.assetId).do()
            // Check if this asset's reserve address matches the user (our ticket marking system)
            if (assetInfo.params.reserve === activeAddress && assetInfo.params.name === 'Event Ticket') {
              // This might be a ticket - let's allow multiple tickets for now but warn
              // For strict 1-ticket limit, uncomment below:
              // enqueueSnackbar('You already have a ticket for this event!', { variant: 'warning' })
              // return
            }
          } catch (e) {
            // Asset might be deleted or inaccessible, skip
          }
        }
      }
    } catch (error) {
      console.error('Error checking existing tickets:', error)
      // Continue with purchase even if check fails
    }

    // Set both locks immediately
    buyingRef.current = true
    setBuying(true)
    
    try {
      enqueueSnackbar('✍️ Preparing transaction...', { variant: 'info' })

      const factory = new TicketingFactory({
        algorand,
        defaultSender: activeAddress,
      })

      const appClient: TicketingClient = factory.getAppClientById({
        appId: BigInt(selectedEvent.appId)
      })
      
      // Generate unique note for tracking
      const uniqueNote = `ticket-${Date.now()}-${Math.random().toString(36).substring(2)}`
      
      // Create payment transaction
      const paymentTxn = await algorand.createTransaction.payment({
        sender: activeAddress,
        receiver: appClient.appAddress,
        amount: algokit.microAlgos(Number(selectedEvent.ticketPrice)),
        note: new Uint8Array(Buffer.from(uniqueNote))
      })

      enqueueSnackbar('📤 Preparing transaction...', { variant: 'info' })

      // Step 1: Buy ticket (creates NFT, keeps in contract, returns asset ID)
      const buyResult = await appClient.send.buyTicket({
        args: {
          payment: paymentTxn
        },
        sender: activeAddress,
        boxReferences: [
          {
            appId: BigInt(selectedEvent.appId),
            name: algosdk.decodeAddress(activeAddress).publicKey
          }
        ],
        populateAppCallResources: false,
        coverAppCallInnerTransactionFees: true,
        validityWindow: 1000,  // ~4 minutes for signing (TestNet max)
        maxFee: algokit.algos(0.003),
        suppressLog: true
      })

      const ticketAssetId = buyResult.return as bigint
      console.log('✅ Ticket created with Asset ID:', ticketAssetId)
      enqueueSnackbar(`✅ Ticket reserved! Asset ID: ${ticketAssetId}`, { variant: 'success' })
      
      // Store ticket info immediately in case later steps fail
      setPurchasedTicket({
        appId: selectedEvent.appId,
        assetId: ticketAssetId,
        holderAddress: activeAddress
      })
      
      // Step 2: Opt-in to the ticket NFT
      enqueueSnackbar('📝 Please approve opt-in to claim your ticket...', { variant: 'info' })
      await algorand.send.assetOptIn({
        sender: activeAddress,
        assetId: ticketAssetId,
        validityWindow: 1000  // ~4 minutes for signing (TestNet max)
      })
      
      enqueueSnackbar('✅ Opted in! Claiming ticket...', { variant: 'info' })
      
      // Step 3: Claim the ticket from contract (must specify asset in foreign assets)
      await appClient.send.claimTicket({
        args: {
          ticketAssetId
        },
        sender: activeAddress,
        assetReferences: [ticketAssetId],  // Manually add asset reference
        boxReferences: [
          {
            appId: BigInt(selectedEvent.appId),
            name: algosdk.decodeAddress(activeAddress).publicKey
          }
        ],
        populateAppCallResources: false,
        coverAppCallInnerTransactionFees: true,  // Cover inner transaction fee
        validityWindow: 1000,  // ~4 minutes for signing (TestNet max)
        maxFee: algokit.algos(0.002),  // Extra fee for inner asset transfer
        suppressLog: true
      })
      
      enqueueSnackbar(`🎫 Ticket claimed successfully!`, { variant: 'success' })

      // Ticket info already stored above - QR code should be showing now
      
      // Small delay to ensure blockchain state is updated
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Firebase will automatically update the event state
      enqueueSnackbar('🔥 Check "My Tickets" section for your QR code!', { variant: 'success' })
      
      // Update selected event
      const updated = await getEventState(algorand, {
        appId: selectedEvent.appId,
        creator: selectedEvent.organizer,
        createdAt: 0,
        title: selectedEvent.title,
        description: selectedEvent.description,
        venue: selectedEvent.venue
      })
      if (updated) setSelectedEvent(updated)
      
    } catch (e) {
      console.error('Purchase error:', e)
      const errorMsg = (e as Error).message
      
      if (errorMsg.includes('txn dead') || errorMsg.includes('round') || errorMsg.includes('outside')) {
        enqueueSnackbar('⏰ Transaction expired (took too long to sign). If ticket was created, check "My Tickets" section.', { variant: 'warning' })
        // Reload tickets to check if purchase succeeded
        const updated = await getEventState(algorand, {
          appId: selectedEvent.appId,
          creator: selectedEvent.organizer,
          createdAt: 0,
          title: selectedEvent.title,
          description: selectedEvent.description,
          venue: selectedEvent.venue
        })
        if (updated) {
          setSelectedEvent(updated)
          loadMyTickets([updated])
        }
      } else if (errorMsg.includes('already in ledger')) {
        // Transaction succeeded but we got an error after - Firebase will sync
        enqueueSnackbar('⚠️ Transaction may have succeeded. Check "My Tickets" section!', { variant: 'warning' })
        if (selectedEvent) {
          const updated = await getEventState(algorand, {
            appId: selectedEvent.appId,
            creator: selectedEvent.organizer,
            createdAt: 0,
            title: selectedEvent.title,
            description: selectedEvent.description,
            venue: selectedEvent.venue
          })
          if (updated) setSelectedEvent(updated)
        }
      } else if (errorMsg.includes('rejected') || errorMsg.includes('cancelled') || errorMsg.includes('user')) {
        enqueueSnackbar('Transaction cancelled by user', { variant: 'info' })
      } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        enqueueSnackbar('Contract method not found - contract may need updating', { variant: 'error' })
      } else {
        enqueueSnackbar(`Purchase failed: ${errorMsg}`, { variant: 'error' })
      }
    } finally {
      // Release locks after a delay to prevent rapid double-clicks
      setTimeout(() => {
        buyingRef.current = false
        setBuying(false)
      }, 2000)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  }

  const formatAlgo = (microAlgos: bigint) => {
    return (Number(microAlgos) / 1_000_000).toFixed(2)
  }

  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && events.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-lg font-semibold">Loading events from blockchain...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 animate-gradient-shift">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg border-b-4 border-gradient-to-r from-purple-500 to-pink-500">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-5">
          {/* Top row: Back button + Title + Refresh */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 md:gap-4 flex-1">
              <button 
                onClick={() => navigate('/')} 
                className="btn btn-ghost btn-xs sm:btn-sm"
              >
                ← Back
              </button>
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">🎫 Ticketing</h1>
            </div>
            <button 
              onClick={() => enqueueSnackbar('🔥 Firebase keeps everything synced automatically!', { variant: 'info' })} 
              className="btn btn-xs sm:btn-sm btn-ghost hover:btn-primary"
            >
              ⚡ <span className="hidden sm:inline">Auto-Synced</span>
            </button>
          </div>
          
          {/* Bottom row: Action buttons + Status badges */}
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => navigate('/ticketing/create')} 
                className="btn btn-primary btn-xs sm:btn-sm hover:scale-110 transition-transform duration-300 shadow-lg bg-gradient-to-r from-purple-500 to-pink-500 border-0"
              >
                ✨ Create
              </button>
              <button 
                onClick={() => navigate('/ticketing/nft-evolution')} 
                className="btn btn-xs sm:btn-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 hover:scale-110 transition-transform"
              >
                ⚡ <span className="hidden sm:inline">Evolution</span>
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
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="stat bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-purple-500/50">
            <div className="stat-title text-purple-100">Total Events</div>
            <div className="stat-value text-white text-5xl">{events.length}</div>
            <div className="stat-desc text-purple-100">🎉 On-chain contracts</div>
          </div>
          <div className="stat bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-pink-500/50">
            <div className="stat-title text-pink-100">Tickets Sold</div>
            <div className="stat-value text-white text-5xl">
              {events.reduce((sum, e) => sum + Number(e.soldCount), 0)}
            </div>
            <div className="stat-desc text-pink-100">🎫 NFT tickets minted</div>
          </div>
          <div className="stat bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-orange-500/50">
            <div className="stat-title text-orange-100">Total Attendees</div>
            <div className="stat-value text-white text-5xl">
              {events.reduce((sum, e) => sum + Number(e.uniqueBuyers), 0)}
            </div>
            <div className="stat-desc text-orange-100">👥 Unique buyers</div>
          </div>
          <div className="stat bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-blue-500/50">
            <div className="stat-title text-blue-100">Active Events</div>
            <div className="stat-value text-white text-5xl">
              {events.filter(e => e.isSaleActive).length}
            </div>
            <div className="stat-desc text-blue-100">🔥 Sale active</div>
          </div>
        </div>

        {/* Advanced Features Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <div className="card bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl hover:scale-105 transition-all cursor-pointer" onClick={() => navigate('/ticketing/nft-evolution')}>
            <div className="card-body p-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                ⚡ NFT Evolution (Gamification)
                <span className="badge badge-sm bg-white/20 border-white/30">NEW</span>
              </h3>
              <p className="text-sm text-white/90">Your ticket NFTs level up! Bronze → Silver → Gold → Platinum → Diamond. Earn XP by attending events, get discounts & VIP access.</p>
            </div>
          </div>
          <div className="card bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xl hover:scale-105 transition-all cursor-pointer" onClick={() => navigate('/federation')}>
            <div className="card-body p-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                🌐 Cross-Campus Federation
                <span className="badge badge-sm bg-white/20 border-white/30">NEW</span>
              </h3>
              <p className="text-sm text-white/90">Multi-college events with shared ticketing. Your reputation follows you across VIT, MIT, SRM, SASTRA.</p>
            </div>
          </div>
        </div>

        {/* My Tickets Section */}
        {activeAddress && myTickets.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              🎫 My Tickets ({myTickets.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {myTickets.map((ticket) => (
                <div key={ticket.assetId} className="card bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-xl">
                  <div className="card-body">
                    <h3 className="font-bold">{ticket.eventTitle}</h3>
                    <p className="text-sm opacity-90">
                      📅 {ticket.eventDate > 0 ? formatDate(ticket.eventDate) : 'Date TBA'}
                    </p>
                    <p className="text-xs opacity-75">Asset ID: {ticket.assetId}</p>
                    <button
                      className="btn btn-sm bg-white/20 border-white/30 hover:bg-white/30 mt-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPurchasedTicket({
                          appId: 0, // Not needed for viewing QR
                          assetId: BigInt(ticket.assetId),
                          holderAddress: activeAddress
                        })
                      }}
                    >
                      View QR Code
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cross-Device Sync Info Banner */}
        <div className="alert alert-info shadow-lg mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current flex-shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 className="font-bold">Cross-Device Discovery Info</h3>
            <div className="text-sm">
              New events are visible immediately on the same device. For other devices, the Algorand blockchain indexer needs 30-60 seconds to sync. 
              Click the <span className="font-bold">🔄 Refresh</span> button or switch back to this tab to force an update.
            </div>
          </div>
        </div>

        {/* Events Grid */}
        <h2 className="text-2xl font-bold mb-4">Upcoming Events ({events.length})</h2>
        {events.length === 0 ? (
          <div className="card bg-white shadow-xl">
            <div className="card-body text-center py-12">
              <h3 className="text-xl font-bold mb-2">No events yet!</h3>
              <p className="text-gray-600">Click "➕ Create Event" above to deploy your first ticketing smart contract.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {events.map((event) => {
              const availability = Number(event.maxSupply) - Number(event.soldCount)
              const soldPercentage = (Number(event.soldCount) / Number(event.maxSupply)) * 100
              const isUpcoming = Number(event.eventDate) * 1000 > Date.now()
              const saleStillOpen = Number(event.saleEndDate) * 1000 > Date.now()
              const canBuyTickets = event.isSaleActive && saleStillOpen && isUpcoming && availability > 0
              
              return (
                <div 
                  key={event.appId}
                  className="card bg-white shadow-xl hover:shadow-2xl transition-all cursor-pointer"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="card-body">
                    <div className="flex justify-between items-start">
                      <h3 className="card-title text-lg">{event.title}</h3>
                      {!isUpcoming ? (
                        <div className="badge badge-error">Past</div>
                      ) : availability === 0 ? (
                        <div className="badge badge-error">Sold Out</div>
                      ) : !saleStillOpen ? (
                        <div className="badge badge-warning">Sales Ended</div>
                      ) : canBuyTickets ? (
                        <div className="badge badge-success">On Sale</div>
                      ) : (
                        <div className="badge badge-warning">Sales Closed</div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
                    
                    <div className="space-y-2 mt-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xl">📍</span>
                        <span>{event.venue}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xl">📅</span>
                        <span>{formatDate(event.eventDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-xl">💰</span>
                        <span className="font-bold">{formatAlgo(event.ticketPrice)} ALGO</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span>{availability} tickets left</span>
                        <span className="text-gray-500">{Number(event.soldCount)}/{Number(event.maxSupply)}</span>
                      </div>
                      <progress 
                        className={`progress ${availability === 0 ? 'progress-error' : 'progress-success'} w-full`}
                        value={soldPercentage} 
                        max="100"
                      />
                    </div>

                    <div className="flex justify-between items-center mt-4">
                      <div className="badge badge-info badge-outline">
                        👥 {Number(event.uniqueBuyers)} attending
                      </div>
                      <div className="text-xs font-mono">ID: {event.appId}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Event Detail Modal */}
        {selectedEvent && (
          <dialog id="event_modal" className="modal modal-open">
            <div className="modal-box max-w-4xl w-full mx-4">
              <button 
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => setSelectedEvent(null)}
              >
                ✕
              </button>
              
              <h3 className="font-bold text-xl md:text-2xl mb-2">{selectedEvent.title}</h3>
              <p className="text-sm md:text-base text-gray-600 mb-4">{selectedEvent.description}</p>
              
              {/* Event Info Card */}
              <div className="card bg-gradient-to-r from-blue-500 to-cyan-500 text-white mb-4">
                <div className="card-body">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm opacity-90">Venue</p>
                      <p className="text-base md:text-xl font-bold">📍 {selectedEvent.venue}</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Date & Time</p>
                      <p className="text-base md:text-xl font-bold">📅 {formatDate(selectedEvent.eventDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Sales End</p>
                      <p className="text-base md:text-xl font-bold">⏰ {formatDate(selectedEvent.saleEndDate)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm opacity-90">Ticket Price</p>
                      <p className="text-xl md:text-2xl font-bold">💰 {formatAlgo(selectedEvent.ticketPrice)} ALGO</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Availability</p>
                      <p className="text-xl md:text-2xl font-bold">
                        {Number(selectedEvent.maxSupply) - Number(selectedEvent.soldCount)}/{Number(selectedEvent.maxSupply)}
                      </p>
                    </div>
                  </div>
                  <progress 
                    className="progress progress-accent w-full h-3 mt-4" 
                    value={Number(selectedEvent.soldCount)} 
                    max={Number(selectedEvent.maxSupply)}
                  />
                  <p className="text-sm opacity-90 mt-2">
                    {((Number(selectedEvent.soldCount) / Number(selectedEvent.maxSupply)) * 100).toFixed(0)}% Sold
                  </p>
                </div>
              </div>

              {/* Buy Ticket Button - Always Show for Students */}
              {Number(selectedEvent.maxSupply) - Number(selectedEvent.soldCount) > 0 ? (
                <div className="space-y-2 mb-4">
                  {(() => {
                    const now = Date.now()
                    const saleEnded = Number(selectedEvent.saleEndDate) * 1000 < now
                    const eventPassed = Number(selectedEvent.eventDate) * 1000 < now
                    
                    if (eventPassed) {
                      return (
                        <div className="alert alert-error">
                          <span>⛔ Event has already passed (was on {formatDate(selectedEvent.eventDate)})</span>
                        </div>
                      )
                    }
                    
                    if (saleEnded) {
                      return (
                        <div className="alert alert-warning">
                          <span>⏰ Ticket sales ended on {formatDate(selectedEvent.saleEndDate)}. Event is on {formatDate(selectedEvent.eventDate)}</span>
                        </div>
                      )
                    }
                    
                    if (!selectedEvent.isSaleActive) {
                      return (
                        <div className="alert alert-warning">
                          <span>⚠️ Ticket sales are currently closed by organizer. Sales end: {formatDate(selectedEvent.saleEndDate)}</span>
                        </div>
                      )
                    }
                    
                    return null
                  })()}
                  <button 
                    className={`btn btn-success btn-lg w-full ${buying ? 'loading' : ''}`}
                    onClick={buyTicket}
                    disabled={buying || !activeAddress || !selectedEvent.isSaleActive || Number(selectedEvent.saleEndDate) * 1000 < Date.now() || Number(selectedEvent.eventDate) * 1000 < Date.now()}
                  >
                    {buying ? 'Processing...' : `🎟️ Buy Ticket - ${formatAlgo(selectedEvent.ticketPrice)} ALGO`}
                  </button>
                  {(Number(selectedEvent.saleEndDate) * 1000 > Date.now() && !selectedEvent.isSaleActive) && (
                    <p className="text-xs text-center text-gray-500">Button will activate when organizer reopens sales</p>
                  )}
                </div>
              ) : (
                <div className="alert alert-error mb-4">
                  <span>😔 This event is sold out!</span>
                </div>
              )}

              {/* Organizer Controls */}
              {activeAddress === selectedEvent.organizer && (
                <div className="space-y-3 mb-4">
                  <button 
                    className="btn btn-primary btn-lg w-full"
                    onClick={() => {
                      setScannerEventId(selectedEvent.appId)
                      setScannerOpen(true)
                    }}
                  >
                    📱 Scan Tickets (Organizer)
                  </button>
                  
                  <button 
                    className={`btn btn-lg w-full ${selectedEvent.isSaleActive ? 'btn-warning' : 'btn-success'}`}
                    onClick={async () => {
                      try {
                        const factory = new TicketingFactory({
                          algorand,
                          defaultSender: activeAddress,
                        })
                        const appClient = factory.getAppClientById({
                          appId: BigInt(selectedEvent.appId)
                        })
                        
                        await appClient.send.toggleSale({ args: [] })
                        
                        enqueueSnackbar(
                          `Ticket sales ${selectedEvent.isSaleActive ? 'closed' : 'reopened'}! Firebase will sync automatically.`,
                          { variant: 'success' }
                        )
                        
                        // Firebase handles updates automatically
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
                        console.error('Toggle error:', e)
                        enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
                      }
                    }}
                  >
                    {selectedEvent.isSaleActive ? '⏸️ Close Ticket Sales' : '▶️ Reopen Ticket Sales'}
                  </button>
                </div>
              )}

              {/* Anti-Scalping Info */}
              <div className="alert alert-info mb-4">
                <div className="text-sm">
                  <p className="font-bold">🔒 Anti-Scalping Protection</p>
                  <p>Smart contract enforces max 110% resale price. No ticket scalping allowed!</p>
                </div>
              </div>

              {/* Blockchain Info */}
              <div className="alert alert-success">
                <div className="text-sm">
                  <p className="font-bold">⛓️ On-Chain Contract Details</p>
                  <p className="font-mono text-xs mt-1">App ID: {selectedEvent.appId}</p>
                  <p className="font-mono text-xs">Organizer: {selectedEvent.organizer}</p>
                  <p className="text-xs mt-1">Tickets sold: {Number(selectedEvent.soldCount)} • Unique buyers: {Number(selectedEvent.uniqueBuyers)}</p>
                </div>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setSelectedEvent(null)} />
          </dialog>
        )}

        {/* Ticket QR Code Modal */}
        {purchasedTicket && (
          <dialog className="modal modal-open">
            <div className="modal-box max-w-md">
              <button 
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => setPurchasedTicket(null)}
              >
                ✕
              </button>
              
              <h3 className="font-bold text-2xl mb-4 text-center">🎫 Your Ticket NFT</h3>
              
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 rounded-lg mb-4">
                <div className="bg-white p-4 rounded-lg mb-4" id="qr-code-container">
                  <QRCodeSVG 
                    value={`ALGO_TICKET_${purchasedTicket.appId}_${purchasedTicket.assetId}_${purchasedTicket.holderAddress}`}
                    size={256}
                    level="H"
                    includeMargin={true}
                    className="w-full h-auto"
                    id="ticket-qr-code"
                  />
                </div>
                <div className="text-white text-center">
                  <p className="font-bold text-lg mb-1">Show this QR code at entry</p>
                  <p className="text-sm opacity-90">Asset ID: {purchasedTicket.assetId.toString()}</p>
                </div>
              </div>

              <div className="alert alert-info mb-4">
                <div className="text-sm">
                  <p className="font-bold">💡 Important:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Screenshot this QR code</li>
                    <li>NFT is in your wallet (Asset ID above)</li>
                    <li>Present QR at event entrance</li>
                    <li>Can only be used once</li>
                  </ul>
                </div>
              </div>

              <button 
                className="btn btn-primary w-full"
                onClick={() => {
                  // Download QR code as image
                  const svg = document.getElementById('ticket-qr-code') as unknown as SVGElement
                  if (svg) {
                    const canvas = document.createElement('canvas')
                    const ctx = canvas.getContext('2d')
                    const svgData = new XMLSerializer().serializeToString(svg)
                    const img = new Image()
                    
                    canvas.width = 256
                    canvas.height = 256
                    
                    img.onload = () => {
                      ctx?.drawImage(img, 0, 0)
                      const link = document.createElement('a')
                      link.download = `ticket-${purchasedTicket.assetId}.png`
                      link.href = canvas.toDataURL('image/png')
                      link.click()
                      enqueueSnackbar('QR code downloaded!', { variant: 'success' })
                    }
                    
                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
                  }
                }}
              >
                📥 Download QR Code
              </button>
            </div>
            <div className="modal-backdrop" onClick={() => setPurchasedTicket(null)} />
          </dialog>
        )}

        {/* Ticket Scanner */}
        {scannerOpen && scannerEventId && (
          <TicketScanner
            appId={scannerEventId}
            onVerified={(assetId) => {
              console.log('Ticket verified:', assetId)
            }}
            onClose={() => {
              setScannerOpen(false)
              setScannerEventId(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

export default TicketingPageDecentralized
