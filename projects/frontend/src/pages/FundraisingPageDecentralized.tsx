import React, { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Base/Card';
import { BrandButton } from '../components/Base/BrandButton';
import { ProgressBar } from '../components/Base/ProgressBar';
import { Search, SlidersHorizontal, Clock, Tag, Loader2 } from 'lucide-react';
import { VoteButtons } from '../components/Base/VoteButtons';
import { listenToCampaigns, initializeFirebase, FirebaseCampaign } from '../utils/firebase';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs';
import { getCampaignState } from '../utils/blockchainData';

interface Project {
  id: number;
  title: string;
  creator: string;
  goal: number;
  current: number;
  description: string;
  category: string;
  deadline: string;
  appId?: string;
  isOnChain?: boolean;
}

const mockProjects: Project[] = [
  {
    id: 1,
    title: 'Eco-Drone Reforestation',
    creator: 'Jane Doe',
    goal: 5000,
    current: 3200,
    description: 'Autonomous drones for rapid tree planting in deforested regions using AI-driven soil analysis.',
    category: 'Environment',
    deadline: '12 Days Left'
  },
  {
    id: 2,
    title: 'Quantum Encryption Chat',
    creator: 'Alex Smith',
    goal: 2000,
    current: 450,
    description: 'A decentralized messaging app protected by quantum-proof cryptography algorithms.',
    category: 'Tech',
    deadline: '45 Days Left'
  },
  {
    id: 3,
    title: 'Hydra: Water Purification',
    creator: 'Sarah Lee',
    goal: 8000,
    current: 7800,
    description: 'Low-cost, solar-powered water purification units for rural communities.',
    category: 'Social Impact',
    deadline: '3 Days Left'
  }
];

const firebaseCampaignToProject = (campaign: FirebaseCampaign): Project => {
  const goalAlgo = parseFloat(campaign.goal) || 0;
  const createdDate = new Date(campaign.createdAt);
  const daysAgo = Math.floor((Date.now() - campaign.createdAt) / 86400000);
  const deadlineDays = Math.max(30 - daysAgo, 0);

  return {
    id: parseInt(campaign.appId) || Date.now(),
    title: campaign.title || 'Untitled Campaign',
    creator: campaign.creator
      ? `${campaign.creator.slice(0, 6)}...${campaign.creator.slice(-4)}`
      : 'Unknown',
    goal: goalAlgo,
    current: 0,
    description: campaign.description || 'A decentralized campaign on Algorand.',
    category: 'On-Chain',
    deadline: deadlineDays > 0 ? `${deadlineDays} Days Left` : 'Ended',
    appId: campaign.appId,
    isOnChain: true,
  };
};

const FundraisingPageDecentralized: React.FC = () => {
  const { activeAddress } = useWallet();
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [firebaseProjects, setFirebaseProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Load campaigns from Firebase, then fetch on-chain raised amounts
  useEffect(() => {
    initializeFirebase();
    const unsubscribe = listenToCampaigns(async (campaigns: FirebaseCampaign[]) => {
      const projects = campaigns.map(firebaseCampaignToProject);

      // Fetch on-chain raised amounts in the background
      try {
        const algodConfig = getAlgodConfigFromViteEnvironment();
        const indexerConfig = getIndexerConfigFromViteEnvironment();
        const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig });

        const enriched = await Promise.all(
          projects.map(async (p) => {
            if (!p.appId) return p;
            try {
              const state = await getCampaignState(algorand, {
                appId: parseInt(p.appId),
                creator: '',
                createdAt: 0,
              });
              if (state) {
                return {
                  ...p,
                  current: Number(state.raisedAmount) / 1_000_000,
                  goal: Number(state.goalAmount) / 1_000_000 || p.goal,
                };
              }
            } catch (err) {
              console.warn(`Could not fetch chain state for ${p.appId}:`, err);
            }
            return p;
          })
        );
        setFirebaseProjects(enriched);
      } catch {
        setFirebaseProjects(projects);
      }
      setLoading(false);
    });
    // If Firebase isn't configured, loading will resolve via the empty callback
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Merge Firebase (on-chain) campaigns with mock demos — Firebase first
  const allProjects = [...firebaseProjects, ...mockProjects];

  const categories = ['All', 'On-Chain', ...new Set(mockProjects.map(p => p.category))];

  const filteredProjects = allProjects.filter(p => 
    (filter === 'All' || p.category === filter) &&
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className='max-w-7xl mx-auto space-y-10 pb-20'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-end gap-6 border-b border-zinc-800 pb-8'>
        <div>
          <h1 className='text-3xl font-display font-semibold text-white mb-2'>
            Explore Projects
          </h1>
          <p className='text-zinc-400'>Discover and fund the next generation of builders.</p>
        </div>
        
        <div className='flex gap-3 w-full md:w-auto'>
          <div className='relative flex-grow md:flex-grow-0 group'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors' />
            <input 
              type='text' 
              placeholder='Search projects...' 
              className='w-full md:w-64 bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-all'
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className='flex gap-2 flex-wrap'>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filter === cat
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className='flex items-center justify-center py-12 gap-3 text-zinc-400'>
          <Loader2 className='w-5 h-5 animate-spin' />
          <span>Loading campaigns...</span>
        </div>
      )}

      {/* Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {filteredProjects.map((project) => (
          <Link key={`${project.appId || project.id}`} to={`/project/${project.appId || project.id}`} className='block'>
          <Card hoverable className='flex flex-col h-full group'>
            <div className='flex justify-between items-start mb-4'>
              <div className='flex gap-2 items-center'>
                <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700'>
                  <Tag className='w-3 h-3' />
                  {project.category}
                </span>
                {project.isOnChain && (
                  <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'>
                    ✓ Live
                  </span>
                )}
              </div>
              <VoteButtons projectId={project.id} layout='row' />
            </div>

            <h3 className='text-xl font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors'>
              {project.title}
            </h3>
            
            <p className='text-sm text-zinc-400 mb-6 flex-grow line-clamp-3 leading-relaxed'>
              {project.description}
            </p>

            <div className='space-y-5 pt-5 border-t border-zinc-800/50'>
              <ProgressBar 
                progress={project.current} 
                max={project.goal} 
                label='Funding Progress'
                sublabel={`${Math.round((project.current / project.goal) * 100)}%`}
                color='indigo'
              />
              
              <div className='flex justify-between items-center text-sm'>
                <div className='text-white font-medium'>
                  {project.current.toLocaleString()} <span className='text-zinc-500'>/ {project.goal.toLocaleString()} ALGO</span>
                </div>
              </div>

              <BrandButton 
                fullWidth 
                className='shadow-none'
              >
                {project.isOnChain ? 'View & Donate' : 'Back this Project'}
              </BrandButton>
            </div>
          </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default FundraisingPageDecentralized;
