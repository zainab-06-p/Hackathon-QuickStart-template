import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { TicketingFactory } from '../contracts/TicketingClient'
import { CitadelRegistryFactory } from '../contracts/RegistryClient'
import { ContractRegistry } from '../utils/contractRegistry'
import { saveEventToFirebase, initializeFirebase } from '../utils/firebase'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import { ImpactBadge } from '../components/Base/ImpactBadge'
import {
  ArrowLeft, Calendar, MapPin, Ticket, Users, Plus, X, Info,
  AlertTriangle, Loader2, Zap, Globe,
} from 'lucide-react'

const CreateEventPage = () => {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    venue: '',
    date: new Date(Date.now() + 604800000).toISOString().substring(0, 16),
    saleEndDate: new Date(Date.now() + 518400000).toISOString().substring(0, 16), // 6 days (1 day before event)
    ticketPrice: '2',
    maxSupply: '100'
  })
  
  const [organizers, setOrganizers] = useState<string[]>([''])  // Array of organizer addresses

  const { enqueueSnackbar } = useSnackbar()
  const { activeAddress, transactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(transactionSigner)
  algorand.setDefaultValidityWindow(1000) // Set default validity window to 1000 blocks (~4 minutes, TestNet max)

  const createEvent = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet', { variant: 'error' })
      return
    }

    setCreating(true)
    try {
      const priceInMicroAlgos = Math.floor(parseFloat(newEvent.ticketPrice) * 1_000_000)
      const supply = parseInt(newEvent.maxSupply)
      const eventTimestamp = Math.floor(new Date(newEvent.date).getTime() / 1000)
      const saleEndTimestamp = Math.floor(new Date(newEvent.saleEndDate).getTime() / 1000)

      console.log('🎫 Creating event with:', {
        price: priceInMicroAlgos,
        supply,
        eventDate: eventTimestamp,
        saleEndDate: saleEndTimestamp,
        currentTime: Math.floor(Date.now() / 1000)
      })

      const factory = new TicketingFactory({
        algorand,
        defaultSender: activeAddress,
      })

      // Check account balance before deployment
      const accountInfo = await algorand.client.algod.accountInformation(activeAddress).do()
      const balance = Number(accountInfo.amount)
      const minBalance = Number(accountInfo.minBalance)
      
      if (balance < minBalance + 1000000) {
        enqueueSnackbar(
          `Insufficient balance! You have ${(balance / 1_000_000).toFixed(3)} ALGO but need ${((minBalance + 1000000) / 1_000_000).toFixed(3)} ALGO (${(minBalance / 1_000_000).toFixed(3)} minimum + 1 ALGO for contract deployment)`,
          { variant: 'error', persist: true }
        )
        return
      }

      enqueueSnackbar('Deploying smart contract...', { variant: 'info' })

      const { result } = await factory.send.create.createEvent({
        args: {
          price: BigInt(priceInMicroAlgos),
          supply: BigInt(supply),
          eventDate: BigInt(eventTimestamp),
          saleEndDate: BigInt(saleEndTimestamp)
        },
        note: new TextEncoder().encode(JSON.stringify({
          type: 'event',
          title: newEvent.title,
          description: newEvent.description,
          venue: newEvent.venue
        })),
        validityWindow: 1000,  // ~4 minutes for signing (TestNet max)
        populateAppCallResources: false,
        suppressLog: true
      })

      const appId = Number(result.appId)
      
      enqueueSnackbar(`✅ Event created! App ID: ${appId}`, { variant: 'success' })

      // Register in localStorage for immediate visibility
      ContractRegistry.registerTicketing({
        appId,
        creator: activeAddress,
        createdAt: Date.now(),
        title: newEvent.title,
        description: newEvent.description,
        venue: newEvent.venue
      })

      // 🔥 Save to Firebase for real-time cross-device sync
      try {
        initializeFirebase()
        await saveEventToFirebase({
          appId: String(appId),
          title: newEvent.title,
          description: newEvent.description,
          venue: newEvent.venue,
          eventDate: newEvent.date,
          totalTickets: newEvent.maxSupply,
          ticketPrice: newEvent.ticketPrice,
          creator: activeAddress,
          createdAt: Date.now(),
          blockchainTxId: result.transaction?.txID() || result.transactions?.[0]?.txID() || undefined
        })
        console.log('🔥 Event saved to Firebase for real-time sync')
        enqueueSnackbar('🔥 Event synced across all devices!', { variant: 'info' })
      } catch (firebaseError) {
        console.warn('Firebase save failed (non-critical):', firebaseError)
        // Non-blocking: blockchain + localStorage still work
      }

      // 👥 Add organizers if any are specified
      let validOrganizers = organizers.filter(addr => 
        addr.trim() !== '' && addr.length === 58
      )
      
      if (validOrganizers.length > 0) {
        if (validOrganizers.length > 10) {
          enqueueSnackbar(`⚠️ Only first 10 organizers will be added (max limit)`, { variant: 'warning' })
          validOrganizers = validOrganizers.slice(0, 10)
        }
        
        enqueueSnackbar(`Adding ${validOrganizers.length} organizer(s)...`, { variant: 'info' })
        
        let successCount = 0
        let failCount = 0
        
        try {
          const appClient = factory.getAppClientById({ appId: BigInt(appId) })
          const appAddress = algosdk.getApplicationAddress(appId)
          
          // Helper function to create box key matching contract format
          const createBoxKey = (index: number): Uint8Array => {
            const prefix = new TextEncoder().encode('org_')
            const indexBytes = new Uint8Array(8)
            const view = new DataView(indexBytes.buffer)
            view.setBigUint64(0, BigInt(index), false) // big-endian
            
            const boxKey = new Uint8Array(prefix.length + indexBytes.length)
            boxKey.set(prefix, 0)
            boxKey.set(indexBytes, prefix.length)
            return boxKey
          }
          
          // Box MBR: 2500 + 400 * (key_size + value_size)
          // key = "org_" (4 bytes) + index (8 bytes) = 12 bytes
          // value = Address (32 bytes)
          // MBR = 2500 + 400 * (12 + 32) = 20,100 microAlgos
          const boxMBR = 20100
          const contractBaseMBR = 100000 // Contract needs 100,000 microAlgos base MBR
          
          for (let i = 0; i < validOrganizers.length; i++) {
            try {
              const organizerAddr = validOrganizers[i]
              const boxKey = createBoxKey(i)
              
              // For first organizer, ensure contract has base MBR + box storage
              // For subsequent organizers, just add box storage MBR
              const fundingAmount = i === 0 ? contractBaseMBR + boxMBR : boxMBR
              
              // Fund contract for box storage (contract will create the box)
              await algorand.send.payment({
                sender: activeAddress,
                receiver: appAddress,
                amount: algokit.microAlgos(fundingAmount),
              })
              
              // Add organizer with box reference
              await appClient.send.addOrganizer({
                args: { organizerAddress: organizerAddr },
                boxReferences: [{ appId: BigInt(appId), name: boxKey }],
              })
              
              console.log(`✅ Added organizer ${i + 1}: ${organizerAddr}`)
              successCount++
            } catch (orgError) {
              console.warn(`Failed to add organizer ${i + 1}:`, orgError)
              failCount++
            }
          }
          
          if (successCount > 0) {
            enqueueSnackbar(`✅ Added ${successCount} organizer(s)!`, { variant: 'success' })
          }
          if (failCount > 0) {
            enqueueSnackbar(`⚠️ ${failCount} organizer(s) could not be added. They can be added later.`, { variant: 'warning' })
          }
        } catch (error) {
          console.warn('Organizer addition failed:', error)
          enqueueSnackbar('⚠️ Organizers could not be added. Event created successfully - you can add organizers later.', { variant: 'warning' })
        }
      }
      
      // 🎯 Register with on-chain registry for cross-device discovery (DISABLED - has box issues)
      /* 
      const registryAppId = import.meta.env.VITE_REGISTRY_APP_ID
      if (registryAppId && Number(registryAppId) > 0) {
        try {
          console.log(`📝 Registering event ${appId} with registry contract ${registryAppId}...`)
          
          const registryFactory = new CitadelRegistryFactory({
            algorand,
            defaultSender: activeAddress,
          })
          
          const registryClient = registryFactory.getAppClientById({
            appId: BigInt(registryAppId)
          })
          
          await registryClient.send.registerTicketing({
            args: { appId: BigInt(appId) }
          })
          
          console.log(`✅ Event ${appId} registered in on-chain registry!`)
          enqueueSnackbar('📋 Event registered for cross-device discovery!', { variant: 'success' })
        } catch (error) {
          console.warn('Registry registration failed (non-critical):', error)
          // Don't block the user - localStorage registration is enough
        }
      }
      */

      setTimeout(() => {
        navigate('/ticketing')
      }, 2000)
      
    } catch (e) {
      console.error('Error creating event:', e)
      enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-8">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/ticketing')}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-white flex items-center gap-3">
              <Ticket className="w-7 h-7 text-indigo-500" />
              Create Event
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">Deploy a new ticketing smart contract on Algorand</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImpactBadge label="TestNet" color="indigo" size="sm" />
          {activeAddress && (
            <span className="hidden sm:inline-flex px-2.5 py-1 text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg">
              {formatAddress(activeAddress)}
            </span>
          )}
        </div>
      </div>

      {/* ── Info banner ──────────────────────────────────────── */}
      <div className="flex items-start gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-white font-medium text-sm">Fully Decentralized</h3>
          <p className="text-zinc-400 text-sm mt-0.5">
            Each event deploys its own smart contract. Ticket NFTs are minted automatically on purchase!
          </p>
        </div>
      </div>

      {/* ── Main Form Card ───────────────────────────────────── */}
      <Card className="border-zinc-800">
        <div className="space-y-8">

          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Event Details
          </h2>

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Event Title */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Event Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                placeholder="e.g., Campus Tech Concert"
              />
            </div>

            {/* Venue */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
                <MapPin className="w-3 h-3 inline mr-1" />Venue <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                value={newEvent.venue}
                onChange={(e) => setNewEvent({...newEvent, venue: e.target.value})}
                placeholder="e.g., University Auditorium"
              />
            </div>

            {/* Event Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Event Date &amp; Time <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm [color-scheme:dark]"
                value={newEvent.date}
                onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
              />
            </div>

            {/* Sale End Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Sale End Date &amp; Time <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm [color-scheme:dark]"
                value={newEvent.saleEndDate}
                onChange={(e) => setNewEvent({...newEvent, saleEndDate: e.target.value})}
              />
              <p className="text-xs text-zinc-600 flex items-center gap-1">
                <Info className="w-3 h-3" /> Ticket sales stop at this time (before event starts)
              </p>
            </div>

            {/* Ticket Price */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Ticket Price (ALGO) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-mono"
                  value={newEvent.ticketPrice}
                  onChange={(e) => setNewEvent({...newEvent, ticketPrice: e.target.value})}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-medium">ALGO</div>
              </div>
            </div>

            {/* Max Tickets */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Max Tickets <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-mono"
                value={newEvent.maxSupply}
                onChange={(e) => setNewEvent({...newEvent, maxSupply: e.target.value})}
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm h-24 resize-none"
                value={newEvent.description}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                placeholder="Describe your event..."
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Co-Organizers Section ─────────────────────────────── */}
      <Card className="border-zinc-800">
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Co-Organizers
              <span className="text-xs font-normal text-zinc-500 ml-1">(Optional)</span>
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Add wallet addresses of people who can also scan tickets and manage the event (max 10).
              Each costs ~0.02 ALGO for box storage.
            </p>
          </div>

          <div className="space-y-3">
            {organizers.map((addr, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-mono"
                  value={addr}
                  onChange={(e) => {
                    const newOrganizers = [...organizers]
                    newOrganizers[index] = e.target.value
                    setOrganizers(newOrganizers)
                  }}
                  placeholder="Algorand wallet address (58 characters) — leave blank to skip"
                />
                {organizers.length > 1 && (
                  <button
                    type="button"
                    className="px-3 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors text-sm font-medium"
                    onClick={() => setOrganizers(organizers.filter((_, i) => i !== index))}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            
            {organizers.length < 10 && (
              <button
                type="button"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors"
                onClick={() => setOrganizers([...organizers, ''])}
              >
                <Plus className="w-4 h-4" /> Add Another Organizer
              </button>
            )}

            <p className="text-xs text-zinc-600 mt-1">
              All organizers will have permission to scan tickets and verify entry at your event.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Deploy Button ────────────────────────────────────── */}
      <BrandButton
        fullWidth
        size="lg"
        onClick={createEvent}
        disabled={creating || !activeAddress || !newEvent.title || !newEvent.description}
        isLoading={creating}
      >
        {creating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Deploying Contract...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5 mr-2" />
            Deploy Event Contract
          </>
        )}
      </BrandButton>

      {!activeAddress && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">Please connect your wallet to create an event</p>
        </div>
      )}
    </div>
  )
}

export default CreateEventPage
