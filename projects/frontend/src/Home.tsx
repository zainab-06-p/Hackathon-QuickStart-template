// src/components/Home.tsx
import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConnectWallet from './components/ConnectWallet'
import AppCalls from './components/AppCalls'
import SendAlgo from './components/SendAlgo'
import CreateASA from './components/CreateASA'
import AssetOptIn from './components/AssetOptIn'
import Bank from './components/Bank'

interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const navigate = useNavigate()
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [appCallsDemoModal, setAppCallsDemoModal] = useState<boolean>(false)
  const [sendAlgoModal, setSendAlgoModal] = useState<boolean>(false)
  const [createAsaModal, setCreateAsaModal] = useState<boolean>(false)
  const [assetOptInModal, setAssetOptInModal] = useState<boolean>(false)
  const [bankModal, setBankModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  const toggleAppCallsModal = () => {
    setAppCallsDemoModal(!appCallsDemoModal)
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-teal-400 via-cyan-400 to-blue-500 relative animate-gradient-shift">
      {/* Top-right wallet connect button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          data-test-id="connect-wallet"
          className="btn btn-accent px-6 py-3 text-sm font-bold rounded-full shadow-2xl hover:shadow-cyan-500/50 hover:scale-110 transition-all duration-300 bg-gradient-to-r from-purple-500 to-pink-500 border-0"
          onClick={toggleWalletModal}
        >
          {activeAddress ? '✅ Wallet Connected' : '🔗 Connect Wallet'}
        </button>
      </div>

      {/* Centered content with background blur for readability */}
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="backdrop-blur-xl bg-white/80 rounded-3xl p-10 shadow-2xl max-w-6xl w-full border-4 border-white/50 hover:border-purple-300 transition-all duration-500">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4 text-center animate-pulse">
            CampusChain: Simple Campus Finance on Algorand
          </h1>
          <p className="text-gray-700 mb-10 text-center text-xl font-semibold">Blockchain operations, decentralized and powerful. 🚀</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Send Algo</h2>
                <p>Send a payment transaction to any address.</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-outline" disabled={!activeAddress} onClick={() => setSendAlgoModal(true)}>Open</button>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Create Token (ASA)</h2>
                <p>Mint a fungible ASA with custom supply and decimals.</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-outline" disabled={!activeAddress} onClick={() => setCreateAsaModal(true)}>Open</button>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Asset Opt-In</h2>
                <p>Opt-in to any existing ASA to receive tokens.</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-outline" disabled={!activeAddress} onClick={() => setAssetOptInModal(true)}>Open</button>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl md:col-span-2 lg:col-span-1">
              <div className="card-body">
                <h2 className="card-title">Counter</h2>
                <p>Interact with the shared on-chain counter app.</p>
                <div className="card-actions justify-end">
                  <button
                    data-test-id="appcalls-demo"
                    className="btn btn-outline"
                    disabled={!activeAddress}
                    onClick={toggleAppCallsModal}
                  >
                    Open
                  </button>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-xl md:col-span-2 lg:col-span-1">
              <div className="card-body">
                <h2 className="card-title">Bank</h2>
                <p>Deposit and withdraw ALGOs and view statements.</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-outline" disabled={!activeAddress} onClick={() => setBankModal(true)}>Open</button>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-2xl md:col-span-2 lg:col-span-1 hover:scale-105 hover:shadow-purple-500/50 transition-all duration-300 border-2 border-purple-300">
              <div className="card-body">
                <h2 className="card-title text-2xl">🏦 Campus Fundraiser</h2>
                <p className="text-purple-100">Milestone-based crowdfunding • 100% goal protection</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-outline hover:bg-white hover:text-purple-600 border-2" onClick={() => navigate('/fundraising')}>Launch 🚀</button>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-pink-600 to-rose-600 text-white shadow-2xl md:col-span-2 lg:col-span-1 hover:scale-105 hover:shadow-pink-500/50 transition-all duration-300 border-2 border-pink-300">
              <div className="card-body">
                <h2 className="card-title text-2xl">🎫 Event Ticketing</h2>
                <p className="text-pink-100">NFT tickets • QR verification • Anti-scalping</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-outline hover:bg-white hover:text-pink-600 border-2" onClick={() => navigate('/ticketing')}>Launch 🚀</button>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-yellow-500 to-orange-600 text-white shadow-2xl md:col-span-2 lg:col-span-1 hover:scale-105 hover:shadow-orange-500/50 transition-all duration-300 border-2 border-orange-300">
              <div className="card-body">
                <h2 className="card-title text-2xl">📋 My History</h2>
                <p className="text-orange-100">Track campaigns, tickets & donations</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-outline hover:bg-white hover:text-orange-600 border-2" onClick={() => navigate('/history')}>View 👀</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
      <AppCalls openModal={appCallsDemoModal} setModalState={setAppCallsDemoModal} />
      <SendAlgo openModal={sendAlgoModal} closeModal={() => setSendAlgoModal(false)} />
      <CreateASA openModal={createAsaModal} closeModal={() => setCreateAsaModal(false)} />
      <AssetOptIn openModal={assetOptInModal} closeModal={() => setAssetOptInModal(false)} />
      <Bank openModal={bankModal} closeModal={() => setBankModal(false)} />
    </div>
  )
}

export default Home
