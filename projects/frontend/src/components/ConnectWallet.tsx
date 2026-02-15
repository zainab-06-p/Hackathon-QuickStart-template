import React from 'react'
import { useWallet, Wallet } from '@txnlab/use-wallet-react'
import { Card } from './Base/Card'
import { BrandButton } from './Base/BrandButton'
import { X, LogOut, Check, Wallet as WalletIcon, ExternalLink } from 'lucide-react'

export interface ConnectWalletProps {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet: React.FC<ConnectWalletProps> = ({ openModal, closeModal }) => {
  const { wallets, activeWallet, activeAddress } = useWallet()

  if (!openModal) return null

  const handleConnect = async (wallet: Wallet) => {
    try {
      await wallet.connect()
    } catch (e) {
      console.error('Connection failed:', e)
    }
  }

  const handleDisconnect = async () => {
    if (activeWallet) {
      await activeWallet.disconnect()
    }
  }

  const handleSetActive = (address: string) => {
    if (activeWallet) {
      activeWallet.setActiveAccount(address)
    }
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
              {activeWallet ? 'Wallet Connected' : 'Connect Wallet'}
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              {activeWallet 
                ? `Connected via ${activeWallet.metadata.name}`
                : 'Select a provider to continue'
              }
            </p>
          </div>
          <button 
            onClick={closeModal}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!activeWallet ? (
            <div className="space-y-3">
              {wallets?.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => handleConnect(wallet)}
                  className="w-full group relative flex items-center justify-between p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-indigo-500/50 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white p-2 flex items-center justify-center shadow-lg">
                      <img 
                        src={wallet.metadata.icon} 
                        alt={wallet.metadata.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {wallet.metadata.name}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {wallet.id === 'pera' ? 'Mobile & Web Wallet' : wallet.id === 'lute' ? 'Browser Extension' : wallet.metadata.name}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-700 group-hover:border-indigo-500 group-hover:bg-indigo-500/10 transition-colors">
                    <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-indigo-400" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                 <div className="flex items-center gap-3 mb-4">
                   <div className="w-8 h-8 rounded-lg bg-white p-1.5 shadow-sm">
                      <img 
                        src={activeWallet.metadata.icon} 
                        alt={activeWallet.metadata.name}
                        className="w-full h-full object-contain"
                      />
                   </div>
                   <div className="flex-1">
                      <div className="font-semibold text-white">{activeWallet.metadata.name}</div>
                      <div className="text-xs text-zinc-500">{activeWallet.accounts.length} Accounts Found</div>
                   </div>
                 </div>

                 <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                   {activeWallet.accounts.map((account) => (
                     <button
                       key={account.address}
                       onClick={() => handleSetActive(account.address)}
                       className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                         account.address === activeAddress
                           ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/20'
                           : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
                       }`}
                     >
                       <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full ${account.address === activeAddress ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-zinc-600'}`} />
                         <span className={`font-mono text-sm ${account.address === activeAddress ? 'text-white' : 'text-zinc-400'}`}>
                           {formatAddress(account.address)}
                         </span>
                       </div>
                       {account.address === activeAddress && (
                         <Check className="w-4 h-4 text-indigo-400" />
                       )}
                     </button>
                   ))}
                 </div>
              </div>

              <BrandButton 
                variant="danger" 
                fullWidth={true}
                onClick={handleDisconnect}
                className="flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Wallet
              </BrandButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ConnectWallet
