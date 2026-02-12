import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContractRegistry } from '../utils/contractRegistry'

interface College {
  id: string
  name: string
  location: string
  color: string
}

interface FederationEvent {
  id: number
  title: string
  colleges: string[]
  totalFunding: number
  ticketsSold: number
  status: 'planning' | 'active' | 'completed'
}

const COLLEGES: College[] = [
  { id: 'vit', name: 'VIT Vellore', location: 'Vellore, Tamil Nadu', color: 'from-blue-500 to-cyan-500' },
  { id: 'mit', name: 'MIT Manipal', location: 'Manipal, Karnataka', color: 'from-purple-500 to-pink-500' },
  { id: 'srm', name: 'SRM University', location: 'Chennai, Tamil Nadu', color: 'from-orange-500 to-red-500' },
  { id: 'sastra', name: 'SASTRA University', location: 'Thanjavur, Tamil Nadu', color: 'from-green-500 to-teal-500' },
]

const FederationPage = () => {
  const navigate = useNavigate()
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()
  
  const [selectedColleges, setSelectedColleges] = useState<string[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [federationEvents, setFederationEvents] = useState<FederationEvent[]>([
    {
      id: 1,
      title: 'Tech Giants Summit 2026',
      colleges: ['vit', 'mit', 'srm', 'sastra'],
      totalFunding: 50000,
      ticketsSold: 1247,
      status: 'active'
    },
    {
      id: 2,
      title: 'Inter-Campus Hackathon',
      colleges: ['vit', 'mit'],
      totalFunding: 15000,
      ticketsSold: 456,
      status: 'planning'
    }
  ])

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    venue: '',
    date: new Date(Date.now() + 2592000000).toISOString().substring(0, 16), // 30 days
    sharedPool: '10000'
  })

  const toggleCollege = (collegeId: string) => {
    setSelectedColleges(prev =>
      prev.includes(collegeId)
        ? prev.filter(id => id !== collegeId)
        : [...prev, collegeId]
    )
  }

  const createFederationEvent = () => {
    if (selectedColleges.length < 2) {
      enqueueSnackbar('Select at least 2 colleges for federation!', { variant: 'error' })
      return
    }

    // In real implementation, this would deploy a multi-sig contract
    enqueueSnackbar('🌐 Federation event created! All colleges can now contribute.', { variant: 'success' })
    setShowCreateModal(false)
    
    const newFedEvent: FederationEvent = {
      id: Date.now(),
      title: newEvent.title,
      colleges: selectedColleges,
      totalFunding: 0,
      ticketsSold: 0,
      status: 'planning'
    }
    
    setFederationEvents([...federationEvents, newFedEvent])
    setSelectedColleges([])
    setNewEvent({
      title: '',
      description: '',
      venue: '',
      date: new Date(Date.now() + 2592000000).toISOString().substring(0, 16),
      sharedPool: '10000'
    })
  }

  const formatAddress = (addr: string) => {
    return addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 animate-gradient-shift">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg border-b-4 border-gradient-to-r from-indigo-500 to-purple-500">
        <div className="max-w-7xl mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-ghost btn-sm"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              🌐 Cross-Campus Federation
            </h1>
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="btn btn-primary btn-sm hover:scale-110 transition-transform duration-300 shadow-lg bg-gradient-to-r from-indigo-500 to-purple-500 border-0"
            >
              ✨ Create Federation Event
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="badge badge-warning animate-pulse">DEMO MODE</div>
            <div className="badge badge-info">National Network</div>
            {activeAddress && (
              <div className="badge badge-success">{formatAddress(activeAddress)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Demo Mode Notice */}
        <div className="alert alert-warning shadow-lg mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <h3 className="font-bold">🎭 Demonstration Mode - Mock Data</h3>
            <div className="text-sm">
              This page demonstrates <strong>Cross-Campus Federation</strong> with simulated events (VIT+MIT+SRM+SASTRA partnerships). 
              In production, this would deploy:
              <ul className="list-disc list-inside mt-1 ml-4">
                <li>Multi-signature contracts for shared funding pools</li>
                <li>Portable reputation tracking across college networks</li>
                <li>Cross-campus event ticketing and verification</li>
              </ul>
              <p className="mt-2 font-semibold">✅ Individual campaigns/events are LIVE with REAL contracts. Federation layer is conceptual UI.</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="alert bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-2xl mb-8">
          <div>
            <h3 className="font-bold text-xl">🚀 Building a National College Network</h3>
            <p className="text-sm opacity-90 mt-1">
              4 colleges connected • Shared funding pool: ₹6.75L • Portable reputation across campuses
            </p>
            <p className="text-xs opacity-75 mt-2">
              💡 When a student transfers colleges, their POAPs and reputation follow them on-chain!
            </p>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="stat bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="stat-title text-blue-100">Connected Colleges</div>
            <div className="stat-value text-white text-5xl">{COLLEGES.length}</div>
            <div className="stat-desc text-blue-100">🏫 Active institutions</div>
          </div>
          <div className="stat bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="stat-title text-purple-100">Federation Events</div>
            <div className="stat-value text-white text-5xl">{federationEvents.length}</div>
            <div className="stat-desc text-purple-100">🌐 Multi-campus coordination</div>
          </div>
          <div className="stat bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="stat-title text-orange-100">Total Participants</div>
            <div className="stat-value text-white text-5xl">
              {federationEvents.reduce((sum, e) => sum + e.ticketsSold, 0)}
            </div>
            <div className="stat-desc text-orange-100">👥 Across all colleges</div>
          </div>
          <div className="stat bg-gradient-to-br from-green-500 to-teal-600 text-white rounded-xl shadow-2xl hover:scale-105 transition-all duration-300">
            <div className="stat-title text-green-100">Shared Funding</div>
            <div className="stat-value text-white text-4xl">
              ₹{(federationEvents.reduce((sum, e) => sum + e.totalFunding, 0) / 1000).toFixed(0)}K
            </div>
            <div className="stat-desc text-green-100">💰 Pooled resources</div>
          </div>
        </div>

        {/* College Network Grid */}
        <h2 className="text-2xl font-bold mb-4">🏫 Network Colleges</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {COLLEGES.map((college) => (
            <div 
              key={college.id}
              className="card bg-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-purple-400 overflow-hidden group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${college.color} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
              <div className="card-body relative z-10">
                <div className="flex justify-between items-start">
                  <div className="avatar placeholder">
                    <div className={`bg-gradient-to-br ${college.color} text-white rounded-full w-12`}>
                      <span className="text-2xl">{college.name.substring(0, 1)}</span>
                    </div>
                  </div>
                  <div className="badge badge-success">Active</div>
                </div>
                <h3 className="font-bold text-lg mt-2">{college.name}</h3>
                <p className="text-sm text-gray-600">{college.location}</p>
                <div className="card-actions justify-end mt-4">
                  <button className="btn btn-sm btn-primary">View Profile</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Federation Events */}
        <h2 className="text-2xl font-bold mb-4">🌐 Federation Events</h2>
        <div className="grid grid-cols-1 gap-6">
          {federationEvents.map((event) => (
            <div 
              key={event.id}
              className="card bg-white shadow-xl hover:shadow-2xl transition-all duration-300"
            >
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="card-title text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      {event.title}
                    </h3>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {event.colleges.map((collegeId) => {
                        const college = COLLEGES.find(c => c.id === collegeId)
                        return college ? (
                          <div 
                            key={collegeId}
                            className={`badge badge-lg bg-gradient-to-r ${college.color} text-white border-0`}
                          >
                            {college.name}
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                  <div className={`badge badge-lg ${
                    event.status === 'active' ? 'badge-success' :
                    event.status === 'planning' ? 'badge-warning' : 'badge-info'
                  }`}>
                    {event.status.toUpperCase()}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="stat bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg">
                    <div className="stat-title text-xs">Colleges</div>
                    <div className="stat-value text-2xl text-blue-600">{event.colleges.length}</div>
                  </div>
                  <div className="stat bg-gradient-to-br from-green-50 to-teal-50 rounded-lg">
                    <div className="stat-title text-xs">Total Funding</div>
                    <div className="stat-value text-2xl text-green-600">₹{(event.totalFunding / 1000).toFixed(0)}K</div>
                  </div>
                  <div className="stat bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                    <div className="stat-title text-xs">Participants</div>
                    <div className="stat-value text-2xl text-purple-600">{event.ticketsSold}</div>
                  </div>
                </div>

                <div className="divider"></div>

                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1">
                    View Details
                  </button>
                  <button className="btn btn-outline btn-secondary">
                    Contribute Funds
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Federation Event Modal */}
      {showCreateModal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <button 
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setShowCreateModal(false)}
            >
              ✕
            </button>
            
            <h3 className="font-bold text-2xl mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              🌐 Create Federation Event
            </h3>

            <div className="alert alert-info mb-4">
              <span className="text-sm">
                <strong>Federation Events:</strong> Multi-college mega-events with shared funding pools. 
                Reputation and tickets are portable across all participating colleges!
              </span>
            </div>

            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Event Title *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                  placeholder="e.g., Inter-Campus Tech Summit 2026"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Select Participating Colleges * (min 2)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {COLLEGES.map((college) => (
                    <div 
                      key={college.id}
                      onClick={() => toggleCollege(college.id)}
                      className={`card cursor-pointer transition-all duration-300 ${
                        selectedColleges.includes(college.id)
                          ? `bg-gradient-to-br ${college.color} text-white shadow-lg scale-105`
                          : 'bg-base-200 hover:bg-base-300'
                      }`}
                    >
                      <div className="card-body p-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedColleges.includes(college.id)}
                            onChange={() => {}}
                            className="checkbox"
                          />
                          <div>
                            <h4 className="font-bold">{college.name}</h4>
                            <p className="text-xs opacity-75">{college.location}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="label">
                  <span className="label-text-alt">{selectedColleges.length} colleges selected</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Event Date *</span>
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
                    <span className="label-text font-semibold">Venue *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent({...newEvent, venue: e.target.value})}
                    placeholder="e.g., VIT Main Auditorium"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Shared Funding Pool (₹) *</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={newEvent.sharedPool}
                  onChange={(e) => setNewEvent({...newEvent, sharedPool: e.target.value})}
                  placeholder="Total funding goal across all colleges"
                />
                <label className="label">
                  <span className="label-text-alt text-info">
                    Each college contributes equally: ₹{selectedColleges.length > 0 ? Math.floor(parseInt(newEvent.sharedPool || '0') / selectedColleges.length) : 0}/college
                  </span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Description *</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-24"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                  placeholder="Describe the mega-event..."
                />
              </div>

              <button 
                className="btn btn-lg w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 hover:scale-105 transition-transform"
                onClick={createFederationEvent}
                disabled={!newEvent.title || !newEvent.venue || selectedColleges.length < 2}
              >
                🚀 Deploy Federation Contract
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowCreateModal(false)} />
        </dialog>
      )}
    </div>
  )
}

export default FederationPage
