import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { WalletId, WalletManager, NetworkId } from '@txnlab/use-wallet'
import { WalletProvider } from '@txnlab/use-wallet-react'
import { SnackbarProvider } from 'notistack'

const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.LUTE],
  defaultNetwork: NetworkId.TESTNET,
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <WalletProvider manager={walletManager}>
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <App />
      </SnackbarProvider>
    </WalletProvider>
  </React.StrictMode>,
)
