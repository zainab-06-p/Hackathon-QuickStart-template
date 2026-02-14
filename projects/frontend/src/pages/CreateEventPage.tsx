import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { TicketingFactory } from '../contracts/TicketingClient'
import { CampusChainRegistryFactory } from '../contracts/RegistryClient'
import { ContractRegistry } from '../utils/contractRegistry'
import { saveEventToFirebase, initializeFirebase } from '../utils/firebase'

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
          
          const registryFactory = new CampusChainRegistryFactory({
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 animate-gradient-shift">
      <div className="bg-white/90 backdrop-blur-md shadow-lg border-b-4 border-gradient-to-r from-purple-500 to-pink-500">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              <button 
                onClick={() => navigate('/ticketing')} 
                className="btn btn-ghost btn-xs sm:btn-sm hover:scale-110 transition-transform"
              >
                ← Back
              </button>
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">✨ Create Event</h1>
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
        <div className="card bg-white/95 backdrop-blur shadow-2xl border-2 border-pink-200 hover:border-pink-400 transition-all duration-300">
          <div className="card-body">
            <h2 className="card-title text-xl md:text-2xl lg:text-3xl mb-4 md:mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🎭 Event Details
            </h2>
            <div className="alert alert-info bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-lg mb-4 md:mb-6">
              <span className="text-xs sm:text-sm"><strong>⛓️ Fully Decentralized:</strong> Each event deploys its own smart contract. Ticket NFTs minted automatically on purchase!</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Event Title *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  placeholder="e.g., Campus Tech Concert"
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Venue *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newEvent.venue}
                  onChange={(e) => setNewEvent({...newEvent, venue: e.target.value})}
                  placeholder="e.g., University Auditorium"
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Event Date & Time *</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Sale End Date & Time *</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={newEvent.saleEndDate}
                  onChange={(e) => setNewEvent({...newEvent, saleEndDate: e.target.value})}
                />
                <label className="label">
                  <span className="label-text-alt text-info">⏰ Ticket sales stop at this time (before event starts)</span>
                </label>
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Ticket Price (ALGO) *</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="input input-bordered"
                  value={newEvent.ticketPrice}
                  onChange={(e) => setNewEvent({...newEvent, ticketPrice: e.target.value})}
                />
              </div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Max Tickets *</span>
                </label>
                <input
                  type="number"
                  min="1"
                  className="input input-bordered"
                  value={newEvent.maxSupply}
                  onChange={(e) => setNewEvent({...newEvent, maxSupply: e.target.value})}
                />
              </div>
              
              <div className="form-control md:col-span-2">
                <label className="label">
                  <span className="label-text font-semibold">Description *</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  placeholder="Describe your event..."
                />
              </div>
            </div>

            <div className="divider"></div>
            
            {/* Multi-Organizer Section */}
            <div className="alert alert-success mb-4">
              <div>
                <h3 className="font-bold text-lg">👥 Add Co-Organizers (Optional)</h3>
                <p className="text-sm mt-1">Add wallet addresses of people who can also scan tickets and manage the event (max 10)</p>
                <p className="text-xs mt-1 opacity-75">⚠️ Leave blank to skip. Each organizer costs ~0.02 ALGO for box storage.</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {organizers.map((addr, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    className="input input-bordered flex-1 font-mono text-sm"
                    value={addr}
                    onChange={(e) => {
                      const newOrganizers = [...organizers]
                      newOrganizers[index] = e.target.value
                      setOrganizers(newOrganizers)
                    }}
                    placeholder="Algorand wallet address (58 characters) - leave blank to skip"
                  />
                  {organizers.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-error btn-outline"
                      onClick={() => setOrganizers(organizers.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              
              {organizers.length < 10 && (
                <button
                  type="button"
                  className="btn btn-outline btn-success btn-sm"
                  onClick={() => setOrganizers([...organizers, ''])}
                >
                  + Add Another Organizer
                </button>
              )}
              
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: All organizers will have permission to scan tickets and verify entry at your event. Leave all fields empty if you don't need co-organizers right now.
              </p>
            </div>

            <div className="divider"></div>

            <button 
              className={`btn btn-lg w-full mt-6 text-lg shadow-2xl hover:shadow-pink-500/50 transition-all duration-300 ${creating ? 'loading' : 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:scale-105 border-0 text-white'}`}
              onClick={createEvent}
              disabled={creating || !activeAddress || !newEvent.title || !newEvent.description}
            >
              {creating ? 'Deploying Contract...' : '🎭 Deploy Event Contract'}
            </button>

            {!activeAddress && (
              <div className="alert alert-warning mt-4">
                <span>⚠️ Please connect your wallet to create an event</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateEventPage
