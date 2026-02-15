import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import FundraisingPageDecentralized from './pages/FundraisingPageDecentralized';
import FundTrackerPage from './pages/FundTrackerPage';
import SavingsPoolPage from './pages/SavingsPoolPage';
import MarketplacePage from './pages/MarketplacePage';
import StudyGroupPage from './pages/StudyGroupPage';
import CreateCampaignPage from './pages/CreateCampaignPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import MarketplaceDetailPage from './pages/MarketplaceDetailPage';
import LeaderboardPage from './pages/LeaderboardPage';
import TicketingPageDecentralized from './pages/TicketingPageDecentralized';
import CreateEventPage from './pages/CreateEventPage';
import FederationPage from './pages/FederationPage';
import NFTEvolutionPage from './pages/NFTEvolutionPage';
import ExplorerPage from './pages/ExplorerPage';
import { Navbar } from './components/Navbar';
import { Toaster } from 'react-hot-toast';
import { VotingProvider } from './utils/votingContext';

function App() {
  return (
    <Router>
      <VotingProvider>
      <div className='min-h-screen bg-background text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200'>
        <Navbar />
        
        {/* Main Content Area */}
        <main className='pt-20 px-4 md:px-0 max-w-7xl mx-auto'>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/fundraise' element={<FundraisingPageDecentralized />} />
            <Route path='/create-campaign' element={<CreateCampaignPage />} />
            <Route path='/fund-tracker' element={<FundTrackerPage />} />
            <Route path='/savings' element={<SavingsPoolPage />} />
            <Route path='/marketplace' element={<MarketplacePage />} />
            <Route path='/marketplace/:id' element={<MarketplaceDetailPage />} />
            <Route path='/project/:id' element={<ProjectDetailPage />} />
            <Route path='/leaderboard' element={<LeaderboardPage />} />
            <Route path='/study-group' element={<StudyGroupPage />} />
            <Route path='/ticketing' element={<TicketingPageDecentralized />} />
            <Route path='/ticketing/create' element={<CreateEventPage />} />
            <Route path='/ticketing/nft-evolution' element={<NFTEvolutionPage />} />
            <Route path='/federation' element={<FederationPage />} />
            <Route path='/explorer' element={<ExplorerPage />} />
            <Route path='/ticket-resale' element={<Navigate to="/marketplace" replace />} />
          </Routes>
        </main>
        
        <Toaster 
          position='bottom-right'
          toastOptions={{
            style: {
              background: '#18181B', // zinc-900
              color: '#fff',
              border: '1px solid #27272A', // zinc-800
            },
            success: {
              iconTheme: {
                primary: '#10B981', // emerald-500
                secondary: '#FFFFFF',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444', // red-500
                secondary: '#FFFFFF',
              },
            },
          }}
        />
      </div>
      </VotingProvider>
    </Router>
  );
}

export default App;
