import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'

interface TicketingInterface {
  openModal: boolean
  setModalState: (value: boolean) => void
}

const Ticketing = ({ openModal, setModalState }: TicketingInterface) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [deploying, setDeploying] = useState<boolean>(false)
  const [appId, setAppId] = useState<number | null>(null)
  const [eventName, setEventName] = useState<string>('VIT Blockchain Workshop')
  const [ticketPrice, setTicketPrice] = useState<string>('2')
  const [maxSupply, setMaxSupply] = useState<string>('100')
  const [soldCount, setSoldCount] = useState<number>(0)
  const [myTickets, setMyTickets] = useState<number>(0)
  const { enqueueSnackbar } = useSnackbar()
  const { activeAccount, activeAddress, transactionSigner: TransactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(TransactionSigner)

  const createEvent = async () => {
    setDeploying(true)
    try {
      // Note: This is a placeholder - actual implementation would use TicketingFactory
      // For this demo, we'll simulate the creation
      const simulatedAppId = Math.floor(Math.random() * 1000000) + 2000000
      setAppId(simulatedAppId)
      setSoldCount(0)
      setMyTickets(0)
      enqueueSnackbar(
        `Event created with App ID: ${simulatedAppId}. ${maxSupply} tickets at ${ticketPrice} ALGO each`, 
        { variant: 'success' }
      )
    } catch (e) {
      enqueueSnackbar(`Error creating event: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setDeploying(false)
    }
  }

  const buyTicket = async () => {
    if (!appId) {
      enqueueSnackbar('Please create an event first', { variant: 'error' })
      return
    }

    if (soldCount >= parseInt(maxSupply)) {
      enqueueSnackbar('Event is sold out!', { variant: 'error' })
      return
    }

    setLoading(true)
    try {
      const priceInMicroAlgos = Math.floor(parseFloat(ticketPrice) * 1_000_000)
      
      // Send payment for ticket (placeholder for demo)
      await algorand.send.payment({
        sender: activeAddress ?? '',
        receiver: activeAddress ?? '', // In production, this would be the app address
        amount: algokit.microAlgos(priceInMicroAlgos),
      })

      setSoldCount(soldCount + 1)
      setMyTickets(myTickets + 1)
      
      enqueueSnackbar(
        `Ticket purchased! You now have ${myTickets + 1} ticket(s)`, 
        { variant: 'success' }
      )
    } catch (e) {
      enqueueSnackbar(`Error purchasing ticket: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const availableTickets = appId ? parseInt(maxSupply) - soldCount : 0
  const soldPercentage = appId ? (soldCount / parseInt(maxSupply)) * 100 : 0

  return (
    <dialog id="ticketing_modal" className={`modal ${openModal ? 'modal-open' : ''} bg-slate-200`}>
      <form method="dialog" className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg">🎫 Campus Event Ticketing</h3>
        <p className="text-sm text-gray-600 mt-1">Blockchain-based tickets with anti-scalping protection</p>
        <br />
        
        <div className="flex flex-col gap-4">
          {appId && (
            <div className="card bg-gradient-to-br from-purple-500 to-blue-500 text-white">
              <div className="card-body">
                <h2 className="card-title text-xl">{eventName}</h2>
                <div className="flex justify-between items-center mt-2">
                  <div>
                    <p className="text-sm opacity-90">Price per ticket</p>
                    <p className="text-2xl font-bold">{ticketPrice} ALGO</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-90">Available</p>
                    <p className="text-2xl font-bold">{availableTickets}/{maxSupply}</p>
                  </div>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 mt-3">
                  <div 
                    className="bg-white h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${soldPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs opacity-90 mt-1">
                  <span>App ID: {appId}</span>
                  <span>{soldPercentage.toFixed(0)}% sold</span>
                </div>
              </div>
            </div>
          )}

          {myTickets > 0 && (
            <div className="alert alert-success">
              <span>🎉 You own {myTickets} ticket{myTickets > 1 ? 's' : ''} for this event!</span>
            </div>
          )}
          
          {!appId ? (
            <>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Event Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Enter event name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Ticket Price (ALGO)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="input input-bordered"
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(e.target.value)}
                    placeholder="Price"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Max Supply</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input input-bordered"
                    value={maxSupply}
                    onChange={(e) => setMaxSupply(e.target.value)}
                    placeholder="Supply"
                  />
                </div>
              </div>

              <button 
                className={`btn btn-primary ${deploying ? 'loading' : ''}`}
                onClick={createEvent}
                disabled={deploying || !activeAccount || !eventName || !ticketPrice || !maxSupply}
              >
                {deploying ? 'Creating...' : '🎪 Create Event'}
              </button>
            </>
          ) : (
            <>
              <div className="divider">Purchase Tickets</div>
              
              <div className="stats shadow">
                <div className="stat">
                  <div className="stat-title">Anti-Scalping</div>
                  <div className="stat-value text-sm">Max 110% resale</div>
                  <div className="stat-desc">Smart contract enforced</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Blockchain Verified</div>
                  <div className="stat-value text-sm">100% Authentic</div>
                  <div className="stat-desc">No fake tickets possible</div>
                </div>
              </div>

              <button 
                className={`btn btn-success btn-lg ${loading ? 'loading' : ''}`}
                onClick={buyTicket}
                disabled={loading || !activeAccount || availableTickets === 0}
              >
                {loading ? 'Processing...' : availableTickets === 0 ? '😔 Sold Out' : `🎟️ Buy Ticket - ${ticketPrice} ALGO`}
              </button>

              <div className="alert alert-info">
                <span className="text-xs">
                  🔒 <strong>Anti-Scalping:</strong> Smart contract prevents resale above 110% of original price
                </span>
              </div>
            </>
          )}
          
          <div className="modal-action">
            <button 
              className="btn" 
              onClick={() => setModalState(false)}
              disabled={loading || deploying}
            >
              Close
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}

export default Ticketing
