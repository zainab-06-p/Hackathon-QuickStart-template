import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface NFTLevel {
  level: number
  name: string
  minXP: number
  color: string
  benefits: string[]
}

interface UserNFT {
  assetId: number
  level: number
  xp: number
  eventData: {
    eventsAttended: number
    campaignsSupported: number
    ticketsPurchased: number
    totalDonated: number
  }
}

const NFT_LEVELS: NFTLevel[] = [
  {
    level: 1,
    name: 'Bronze Freshman',
    minXP: 0,
    color: 'from-orange-700 to-orange-500',
    benefits: ['Basic event access', '5% ticket discount']
  },
  {
    level: 2,
    name: 'Silver Sophomore',
    minXP: 100,
    color: 'from-gray-500 to-gray-300',
    benefits: ['Priority registration', '10% ticket discount', 'Exclusive merch']
  },
  {
    level: 3,
    name: 'Gold Junior',
    minXP: 300,
    color: 'from-yellow-600 to-yellow-400',
    benefits: ['VIP seating', '15% ticket discount', 'Meet & greet access', 'Voting rights']
  },
  {
    level: 4,
    name: 'Platinum Senior',
    minXP: 600,
    color: 'from-cyan-500 to-blue-400',
    benefits: ['Backstage access', '20% ticket discount', 'Lifetime merch', 'DAO governance']
  },
  {
    level: 5,
    name: 'Diamond Alumni',
    minXP: 1000,
    color: 'from-purple-600 to-pink-500',
    benefits: ['All access pass', '30% ticket discount', 'Sponsor events', 'Full DAO control', 'Legacy perks']
  }
]

