import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import { TicketingFactory } from '../contracts/TicketingClient'
import { ContractRegistry } from '../utils/contractRegistry'
import { pinFileToIPFS, ipfsHttpUrl } from '../utils/pinata'

const CreateEventPage = () => {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    venue: '',
    date: new Date(Date.now() + 604800000).toISOString().substring(0, 16),
    saleEndDate: new Date(Date.now() + 518400000).toISOString().substring(0, 16), // 6 days (1 day before event)
    ticketPrice: '2',
    maxSupply: '100',
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
      setNewEvent({ ...newEvent, imageUrl: url })
      enqueueSnackbar('✅ Media uploaded successfully!', { variant: 'success' })
    } catch (e) {
      console.error('Upload error:', e)
      enqueueSnackbar(`Upload failed: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

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
      const balance = accountInfo.amount
      const minBalance = accountInfo['min-balance']
      
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
          venue: newEvent.venue,
          imageUrl: newEvent.imageUrl
        })),
        populateAppCallResources: false,
        suppressLog: true
      })

      const appId = Number(result.appId)
      
      enqueueSnackbar(`✅ Event created! App ID: ${appId}`, { variant: 'success' })

      ContractRegistry.registerTicketing({
        appId,
        creator: activeAddress,
        createdAt: Date.now(),
        title: newEvent.title,
        description: newEvent.description,
        venue: newEvent.venue,
        imageUrl: newEvent.imageUrl
      })

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
        <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/ticketing')} 
              className="btn btn-ghost btn-sm hover:scale-110 transition-transform"
            >
              ← Back to Events
            </button>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent">✨ Create New Event</h1>
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
        <div className="card bg-white/95 backdrop-blur shadow-2xl border-2 border-pink-200 hover:border-pink-400 transition-all duration-300">
          <div className="card-body">
            <h2 className="card-title text-3xl mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🎭 Event Details
            </h2>
            <div className="alert alert-info bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-lg mb-6">
              <span><strong>⛓️ Fully Decentralized:</strong> Each event deploys its own smart contract. Ticket NFTs minted automatically on purchase!</span>
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
              
              <div className="form-control md:col-span-2">
                <label className="label">
                  <span className="label-text font-semibold">Event Poster (Optional)</span>
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
                {newEvent.imageUrl && (
                  <div className="mt-2">
                    <span className="label-text-alt text-success">✅ Media uploaded!</span>
                    {newEvent.imageUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img src={newEvent.imageUrl} alt="Preview" className="mt-2 max-h-32 rounded" />
                    ) : (
                      <video src={newEvent.imageUrl} className="mt-2 max-h-32 rounded" controls />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="divider"></div>

            <button 
              className={`btn btn-lg w-full mt-6 text-lg shadow-2xl hover:shadow-pink-500/50 transition-all duration-300 ${creating ? 'loading' : 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:scale-105 border-0 text-white'}`}
              onClick={createEvent}
              disabled={creating || !activeAddress || !newEvent.title || !newEvent.description || uploading}
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
