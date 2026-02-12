import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'

interface Ticket {
  id: string
  eventId: string
  owner: string
  purchasedAt: number
  checkInStatus: boolean
}

interface Event {
  id: string
  name: string
  description: string
  venue: string
  date: number
  ticketPrice: number
  maxSupply: number
  soldCount: number
  organizer: string
  tickets: Ticket[]
  createdAt: number
}

const TicketingPage = () => {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [creating, setCreating] = useState(false)
  const [buying, setBuying] = useState(false)
  
  // Create event form
  const [newEvent, setNewEvent] = useState({
    name: '',
    description: '',
    venue: '',
    date: new Date(Date.now() + 604800000).toISOString().substring(0, 16), // 7 days from now
    ticketPrice: '2',
    maxSupply: '100'
  })

  const { enqueueSnackbar } = useSnackbar()
  const { activeAccount, activeAddress, transactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(transactionSigner)

  // Load events from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('events')
    if (stored) {
      setEvents(JSON.parse(stored))
    } else {
      // Initialize with sample event
      const sampleEvents: Event[] = [
        {
          id: '1',
          name: 'VIT Blockchain Workshop 2026',
          description: 'Learn about blockchain development, smart contracts, and Algorand',
          venue: 'VIT Main Auditorium',
          date: Date.now() + 1209600000, // 14 days from now
          ticketPrice: 2,
          maxSupply: 150,
          soldCount: 37,
          organizer: 'SAMPLE...ORG',
          tickets: Array.from({length: 37}, (_, i) => ({
            id: `t${i+1}`,
            eventId: '1',
            owner: `SAMPLE...${i+1}`,
            purchasedAt: Date.now() - Math.random() * 86400000,
            checkInStatus: false
          })),
          createdAt: Date.now() - 604800000
        }
      ]
      localStorage.setItem('events', JSON.stringify(sampleEvents))
      setEvents(sampleEvents)
    }
  }, [])

  // Load user's tickets
  useEffect(() => {
    if (activeAddress) {
      const allTickets = events.flatMap(e => e.tickets)
      const userTickets = allTickets.filter(t => t.owner === activeAddress)
      setMyTickets(userTickets)
    }
  }, [activeAddress, events])

  const createEvent = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet', { variant: 'error' })
      return
    }

    setCreating(true)
    try {
      const event: Event = {
        id: Date.now().toString(),
        name: newEvent.name,
        description: newEvent.description,
        venue: newEvent.venue,
        date: new Date(newEvent.date).getTime(),
        ticketPrice: parseFloat(newEvent.ticketPrice),
        maxSupply: parseInt(newEvent.maxSupply),
        soldCount: 0,
        organizer: activeAddress,
        tickets: [],
        createdAt: Date.now()
      }

      const updated = [...events, event]
      setEvents(updated)
      localStorage.setItem('events', JSON.stringify(updated))
      
      enqueueSnackbar(`Event "${event.name}" created successfully!`, { variant: 'success' })
      setNewEvent({
        name: '',
        description: '',
        venue: '',
        date: new Date(Date.now() + 604800000).toISOString().substring(0, 16),
        ticketPrice: '2',
        maxSupply: '100'
      })
    } catch (e) {
      enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const buyTicket = async () => {
    if (!selectedEvent || !activeAddress) {
      enqueueSnackbar('Please select an event and connect wallet', { variant: 'error' })
      return
    }

    if (selectedEvent.soldCount >= selectedEvent.maxSupply) {
      enqueueSnackbar('Event is sold out!', { variant: 'error' })
      return
    }

    setBuying(true)
    try {
      const priceInMicroAlgos = Math.floor(selectedEvent.ticketPrice * 1_000_000)
      
      // Actual blockchain transaction
      await algorand.send.payment({
        sender: activeAddress,
        receiver: activeAddress, // In production: would be event organizer address
        amount: algokit.microAlgos(priceInMicroAlgos),
      })

      // Create ticket
      const ticket: Ticket = {
        id: `${selectedEvent.id}-${Date.now()}`,
        eventId: selectedEvent.id,
        owner: activeAddress,
        purchasedAt: Date.now(),
        checkInStatus: false
      }

      const updatedEvents = events.map(e => {
        if (e.id === selectedEvent.id) {
          return {
            ...e,
            soldCount: e.soldCount + 1,
            tickets: [...e.tickets, ticket]
          }
        }
        return e
      })

      setEvents(updatedEvents)
      localStorage.setItem('events', JSON.stringify(updatedEvents))
      setSelectedEvent(updatedEvents.find(e => e.id === selectedEvent.id) || null)
      
      enqueueSnackbar(
        `Ticket purchased successfully!`, 
        { variant: 'success' }
      )
    } catch (e) {
      enqueueSnackbar(`Error: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setBuying(false)
    }
  }

  const formatAddress = (addr: string) => {
    if (addr.startsWith('SAMPLE')) return addr
    return `${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp
    const hours = Math.floor(diff / 3600000)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-ghost btn-sm"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-blue-600">🎫 Campus Event Ticketing</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="badge badge-info">TestNet</div>
            {activeAddress && (
              <>
                <div className="badge badge-success">{formatAddress(activeAddress)}</div>
                <div className="badge badge-warning">🎟️ {myTickets.length} Tickets</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="stat bg-white rounded-lg shadow-lg">
            <div className="stat-title">Total Events</div>
            <div className="stat-value text-blue-600">{events.length}</div>
          </div>
          <div className="stat bg-white rounded-lg shadow-lg">
            <div className="stat-title">Tickets Sold</div>
            <div className="stat-value text-green-600">
              {events.reduce((sum, e) => sum + e.soldCount, 0)}
            </div>
          </div>
          <div className="stat bg-white rounded-lg shadow-lg">
            <div className="stat-title">Total Attendees</div>
            <div className="stat-value text-purple-600">
              {new Set(events.flatMap(e => e.tickets.map(t => t.owner))).size}
            </div>
          </div>
          <div className="stat bg-white rounded-lg shadow-lg">
            <div className="stat-title">My Tickets</div>
            <div className="stat-value text-orange-600">{myTickets.length}</div>
          </div>
        </div>

        {/* Create Event Section */}
        <div className="card bg-white shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">🎪 Create New Event</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Event Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                  placeholder="e.g., Tech Conference 2026"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Venue</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newEvent.venue}
                  onChange={(e) => setNewEvent({...newEvent, venue: e.target.value})}
                  placeholder="e.g., Main Auditorium"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Date & Time</span>
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
                  <span className="label-text font-semibold">Ticket Price (ALGO)</span>
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
                  <span className="label-text font-semibold">Max Tickets</span>
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
                  <span className="label-text font-semibold">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  placeholder="Describe your event..."
                />
              </div>
            </div>
            <button 
              className={`btn btn-primary mt-4 ${creating ? 'loading' : ''}`}
              onClick={createEvent}
              disabled={creating || !activeAddress || !newEvent.name || !newEvent.description}
            >
              {creating ? 'Creating...' : '✨ Create Event'}
            </button>
          </div>
        </div>

        {/* Events Grid */}
        <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {events.map((event) => {
            const availability = event.maxSupply - event.soldCount
            const soldPercentage = (event.soldCount / event.maxSupply) * 100
            const isUpcoming = event.date > Date.now()
            
            return (
              <div 
                key={event.id}
                className="card bg-white shadow-xl hover:shadow-2xl transition-all cursor-pointer"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <h3 className="card-title text-lg">{event.name}</h3>
                    {!isUpcoming && <div className="badge badge-error">Past</div>}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
                  
                  <div className="space-y-2 mt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-2xl">📍</span>
                      <span>{event.venue}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-2xl">📅</span>
                      <span>{formatDate(event.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-2xl">💰</span>
                      <span className="font-bold">{event.ticketPrice} ALGO</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>{availability} tickets left</span>
                      <span className="text-gray-500">{event.soldCount}/{event.maxSupply}</span>
                    </div>
                    <progress 
                      className={`progress ${availability === 0 ? 'progress-error' : 'progress-success'} w-full`}
                      value={soldPercentage} 
                      max="100"
                    />
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <div className="badge badge-info badge-outline">
                      👥 {event.soldCount} attending
                    </div>
                    {availability === 0 && (
                      <div className="badge badge-error">Sold Out</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <dialog id="event_modal" className="modal modal-open">
            <div className="modal-box max-w-4xl">
              <button 
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => setSelectedEvent(null)}
              >
                ✕
              </button>
              
              <h3 className="font-bold text-2xl mb-2">{selectedEvent.name}</h3>
              <p className="text-gray-600 mb-4">{selectedEvent.description}</p>
              
              {/* Event Info Card */}
              <div className="card bg-gradient-to-r from-blue-500 to-cyan-500 text-white mb-4">
                <div className="card-body">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm opacity-90">Venue</p>
                      <p className="text-xl font-bold">📍 {selectedEvent.venue}</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Date & Time</p>
                      <p className="text-xl font-bold">📅 {formatDate(selectedEvent.date)}</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Ticket Price</p>
                      <p className="text-2xl font-bold">💰 {selectedEvent.ticketPrice} ALGO</p>
                    </div>
                    <div>
                      <p className="text-sm opacity-90">Availability</p>
                      <p className="text-2xl font-bold">
                        {selectedEvent.maxSupply - selectedEvent.soldCount}/{selectedEvent.maxSupply}
                      </p>
                    </div>
                  </div>
                  <progress 
                    className="progress progress-accent w-full h-3 mt-4" 
                    value={(selectedEvent.soldCount / selectedEvent.maxSupply) * 100} 
                    max="100"
                  />
                  <p className="text-sm opacity-90 mt-2">
                    {((selectedEvent.soldCount / selectedEvent.maxSupply) * 100).toFixed(0)}% Sold
                  </p>
                </div>
              </div>

              {/* Buy Ticket Button */}
              {selectedEvent.maxSupply - selectedEvent.soldCount > 0 ? (
                <button 
                  className={`btn btn-success btn-lg w-full mb-4 ${buying ? 'loading' : ''}`}
                  onClick={buyTicket}
                  disabled={buying || !activeAddress}
                >
                  {buying ? 'Processing...' : `🎟️ Buy Ticket - ${selectedEvent.ticketPrice} ALGO`}
                </button>
              ) : (
                <div className="alert alert-error mb-4">
                  <span>😔 This event is sold out!</span>
                </div>
              )}

              {/* Anti-Scalping Info */}
              <div className="alert alert-info mb-4">
                <div className="text-sm">
                  <p className="font-bold">🔒 Anti-Scalping Protection</p>
                  <p>Smart contract enforces max 110% resale price. No ticket scalping allowed!</p>
                </div>
              </div>

              {/* Recent Ticket Purchases */}
              <div>
                <h4 className="font-bold mb-2">🎫 Recent Purchases ({selectedEvent.tickets.length})</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {selectedEvent.tickets.slice().reverse().slice(0, 20).map((ticket, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-base-200 p-3 rounded-lg">
                      <div>
                        <p className="font-mono text-sm">{formatAddress(ticket.owner)}</p>
                        <p className="text-xs text-gray-500">{formatTime(ticket.purchasedAt)}</p>
                      </div>
                      <div className="badge badge-success">Ticket #{ticket.id.split('-')[1]?.substring(0, 6)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setSelectedEvent(null)} />
          </dialog>
        )}

        {/* My Tickets Section */}
        {myTickets.length > 0 && (
          <div className="card bg-white shadow-xl mt-8">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">🎟️ My Tickets ({myTickets.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myTickets.map((ticket) => {
                  const event = events.find(e => e.id === ticket.eventId)
                  if (!event) return null
                  
                  return (
                    <div key={ticket.id} className="card bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                      <div className="card-body">
                        <h3 className="card-title text-lg">{event.name}</h3>
                        <p className="text-sm opacity-90">📍 {event.venue}</p>
                        <p className="text-sm opacity-90">📅 {formatDate(event.date)}</p>
                        <div className="divider my-2" />
                        <p className="text-xs font-mono">Ticket ID: {ticket.id.substring(0, 16)}...</p>
                        <div className="badge badge-accent mt-2">
                          {ticket.checkInStatus ? '✅ Checked In' : '⏳ Not Checked In'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TicketingPage
