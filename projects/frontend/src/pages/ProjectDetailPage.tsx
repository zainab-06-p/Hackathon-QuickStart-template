import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import { Card } from '../components/Base/Card';
import { BrandButton } from '../components/Base/BrandButton';
import { ProgressBar } from '../components/Base/ProgressBar';
import { ImpactBadge } from '../components/Base/ImpactBadge';
import {
  ArrowLeft, Clock, Tag, Users, ShieldCheck, Activity,
  Heart, Share2, ExternalLink, CheckCircle2, TrendingUp,
  Globe, MessageSquare, Zap, Loader2
} from 'lucide-react';
import { VoteButtons } from '../components/Base/VoteButtons';
import { YieldTracker } from '../components/YieldTracker';
import { useVoting } from '../utils/votingContext';
import toast from 'react-hot-toast';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import * as algokit from '@algorandfoundation/algokit-utils';
import { FundraiserFactory } from '../contracts/FundraiserClient';
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs';
import { listenToCampaigns, initializeFirebase, FirebaseCampaign } from '../utils/firebase';
import { getCampaignState } from '../utils/blockchainData';

// Mock project data (same shape as FundraisingPageDecentralized)
const allProjects = [
  {
    id: 1,
    title: 'Eco-Drone Reforestation',
    creator: 'Jane Doe',
    creatorAddress: 'ABCDEF...WXYZ',
    goal: 5000,
    current: 3200,
    description: 'Autonomous drones for rapid tree planting in deforested regions using AI-driven soil analysis.',
    longDescription: `Our Eco-Drone Reforestation project aims to revolutionize how we restore degraded forests. Using a fleet of AI-powered drones equipped with seed pods, we can plant trees 10x faster than manual methods.\n\nThe drones use computer vision to identify optimal planting locations based on soil moisture, sunlight exposure, and existing vegetation patterns. Each drone carries 300 seed pods and can cover 2 hectares per flight.\n\nFunds will be used for:\n- Drone hardware and custom seed pod mechanisms\n- AI model training for terrain analysis\n- Field testing in 3 pilot locations\n- Community training programs for local operators`,
    category: 'Environment',
    deadline: '12 Days Left',
    milestones: [
      { title: 'Prototype Development', status: 'completed', amount: 1500 },
      { title: 'AI Training & Testing', status: 'active', amount: 2000 },
      { title: 'Pilot Deployment', status: 'pending', amount: 1500 },
    ],
    backers: 47,
    updates: [
      { date: 'Feb 10, 2026', text: 'Successfully completed first prototype drone flight test!' },
      { date: 'Jan 28, 2026', text: 'Reached 50% funding milestone. Thank you all for your support!' },
    ],
    image: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&q=80&w=1200',
  },
  {
    id: 2,
    title: 'Quantum Encryption Chat',
    creator: 'Alex Smith',
    creatorAddress: 'GHIJKL...STUV',
    goal: 2000,
    current: 450,
    description: 'A decentralized messaging app protected by quantum-proof cryptography algorithms.',
    longDescription: `Quantum computers threaten to break current encryption standards. Our project builds a messaging platform that uses post-quantum cryptographic algorithms to ensure messages remain private even against future quantum attacks.\n\nKey features:\n- Lattice-based encryption (CRYSTALS-Kyber)\n- Decentralized message relay network\n- Zero-knowledge proof identity verification\n- End-to-end encrypted group chats\n\nThis project directly addresses the growing need for quantum-resistant communication tools in academic and research settings.`,
    category: 'Tech',
    deadline: '45 Days Left',
    milestones: [
      { title: 'Protocol Design', status: 'completed', amount: 500 },
      { title: 'Core Library Development', status: 'active', amount: 800 },
      { title: 'UI & Beta Launch', status: 'pending', amount: 700 },
    ],
    backers: 18,
    updates: [
      { date: 'Feb 5, 2026', text: 'Published our protocol whitepaper for peer review.' },
    ],
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1200',
  },
  {
    id: 3,
    title: 'Hydra: Water Purification',
    creator: 'Sarah Lee',
    creatorAddress: 'MNOPQR...ABCD',
    goal: 8000,
    current: 7800,
    description: 'Low-cost, solar-powered water purification units for rural communities.',
    longDescription: `Hydra is a compact, solar-powered water purification system designed for communities without access to clean drinking water. Each unit can purify up to 500 liters per day using a multi-stage filtration process.\n\nThe system combines:\n- Solar-powered UV sterilization\n- Activated carbon filtration\n- Reverse osmosis membrane\n- IoT monitoring for maintenance alerts\n\nWe are partnering with 3 rural communities for initial deployment, with plans to scale to 50+ communities within 2 years. All designs will be open-source.`,
    category: 'Social Impact',
    deadline: '3 Days Left',
    milestones: [
      { title: 'Unit Design & Prototyping', status: 'completed', amount: 3000 },
      { title: 'Field Testing', status: 'completed', amount: 2500 },
      { title: 'Production & Deployment', status: 'active', amount: 2500 },
    ],
    backers: 124,
    updates: [
      { date: 'Feb 12, 2026', text: 'Field tests show 99.7% pathogen removal rate!' },
      { date: 'Feb 1, 2026', text: 'Second milestone approved by all approvers.' },
      { date: 'Jan 15, 2026', text: 'First 5 units assembled and shipped to test sites.' },
    ],
    image: 'https://images.unsplash.com/photo-1581093458791-9d42e3c7e117?auto=format&fit=crop&q=80&w=1200',
  },
];

