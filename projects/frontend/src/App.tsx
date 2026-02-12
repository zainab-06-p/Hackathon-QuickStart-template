import { SupportedWallet, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { SnackbarProvider } from 'notistack'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './Home'
import FundraisingPageDecentralized from './pages/FundraisingPageDecentralized'
import TicketingPageDecentralized from './pages/TicketingPageDecentralized'
import CreateCampaignPage from './pages/CreateCampaignPage'
import CreateEventPage from './pages/CreateEventPage'
import HistoryPage from './pages/HistoryPage'
import FederationPage from './pages/FederationPage'
import NFTEvolutionPage from './pages/NFTEvolutionPage'
import ReputationDAOPage from './pages/ReputationDAOPage'
import { getAlgodConfigFromViteEnvironment, getKmdConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

let supportedWallets: SupportedWallet[]
if (import.meta.env.VITE_ALGOD_NETWORK === 'localnet') {
  const kmdConfig = getKmdConfigFromViteEnvironment()
  supportedWallets = [
    {
      id: WalletId.KMD,
      options: {
        baseServer: kmdConfig.server,
        token: String(kmdConfig.token),
        port: String(kmdConfig.port),
      },
    },
  ]
} else {
  supportedWallets = [
    { id: WalletId.DEFLY },
    { id: WalletId.PERA },
    { id: WalletId.EXODUS },
    { id: WalletId.LUTE },
    // If you are interested in WalletConnect v2 provider
    // refer to https://github.com/TxnLab/use-wallet for detailed integration instructions
  ]
}

export default function App() {
  const algodConfig = getAlgodConfigFromViteEnvironment()

  const walletManager = new WalletManager({
    wallets: supportedWallets,
    defaultNetwork: algodConfig.network,
    networks: {
      [algodConfig.network]: {
        algod: {
          baseServer: algodConfig.server,
          port: algodConfig.port,
          token: String(algodConfig.token),
        },
      },
    },
    options: {
      resetNetwork: true,
    },
  })

  return (
    <SnackbarProvider maxSnack={3}>
      <WalletProvider manager={walletManager}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/fundraising" element={<FundraisingPageDecentralized />} />
            <Route path="/fundraising/create" element={<CreateCampaignPage />} />
            <Route path="/fundraising/reputation" element={<ReputationDAOPage />} />
            <Route path="/ticketing" element={<TicketingPageDecentralized />} />
            <Route path="/ticketing/create" element={<CreateEventPage />} />
            <Route path="/ticketing/nft-evolution" element={<NFTEvolutionPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/federation" element={<FederationPage />} />
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </SnackbarProvider>
  )
}
