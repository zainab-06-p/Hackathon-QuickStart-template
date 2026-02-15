import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ────────── Types ──────────
export type VoteType = 'up' | 'down';

export interface VoteRecord {
  projectId: number;
  wallet: string;
  vote: VoteType;
  nftId: string; // simulated NFT receipt ID
  timestamp: number;
}

export interface ProjectVotes {
  upvotes: number;
  downvotes: number;
  score: number; // upvotes - downvotes
}

export interface VoterProfile {
  wallet: string;
  totalVotesCast: number;
  projectsUpvoted: number[];
  projectsDownvoted: number[];
  badge: VoterBadge;
  nftIds: string[]; // list of voting NFT receipt IDs
}

export type VoterBadge =
  | 'newcomer'    // 0 votes
  | 'participant' // 1-4 votes
  | 'active'      // 5-14 votes
  | 'trusted'     // 15-29 votes
  | 'guardian';    // 30+ votes

export interface LeaderboardEntry {
  projectId: number;
  title: string;
  creator: string;
  category: string;
  score: number;
  upvotes: number;
  downvotes: number;
  rank: number;
}

// ────────── Badge logic ──────────
function getBadge(totalVotes: number): VoterBadge {
  if (totalVotes >= 30) return 'guardian';
  if (totalVotes >= 15) return 'trusted';
  if (totalVotes >= 5) return 'active';
  if (totalVotes >= 1) return 'participant';
  return 'newcomer';
}

export const BADGE_META: Record<VoterBadge, { label: string; color: string; emoji: string; description: string }> = {
  newcomer:    { label: 'Newcomer',    color: 'zinc',   emoji: '🌱', description: 'Connect your wallet and cast your first vote!' },
  participant: { label: 'Participant', color: 'blue',   emoji: '🗳️', description: 'Voted on 1-4 projects' },
  active:      { label: 'Active Voter',color: 'indigo', emoji: '⚡', description: 'Voted on 5-14 projects' },
  trusted:     { label: 'Trusted Judge',color:'amber',  emoji: '🛡️', description: 'Voted on 15-29 projects' },
  guardian:    { label: 'Guardian',    color: 'emerald',emoji: '👑', description: 'Voted on 30+ projects — a true community guardian' },
};

// ────────── Storage ──────────
const STORAGE_KEY = 'citadel_votes_v1';

function loadVotes(): VoteRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveVotes(votes: VoteRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
}

// ────────── Mint simulated receipt NFT ──────────
function mintVoteNFT(wallet: string, projectId: number, vote: VoteType): string {
  // In production this would be an on-chain ASA opt-in + mint via smart contract
  // guaranteeing 1 NFT per wallet per project (anti-duplication)
  const nftId = `VOTE-NFT-${wallet.slice(0, 6)}-P${projectId}-${Date.now().toString(36).toUpperCase()}`;
  return nftId;
}

// ────────── Context ──────────
interface VotingContextType {
  /** Cast or change vote. Returns the NFT receipt id. Throws if no wallet. */
  castVote: (projectId: number, wallet: string, vote: VoteType) => string;
  /** Get current vote for a wallet on a project (null if not voted) */
  getMyVote: (projectId: number, wallet: string) => VoteType | null;
  /** Aggregated votes for a project */
  getProjectVotes: (projectId: number) => ProjectVotes;
  /** Voter's profile */
  getVoterProfile: (wallet: string) => VoterProfile;
  /** All votes (for leaderboard) */
  allVotes: VoteRecord[];
}

const VotingContext = createContext<VotingContextType | null>(null);

export const useVoting = (): VotingContextType => {
  const ctx = useContext(VotingContext);
  if (!ctx) throw new Error('useVoting must be used within VotingProvider');
  return ctx;
};

export const VotingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [votes, setVotes] = useState<VoteRecord[]>(loadVotes);

  useEffect(() => { saveVotes(votes); }, [votes]);

  const castVote = useCallback((projectId: number, wallet: string, vote: VoteType): string => {
    // Check if wallet already voted on this project
    const existing = votes.find(v => v.projectId === projectId && v.wallet === wallet);

    if (existing) {
      if (existing.vote === vote) {
        // Remove vote (toggle off)
        setVotes(prev => prev.filter(v => !(v.projectId === projectId && v.wallet === wallet)));
        return existing.nftId;
      }
      // Change vote direction
      setVotes(prev =>
        prev.map(v =>
          v.projectId === projectId && v.wallet === wallet
            ? { ...v, vote, timestamp: Date.now() }
            : v
        )
      );
      return existing.nftId;
    }

    // New vote — mint NFT receipt
    const nftId = mintVoteNFT(wallet, projectId, vote);
    setVotes(prev => [...prev, { projectId, wallet, vote, nftId, timestamp: Date.now() }]);
    return nftId;
  }, [votes]);

  const getMyVote = useCallback((projectId: number, wallet: string): VoteType | null => {
    const found = votes.find(v => v.projectId === projectId && v.wallet === wallet);
    return found?.vote ?? null;
  }, [votes]);

  const getProjectVotes = useCallback((projectId: number): ProjectVotes => {
    const pv = votes.filter(v => v.projectId === projectId);
    const up = pv.filter(v => v.vote === 'up').length;
    const down = pv.filter(v => v.vote === 'down').length;
    return { upvotes: up, downvotes: down, score: up - down };
  }, [votes]);

  const getVoterProfile = useCallback((wallet: string): VoterProfile => {
    const myVotes = votes.filter(v => v.wallet === wallet);
    return {
      wallet,
      totalVotesCast: myVotes.length,
      projectsUpvoted: myVotes.filter(v => v.vote === 'up').map(v => v.projectId),
      projectsDownvoted: myVotes.filter(v => v.vote === 'down').map(v => v.projectId),
      badge: getBadge(myVotes.length),
      nftIds: myVotes.map(v => v.nftId),
    };
  }, [votes]);

  return (
    <VotingContext.Provider value={{ castVote, getMyVote, getProjectVotes, getVoterProfile, allVotes: votes }}>
      {children}
    </VotingContext.Provider>
  );
};