const relatedProjects = [
  { id: 1, title: 'Eco-Drone Reforestation', category: 'Environment', progress: 64, goal: 5000 },
  { id: 2, title: 'Quantum Encryption Chat', category: 'Tech', progress: 22, goal: 2000 },
  { id: 3, title: 'Hydra: Water Purification', category: 'Social Impact', progress: 97, goal: 8000 },
];

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeAddress, transactionSigner } = useWallet();
  const [donateAmount, setDonateAmount] = useState('');
  const [isDonating, setIsDonating] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'milestones' | 'updates'>('about');
  const [firebaseCampaign, setFirebaseCampaign] = useState<FirebaseCampaign | null>(null);
  const [loadingFirebase, setLoadingFirebase] = useState(true);
  const [onChainRaised, setOnChainRaised] = useState<number | null>(null);
  const [onChainGoal, setOnChainGoal] = useState<number | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<[boolean, boolean, boolean] | null>(null);
  const [approverAddresses, setApproverAddresses] = useState<[string, string, string] | null>(null);
  const [onChainMilestone, setOnChainMilestone] = useState<{ current: number; total: number } | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // Load Firebase campaigns to check if this is an on-chain project
  useEffect(() => {
    initializeFirebase();
    const unsubscribe = listenToCampaigns((campaigns: FirebaseCampaign[]) => {
      const match = campaigns.find(c => c.appId === id);
      if (match) setFirebaseCampaign(match);
      setLoadingFirebase(false);
    });
    const timeout = setTimeout(() => setLoadingFirebase(false), 3000);
    return () => { unsubscribe(); clearTimeout(timeout); };
  }, [id]);

  // Fetch on-chain data (raised amount, approvals) for on-chain campaigns
  const fetchOnChainData = async () => {
    const appId = firebaseCampaign ? parseInt(firebaseCampaign.appId) : (mockProject ? null : Number(id));
    if (!appId || isNaN(appId)) return;

    try {
      const algodConfig = getAlgodConfigFromViteEnvironment();
      const indexerConfig = getIndexerConfigFromViteEnvironment();
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig });
      algorand.setDefaultValidityWindow(1000);

      const state = await getCampaignState(algorand, { appId, creator: '', createdAt: 0 });
      if (state) {
        setOnChainRaised(Number(state.raisedAmount) / 1_000_000);
        setOnChainGoal(Number(state.goalAmount) / 1_000_000);
        setOnChainMilestone({ current: Number(state.currentMilestone), total: Number(state.milestoneCount) });
      }

      // Fetch approval status and approvers using the FundraiserClient
      const factory = new FundraiserFactory({ defaultSender: activeAddress || undefined, algorand });
      const appClient = factory.getAppClientById({ appId: BigInt(appId) });
      
      try {
        const approvals = await appClient.send.getApprovalStatus({ args: [] });
        if (approvals.return) {
          setApprovalStatus(approvals.return as [boolean, boolean, boolean]);
        }
      } catch (e) { console.warn('Could not fetch approval status:', e); }

      try {
        const approvers = await appClient.send.getApprovers({ args: [] });
        if (approvers.return) {
          setApproverAddresses(approvers.return as [string, string, string]);
        }
      } catch (e) { console.warn('Could not fetch approvers:', e); }
    } catch (err) {
      console.warn('Could not fetch on-chain data:', err);
    }
  };

  useEffect(() => {
    if (firebaseCampaign || !mockProject) {
      fetchOnChainData();
      const interval = setInterval(fetchOnChainData, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
    return undefined;
  }, [firebaseCampaign, id, activeAddress]);

  // Approve milestone (on-chain)
  const handleApproveMilestone = async () => {
    if (!activeAddress) { toast.error('Connect your wallet first'); return; }
    setIsApproving(true);
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment();
      const indexerConfig = getIndexerConfigFromViteEnvironment();
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig });
      algorand.setDefaultSigner(transactionSigner);
      algorand.setDefaultValidityWindow(1000);

      const appId = firebaseCampaign ? parseInt(firebaseCampaign.appId) : Number(id);
      const factory = new FundraiserFactory({ defaultSender: activeAddress, algorand });
      const appClient = factory.getAppClientById({ appId: BigInt(appId) });

      toast.loading('Approving milestone...', { id: 'approve' });
      const result = await appClient.send.approveMilestone({ args: [], populateAppCallResources: true });
      const count = Number(result.return);
      toast.success(`Milestone approved! (${count}/3 approvals)`, { id: 'approve' });
      await fetchOnChainData();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Already approved') || msg.includes('already approved')) {
        toast.error('You have already approved this milestone', { id: 'approve' });
      } else if (msg.includes('Only approvers') || msg.includes('not an approver')) {
        toast.error('Your wallet is not an approver for this campaign', { id: 'approve' });
      } else if (msg.includes('user rejected') || msg.includes('cancelled')) {
        toast.error('Transaction cancelled', { id: 'approve' });
      } else {
        toast.error(`Approval failed: ${msg.slice(0, 80)}`, { id: 'approve' });
      }
    } finally {
      setIsApproving(false);
    }
  };

  // Release milestone funds (on-chain, creator only)
  const handleReleaseMilestone = async () => {
    if (!activeAddress) { toast.error('Connect your wallet first'); return; }
    setIsReleasing(true);
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment();
      const indexerConfig = getIndexerConfigFromViteEnvironment();
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig });
      algorand.setDefaultSigner(transactionSigner);
      algorand.setDefaultValidityWindow(1000);

      const appId = firebaseCampaign ? parseInt(firebaseCampaign.appId) : Number(id);
      const factory = new FundraiserFactory({ defaultSender: activeAddress, algorand });
      const appClient = factory.getAppClientById({ appId: BigInt(appId) });

      // Fund the app account with extra ALGO for MBR + inner txn fees
      // The contract checks: balance >= amount_per_milestone + 100,000 (0.1 ALGO)
      // If the contract only holds the raised amount, this will fail.
      toast.loading('Funding contract for release...', { id: 'release' });
      const appAddress = appClient.appAddress;
      await algorand.send.payment({
        sender: activeAddress,
        receiver: appAddress,
        amount: algokit.microAlgos(200_000), // 0.2 ALGO to cover MBR reservation + fees
      });

      toast.loading('Releasing milestone funds...', { id: 'release' });
      const result = await appClient.send.releaseMilestone({
        args: [],
        populateAppCallResources: true,
        coverAppCallInnerTransactionFees: true,
        maxFee: algokit.microAlgos(10_000), // cover outer + inner txn fees
      });
      const newMs = Number(result.return);
      toast.success(`Milestone ${newMs} funds released!`, { id: 'release' });
      await fetchOnChainData();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Only creator') || msg.includes('only creator')) {
        toast.error('Only the campaign creator can release funds', { id: 'release' });
      } else if (msg.includes('Not all approved') || msg.includes('approver')) {
        toast.error('All 3 approvers must sign before funds can be released', { id: 'release' });
      } else if (msg.includes('Insufficient balance') || msg.includes('assert failed')) {
        toast.error('Contract has insufficient balance. Try funding the contract first.', { id: 'release' });
      } else if (msg.includes('user rejected') || msg.includes('cancelled')) {
        toast.error('Transaction cancelled', { id: 'release' });
      } else {
        toast.error(`Release failed: ${msg.slice(0, 80)}`, { id: 'release' });
      }
    } finally {
      setIsReleasing(false);
    }
  };

  // Try static mock first, then Firebase
  const mockProject = allProjects.find(p => p.id === Number(id));

  // Build project from Firebase campaign if not a mock
  const project = mockProject || (firebaseCampaign ? {
    id: parseInt(firebaseCampaign.appId),
    title: firebaseCampaign.title || 'Untitled Campaign',
    creator: firebaseCampaign.creator
      ? `${firebaseCampaign.creator.slice(0, 6)}...${firebaseCampaign.creator.slice(-4)}`
      : 'Unknown',
    creatorAddress: firebaseCampaign.creator || 'Unknown',
    goal: onChainGoal ?? (parseFloat(firebaseCampaign.goal) || 0),
    current: onChainRaised ?? 0,
    description: firebaseCampaign.description || 'A decentralized campaign on Algorand.',
    longDescription: firebaseCampaign.description || 'This campaign is deployed on-chain via Algorand. Donations go directly to the smart contract escrow.\n\nAll milestone approvals require 3-of-3 multisig verification — fully decentralized with no middleman.',
    category: 'On-Chain',
    deadline: (() => {
      const daysAgo = Math.floor((Date.now() - firebaseCampaign.createdAt) / 86400000);
      const left = Math.max(30 - daysAgo, 0);
      return left > 0 ? `${left} Days Left` : 'Ended';
    })(),
    milestones: [
      { title: 'Campaign Launch', status: 'completed' as const, amount: 0 },
      { title: 'Funding Goal', status: 'active' as const, amount: parseFloat(firebaseCampaign.goal) || 0 },
      { title: 'Final Delivery', status: 'pending' as const, amount: 0 },
    ],
    backers: 0,
    updates: [
      { date: new Date(firebaseCampaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), text: 'Campaign created and deployed on Algorand TestNet.' },
    ],
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=1200',
    isOnChain: true,
  } : null);

  if (loadingFirebase && !mockProject) {
    return (
      <div className="max-w-7xl mx-auto pb-20 pt-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
        <p className="text-zinc-400">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto pb-20 pt-10 text-center">
        <h2 className="text-2xl font-semibold text-white mb-4">Project Not Found</h2>
        <p className="text-zinc-500 mb-8">The project you are looking for does not exist.</p>
        <BrandButton onClick={() => navigate('/fundraise')}>Back to Projects</BrandButton>
      </div>
    );
  }

  const progressPercent = Math.round((project.current / project.goal) * 100);
  const suggestions = relatedProjects.filter(p => p.id !== project.id);

  const handleDonate = async () => {
    if (!activeAddress) {
      toast.error('Please connect your wallet first');
      return;
    }

    const amount = parseFloat(donateAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid donation amount');
      return;
    }

    setIsDonating(true);
    try {
      const algodConfig = getAlgodConfigFromViteEnvironment();
      const indexerConfig = getIndexerConfigFromViteEnvironment();
      const algorand = AlgorandClient.fromConfig({ algodConfig, indexerConfig });
      algorand.setDefaultSigner(transactionSigner);
      algorand.setDefaultValidityWindow(1000);

      // Get the on-chain app client for this project
      const factory = new FundraiserFactory({
        defaultSender: activeAddress,
        algorand,
      });
      const appClient = factory.getAppClientById({ appId: BigInt(project.id) });

      // Build the payment transaction
      const payTxn = await algorand.createTransaction.payment({
        sender: activeAddress,
        receiver: appClient.appAddress,
        amount: algokit.microAlgo(Math.round(amount * 1_000_000)),
      });

      toast.loading('Sending donation...', { id: 'donate' });
      await appClient.send.donate({ args: [payTxn], populateAppCallResources: true });

      toast.success(`Successfully donated ${amount} ALGO!`, { id: 'donate' });
      setDonateAmount('');
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('overspend') || msg.includes('underflow')) {
        toast.error('Insufficient ALGO balance in your wallet', { id: 'donate' });
      } else if (msg.includes('user rejected') || msg.includes('cancelled')) {
        toast.error('Transaction cancelled', { id: 'donate' });
      } else if (msg.includes('No app') || msg.includes('application does not exist')) {
        // Demo project — simulate success
        toast.success(`Demo: ${amount} ALGO donation recorded!`, { id: 'donate' });
        setDonateAmount('');
      } else if (msg.includes('assert failed') || msg.includes('logic eval error')) {
        // Smart contract assertion error — campaign may have ended or goal reached
        toast.error('Contract rejected: campaign may have ended, reached its goal, or the deadline passed. Try creating a new campaign.', { id: 'donate' });
      } else {
        toast.error(`Donation failed: ${msg.slice(0, 80)}`, { id: 'donate' });
      }
    } finally {
      setIsDonating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 pt-4">
        <button onClick={() => navigate('/fundraise')} className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Projects
        </button>
        <span>/</span>
        <span className="text-indigo-400 truncate">{project.title}</span>
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cover Image */}
          <div className="aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
            <img src={project.image} alt={project.title} className="w-full h-full object-cover" />
          </div>

          {/* Title & Meta */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <ImpactBadge label={project.category} color="indigo" size="sm" />
              <span className="text-zinc-500 text-sm flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {project.deadline}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold text-white">{project.title}</h1>
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold">
                {project.creator.charAt(0)}
              </div>
              <span>by <span className="text-white font-medium">{project.creator}</span></span>
              <span className="text-zinc-600">|</span>
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {project.backers} backers</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg w-fit border border-zinc-800/50">
            {(['about', 'milestones', 'updates'] as const).map((tab) => (
              <button
                key={tab}
                className={`px-5 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'about' && (
            <Card>
              <h3 className="text-lg font-medium text-white mb-4">About this Project</h3>
              <div className="text-zinc-400 leading-relaxed whitespace-pre-line text-sm">
                {project.longDescription}
              </div>
            </Card>
          )}

          {activeTab === 'milestones' && (
            <div className="space-y-6">
              {/* Milestone Timeline */}
              <Card>
                <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" /> Milestone Timeline
                  {onChainMilestone && (
                    <span className="ml-auto text-sm text-zinc-400 font-normal">
                      Stage {onChainMilestone.current + 1} of {onChainMilestone.total}
                    </span>
                  )}
                </h3>
                <div className="space-y-6">
                  {(onChainMilestone
                    ? Array.from({ length: onChainMilestone.total }, (_, i) => ({
                        title: `Milestone ${i + 1}`,
                        status: i < onChainMilestone.current ? 'completed' as const : i === onChainMilestone.current ? 'active' as const : 'pending' as const,
                        amount: onChainGoal ? Math.round((onChainGoal / onChainMilestone.total) * 100) / 100 : 0,
                      }))
                    : project.milestones
                  ).map((ms, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                          ms.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' :
                          ms.status === 'active' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 ring-4 ring-indigo-500/10' :
                          'bg-zinc-800 border-zinc-700 text-zinc-500'
                        }`}>
                          {ms.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                        </div>
                        {i < (onChainMilestone?.total ?? project.milestones.length) - 1 && (
                          <div className={`w-0.5 flex-1 mt-2 ${ms.status === 'completed' ? 'bg-emerald-500/30' : 'bg-zinc-800'}`} />
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-white">{ms.title}</h4>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {ms.status === 'completed' ? 'Funds Released' : ms.status === 'active' ? 'Awaiting Approvals' : 'Upcoming'}
                            </p>
                          </div>
                          <span className="text-sm font-mono text-zinc-400">{ms.amount.toLocaleString()} ALGO</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* On-Chain Approval Panel */}
              {(approvalStatus || approverAddresses) && (
                <Card>
                  <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" /> 3-of-3 Multi-Sig Approvals
                  </h3>
                  <p className="text-xs text-zinc-500 mb-5">
                    All three approvers must sign on-chain before milestone funds can be released.
                  </p>

                  {/* Approver rows */}
                  <div className="space-y-3 mb-6">
                    {[0, 1, 2].map((idx) => {
                      const addr = approverAddresses ? approverAddresses[idx] : null;
                      const approved = approvalStatus ? approvalStatus[idx] : false;
                      const isMe = addr && activeAddress && addr === activeAddress;
                      return (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {approved ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-zinc-300">Approver {idx + 1}</span>
                              {isMe && <ImpactBadge label="You" color="indigo" size="sm" />}
                            </div>
                            {addr && (
                              <p className="text-xs text-zinc-600 font-mono truncate">{addr}</p>
                            )}
                          </div>
                          <div>
                            {approved ? (
                              <ImpactBadge label="Signed" color="success" size="sm" />
                            ) : (
                              <ImpactBadge label="Pending" color="warning" size="sm" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* All-approved banner */}
                  {approvalStatus && approvalStatus[0] && approvalStatus[1] && approvalStatus[2] && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      All 3 approvers signed! Creator can release milestone funds.
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    {/* Show approve button if wallet is one of the approvers */}
                    {activeAddress && approverAddresses && approverAddresses.includes(activeAddress) && (
                      <BrandButton
                        variant="primary"
                        onClick={handleApproveMilestone}
                        isLoading={isApproving}
                        disabled={approvalStatus ? approvalStatus[approverAddresses.indexOf(activeAddress)] : false}
                      >
                        <ShieldCheck className="w-4 h-4 mr-1" />
                        {approvalStatus && approvalStatus[approverAddresses.indexOf(activeAddress)]
                          ? 'Already Approved'
                          : 'Approve Milestone'}
                      </BrandButton>
                    )}

                    {/* Show release button if all approved (anyone can try, contract checks creator) */}
                    {approvalStatus && approvalStatus[0] && approvalStatus[1] && approvalStatus[2] && (
                      <BrandButton
                        variant="secondary"
                        onClick={handleReleaseMilestone}
                        isLoading={isReleasing}
                      >
                        <Zap className="w-4 h-4 mr-1" /> Release Funds
                      </BrandButton>
                    )}
                  </div>

                  {!activeAddress && (
                    <p className="text-xs text-zinc-600 mt-3">Connect your wallet to approve milestones.</p>
                  )}
                </Card>
              )}
            </div>
          )}

          {activeTab === 'updates' && (
            <Card>
              <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-400" /> Creator Updates
              </h3>
              {project.updates.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">No updates yet.</p>
              ) : (
                <div className="space-y-6">
                  {project.updates.map((update, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">{update.date}</p>
                        <p className="text-sm text-zinc-300 leading-relaxed">{update.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Funding Card */}
          <Card>
            <div className="space-y-6">
              <div>
                <div className="text-3xl font-bold text-white mb-1">
                  {project.current.toLocaleString()} <span className="text-lg text-zinc-500 font-normal">ALGO</span>
                </div>
                <p className="text-sm text-zinc-500">raised of {project.goal.toLocaleString()} ALGO goal</p>
              </div>

              <ProgressBar progress={project.current} max={project.goal} color="indigo" />

              <div className="grid grid-cols-3 gap-4 text-center py-2">
                <div>
                  <div className="text-lg font-semibold text-white">{progressPercent}%</div>
                  <div className="text-xs text-zinc-500">Funded</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">{project.backers}</div>
                  <div className="text-xs text-zinc-500">Backers</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">{project.milestones.length}</div>
                  <div className="text-xs text-zinc-500">Milestones</div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">Contribution Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={donateAmount}
                    onChange={(e) => setDonateAmount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-lg"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium">ALGO</div>
                </div>
                <div className="flex gap-2">
                  {[0.1, 0.5, 1, 5].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setDonateAmount(String(amt))}
                      className="flex-1 py-1.5 text-xs font-medium bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:border-indigo-500/50 hover:text-white transition-all"
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              <BrandButton fullWidth size="lg" onClick={handleDonate} disabled={!donateAmount || isDonating} isLoading={isDonating}>
                <Zap className="w-4 h-4 mr-2" /> {isDonating ? 'Processing...' : 'Back this Project'}
              </BrandButton>

              <div className="flex gap-3 pt-2">
                <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-700 transition-all">
                  <Heart className="w-4 h-4" /> Save
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-700 transition-all">
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
            </div>
          </Card>

          {/* Community Vote */}
          <Card>
            <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Community Vote</h4>
            <div className="flex items-center justify-center">
              <VoteButtons projectId={project.id} layout='column' />
            </div>
            <p className="text-[11px] text-zinc-600 text-center mt-3">One wallet, one vote — secured by NFT receipt</p>
          </Card>

          {/* DeFi Yield Tracker — only for on-chain campaigns with real data */}
          {(firebaseCampaign || !mockProject) && (
            <YieldTracker
              campaignId={project.id}
              currentAmount={onChainRaised ?? project.current}
              goalAmount={onChainGoal ?? project.goal}
              createdAt={firebaseCampaign ? new Date(firebaseCampaign.createdAt) : new Date()}
              durationDays={30}
              isCreator={
                !!activeAddress &&
                !!firebaseCampaign?.creator &&
                firebaseCampaign.creator === activeAddress
              }
            />
          )}

          {/* Contract Info */}
          <Card>
            <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">On-Chain Details</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">App ID</span>
                <span className="text-white font-mono">{project.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Creator</span>
                <span className="text-white font-mono text-xs">{project.creatorAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Escrow Status</span>
                <ImpactBadge label="Secured" color="success" size="sm" />
              </div>
            </div>
          </Card>

          {/* Suggested Projects */}
          <Card>
            <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Similar Projects</h4>
            <div className="space-y-4">
              {suggestions.map((sp) => (
                <Link
                  key={sp.id}
                  to={`/project/${sp.id}`}
                  className="block p-3 -mx-1 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{sp.title}</h5>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar progress={sp.progress} color="indigo" />
                    <span className="text-xs text-zinc-500 whitespace-nowrap">{sp.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailPage;