const NFTEvolutionPage = () => {
  const navigate = useNavigate()
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  // Mock user NFT data - in real app, fetch from blockchain
  const [userNFT] = useState<UserNFT>({
    assetId: 123456789,
    level: 2,
    xp: 247,
    eventData: {
      eventsAttended: 12,
      campaignsSupported: 5,
      ticketsPurchased: 18,
      totalDonated: 450
    }
  })

  const getCurrentLevel = () => NFT_LEVELS.find(l => l.level === userNFT.level) || NFT_LEVELS[0]
  const getNextLevel = () => NFT_LEVELS.find(l => l.level === userNFT.level + 1) || NFT_LEVELS[NFT_LEVELS.length - 1]

  const currentLevel = getCurrentLevel()
  const nextLevel = getNextLevel()
  const progressToNext = userNFT.level < 5 
    ? ((userNFT.xp - currentLevel.minXP) / (nextLevel.minXP - currentLevel.minXP)) * 100 
    : 100

  const formatAddress = (addr: string) => {
    return addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : ''
  }

  const xpActivities = [
    { action: 'Attend Event', xp: 10, icon: '🎫' },
    { action: 'Donate to Campaign', xp: 5, icon: '💰' },
    { action: 'Create Event', xp: 25, icon: '🎨' },
    { action: 'Purchase Ticket', xp: 8, icon: '🎟️' },
    { action: 'Early Bird Ticket', xp: 15, icon: '⏰' },
    { action: 'Refer Friend', xp: 20, icon: '👥' },
    { action: 'Write Review', xp: 12, icon: '⭐' },
    { action: 'Join DAO Vote', xp: 30, icon: '🗳️' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 animate-gradient-shift">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg border-b-4 border-gradient-to-r from-purple-500 to-pink-500">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              <button 
                onClick={() => navigate('/')} 
                className="btn btn-ghost btn-xs sm:btn-sm"
              >
                ← Back
              </button>
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                ⚡ NFT Evolution
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="badge badge-warning badge-xs sm:badge-sm animate-pulse">DEMO</div>
              <div className="badge badge-info badge-xs sm:badge-sm hidden sm:inline-flex">Gamification</div>
              {activeAddress && (
                <div className="badge badge-success badge-xs sm:badge-sm hidden md:inline-flex">{formatAddress(activeAddress)}</div>
              )}
            </div>
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
              This page demonstrates <strong>NFT Evolution</strong> gamification with simulated data (Level 2/5, 247 XP, 12 events attended). 
              In production, this would integrate:
              <ul className="list-disc list-inside mt-1 ml-4">
                <li>Track XP from REAL ticket purchases and event attendance</li>
                <li>Store level/XP data in NFT metadata on-chain</li>
                <li>Unlock benefits automatically via smart contract rules</li>
              </ul>
              <p className="mt-2 font-semibold">✅ Ticket NFT minting is LIVE and REAL. The XP/leveling system is conceptual UI.</p>
            </div>
          </div>
        </div>
        
        {/* Info Banner */}
        <div className="alert bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-2xl mb-8">
          <div>
            <h3 className="font-bold text-xl">🎮 Level Up Your Campus Experience!</h3>
            <p className="text-sm opacity-90 mt-1">
              Your NFT evolves like Pokémon! Attend events, donate to campaigns, and climb from Bronze → Silver → Gold → Platinum → Diamond
            </p>
            <p className="text-xs opacity-75 mt-2">
              💡 Higher levels unlock VIP access, discounts, and DAO governance power
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Your NFT Card */}
          <div className="lg:col-span-2">
            <div className="card bg-white shadow-2xl">
              <div className={`card-body bg-gradient-to-br ${currentLevel.color} text-white rounded-t-2xl`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="card-title text-3xl mb-2">Your Campus NFT</h2>
                    <div className="badge badge-lg bg-white/20 border-white/30">
                      Asset ID: {userNFT.assetId}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-bold">{userNFT.level}</div>
                    <div className="text-xs opacity-90">Level</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-lg">{currentLevel.name}</span>
                    <span className="text-sm">{userNFT.xp} / {nextLevel.minXP} XP</span>
                  </div>
                  <progress 
                    className="progress progress-accent w-full h-4 bg-white/30" 
                    value={progressToNext} 
                    max="100"
                  />
                  <p className="text-xs opacity-90 mt-2">
                    {userNFT.level < 5 
                      ? `${nextLevel.minXP - userNFT.xp} XP until ${nextLevel.name}`
                      : '🎉 Max level reached!'}
                  </p>
                </div>

                {/* 3D NFT Visual Placeholder */}
                <div className="mt-6 bg-white/20 rounded-xl p-8 text-center">
                  <div className="text-8xl mb-4">
                    {userNFT.level === 1 ? '🥉' : 
                     userNFT.level === 2 ? '🥈' : 
                     userNFT.level === 3 ? '🥇' : 
                     userNFT.level === 4 ? '💎' : '👑'}
                  </div>
                  <p className="font-bold text-2xl">{currentLevel.name}</p>
                  <p className="text-sm opacity-75 mt-2">Your NFT evolves as you engage!</p>
                </div>
              </div>

              <div className="card-body">
                <h3 className="font-bold text-xl mb-4">🎁 Current Benefits</h3>
                <ul className="space-y-2">
                  {currentLevel.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-center gap-3 bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-lg">
                      <span className="text-2xl">✨</span>
                      <span className="font-semibold">{benefit}</span>
                    </li>
                  ))}
                </ul>

                {userNFT.level < 5 && (
                  <>
                    <div className="divider">Next Level Unlocks</div>
                    <ul className="space-y-2">
                      {nextLevel.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-center gap-3 bg-base-200 p-3 rounded-lg opacity-50">
                          <span className="text-2xl">🔒</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stats & XP Earning */}
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="card bg-white shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg">📊 Your Activity</h3>
                <div className="space-y-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Events Attended</span>
                    <div className="badge badge-lg badge-primary">{userNFT.eventData.eventsAttended}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Campaigns Supported</span>
                    <div className="badge badge-lg badge-success">{userNFT.eventData.campaignsSupported}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Tickets Purchased</span>
                    <div className="badge badge-lg badge-info">{userNFT.eventData.ticketsPurchased}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Total Donated</span>
                    <div className="badge badge-lg badge-warning">₹{userNFT.eventData.totalDonated}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Earn XP Card */}
            <div className="card bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-xl">
              <div className="card-body">
                <h3 className="card-title text-lg">⚡ Earn XP</h3>
                <p className="text-sm opacity-90 mb-4">Level up by engaging with campus activities!</p>
                <div className="space-y-2">
                  {xpActivities.slice(0, 4).map((activity, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white/20 p-2 rounded-lg">
                      <span className="text-sm flex items-center gap-2">
                        <span className="text-xl">{activity.icon}</span>
                        {activity.action}
                      </span>
                      <div className="badge badge-sm bg-white text-purple-600 border-0">
                        +{activity.xp} XP
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-sm bg-white text-purple-600 hover:bg-purple-50 border-0 mt-4">
                  View All Activities
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Progression Path */}
        <div className="card bg-white shadow-xl mt-8">
          <div className="card-body">
            <h3 className="card-title text-2xl mb-6">🎯 Evolution Path</h3>
            <div className="hidden lg:block">
              <div className="flex justify-between items-start">
                {NFT_LEVELS.map((level, idx) => (
                  <div key={level.level} className="flex flex-col items-center flex-1">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl
                      ${userNFT.level >= level.level 
                        ? `bg-gradient-to-br ${level.color} text-white shadow-lg` 
                        : 'bg-gray-200 text-gray-400'}`}
                    >
                      {level.level === 1 ? '🥉' : 
                       level.level === 2 ? '🥈' : 
                       level.level === 3 ? '🥇' : 
                       level.level === 4 ? '💎' : '👑'}
                    </div>
                    <p className="font-bold mt-2 text-sm text-center">{level.name}</p>
                    <p className="text-xs text-gray-500">{level.minXP} XP</p>
                    {idx < NFT_LEVELS.length - 1 && (
                      <div className={`h-1 w-full mt-4 ${
                        userNFT.level > level.level ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:hidden space-y-4 mt-4">
              {NFT_LEVELS.map((level) => (
                <div 
                  key={level.level}
                  className={`p-4 rounded-lg ${
                    userNFT.level >= level.level 
                      ? `bg-gradient-to-br ${level.color} text-white` 
                      : 'bg-gray100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">
                      {level.level === 1 ? '🥉' : 
                       level.level === 2 ? '🥈' : 
                       level.level === 3 ? '🥇' : 
                       level.level === 4 ? '💎' : '👑'}
                    </div>
                    <div>
                      <p className="font-bold">{level.name}</p>
                      <p className="text-sm opacity-75">{level.minXP} XP required</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NFTEvolutionPage
