import { useWallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConnectWallet from './components/ConnectWallet'
import SendAlgo from './components/SendAlgo'
import CreateASA from './components/CreateASA'
import AssetOptIn from './components/AssetOptIn'
import AppCalls from './components/AppCalls'
import Bank from './components/Bank'

const Home = () => {
  const navigate = useNavigate()
  const { activeAddress } = useWallet()

  // Modal state
  const [openWalletModal, setOpenWalletModal] = useState(false)
  const [sendAlgoModal, setSendAlgoModal] = useState(false)
  const [createAsaModal, setCreateAsaModal] = useState(false)
  const [assetOptInModal, setAssetOptInModal] = useState(false)
  const [appCallsDemoModal, setAppCallsDemoModal] = useState(false)
  const [bankModal, setBankModal] = useState(false)

  const toggleWalletModal = () => setOpenWalletModal(!openWalletModal)

  return (
    <div className="min-h-screen bg-gradient-to-tr from-teal-400 via-cyan-400 to-blue-500 bg-300% animate-gradient-shift relative flex items-center justify-center px-4 -mt-20 pt-20">
      {/* Wallet Connect — Top Right */}
      <button
        className="absolute top-24 right-6 z-10 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold px-6 py-3 rounded-full shadow-2xl hover:shadow-cyan-500/50 hover:scale-110 transition-all duration-300 border-0"
        onClick={toggleWalletModal}
        disabled={!!activeAddress}
      >
        {activeAddress ? '✅ Wallet Connected' : '🔗 Connect Wallet'}
      </button>

      {/* Main Frosted Card */}
      <div className="max-w-6xl w-full p-10 backdrop-blur-xl bg-white/80 border-4 border-white/50 hover:border-purple-300 rounded-3xl shadow-2xl transition-all duration-500">
        {/* Heading */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
          CampusChain: Simple Campus Finance on Algorand
        </h1>
        <p className="text-center text-xl font-semibold text-gray-700 mb-10">
          Blockchain operations, decentralized and powerful. 🚀
        </p>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* ──── Row 1: Basic Operations ──── */}

          {/* Send Algo */}
          <div className="card bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-xl hover:scale-105 hover:shadow-sky-500/50 transition-all duration-300">
            <div className="card-body">
              <h2 className="card-title">💸 Send Algo</h2>
              <p>Send a payment transaction to any address.</p>
              <div className="card-actions justify-end">
                <button
                  className="btn btn-outline border-white/60 text-white hover:bg-white hover:text-sky-600"
                  disabled={!activeAddress}
                  onClick={() => setSendAlgoModal(true)}
                >
                  Open
                </button>
              </div>
            </div>
          </div>

          {/* Create Token (ASA) */}
          <div className="card bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-xl hover:scale-105 hover:shadow-emerald-500/50 transition-all duration-300">
            <div className="card-body">
              <h2 className="card-title">🪙 Create Token (ASA)</h2>
              <p>Mint a fungible ASA with custom supply and decimals.</p>
              <div className="card-actions justify-end">
                <button
                  className="btn btn-outline border-white/60 text-white hover:bg-white hover:text-emerald-600"
                  disabled={!activeAddress}
                  onClick={() => setCreateAsaModal(true)}
                >
                  Open
                </button>
              </div>
            </div>
          </div>

          {/* Asset Opt-In */}
          <div className="card bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-xl hover:scale-105 hover:shadow-indigo-500/50 transition-all duration-300">
            <div className="card-body">
              <h2 className="card-title">✅ Asset Opt-In</h2>
              <p>Opt-in to any existing ASA to receive tokens.</p>
              <div className="card-actions justify-end">
                <button
                  className="btn btn-outline border-white/60 text-white hover:bg-white hover:text-indigo-600"
                  disabled={!activeAddress}
                  onClick={() => setAssetOptInModal(true)}
                >
                  Open
                </button>
              </div>
            </div>
          </div>

          {/* ──── Row 2: Demo Apps ──── */}

          {/* Counter */}
          <div className="card bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl md:col-span-2 lg:col-span-1 hover:scale-105 hover:shadow-orange-500/50 transition-all duration-300">
            <div className="card-body">
              <h2 className="card-title">🔢 Counter</h2>
              <p>Interact with the shared on-chain counter app.</p>
              <div className="card-actions justify-end">
                <button
                  className="btn btn-outline border-white/60 text-white hover:bg-white hover:text-orange-600"
                  data-test-id="appcalls-demo"
                  disabled={!activeAddress}
                  onClick={() => setAppCallsDemoModal(true)}
                >
                  Open
                </button>
              </div>
            </div>
          </div>

          {/* Bank */}
          <div className="card bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-xl md:col-span-2 lg:col-span-1 hover:scale-105 hover:shadow-rose-500/50 transition-all duration-300">
            <div className="card-body">
              <h2 className="card-title">🏛️ Bank</h2>
              <p>Deposit and withdraw ALGOs and view statements.</p>
              <div className="card-actions justify-end">
                <button
                  className="btn btn-outline border-white/60 text-white hover:bg-white hover:text-rose-600"
                  disabled={!activeAddress}
                  onClick={() => setBankModal(true)}
                >
                  Open
                </button>
              </div>
            </div>
          </div>

          {/* Spacer on desktop so Row 3 starts fresh */}
          <div className="hidden lg:block" />

          {/* ──── Row 3: MAIN FEATURE CARDS ──── */}

          {/* Campaign */}
          <div className="card bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-2xl md:col-span-2 lg:col-span-1 hover:scale-105 hover:shadow-purple-500/50 transition-all duration-300 border-2 border-purple-300">
            <div className="card-body">
              <h2 className="card-title text-2xl">🏦 Campaign</h2>
              <p className="text-purple-100">Milestone-based crowdfunding • 100% goal protection</p>
              <div className="card-actions justify-end">
                <button
                  className="btn btn-outline hover:bg-white hover:text-purple-600 border-2 text-white"
                  onClick={() => navigate('/dashboard')}
                >
                  Launch 🚀
                </button>
              </div>
            </div>
          </div>

          {/* Event Ticket System */}
          <div className="card bg-gradient-to-br from-pink-600 to-rose-600 text-white shadow-2xl md:col-span-2 lg:col-span-1 hover:scale-105 hover:shadow-pink-500/50 transition-all duration-300 border-2 border-pink-300">
            <div className="card-body">
              <h2 className="card-title text-2xl">🎫 Event Ticket System</h2>
              <p className="text-pink-100">NFT tickets • QR verification • Anti-scalping</p>
              <div className="card-actions justify-end">
                <button
                  className="btn btn-outline hover:bg-white hover:text-pink-600 border-2 text-white"
                  onClick={() => navigate('/dashboard')}
                >
                  Launch 🚀
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
      <SendAlgo openModal={sendAlgoModal} closeModal={() => setSendAlgoModal(false)} />
      <CreateASA openModal={createAsaModal} closeModal={() => setCreateAsaModal(false)} />
      <AssetOptIn openModal={assetOptInModal} closeModal={() => setAssetOptInModal(false)} />
      <AppCalls openModal={appCallsDemoModal} setModalState={setAppCallsDemoModal} />
      <Bank openModal={bankModal} closeModal={() => setBankModal(false)} />
    </div>
  )
}

export default Home
