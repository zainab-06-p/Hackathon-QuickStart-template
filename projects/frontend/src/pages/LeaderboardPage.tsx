import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import { Card } from '../components/Base/Card';
import { BrandButton } from '../components/Base/BrandButton';
import { ImpactBadge } from '../components/Base/ImpactBadge';
import { useVoting, BADGE_META, VoterBadge } from '../utils/votingContext';
import {
  Trophy, Medal, Award, TrendingUp, TrendingDown, Users,
  Shield, ThumbsUp, ThumbsDown, Crown, Star, Zap, ArrowUpRight
} from 'lucide-react';
import { motion } from 'framer-motion';

// ──── Project catalog (same as listing pages) ────
const PROJECT_CATALOG: { id: number; title: string; creator: string; category: string }[] = [
  { id: 1, title: 'Eco-Drone Reforestation', creator: 'Jane Doe', category: 'Environment' },
  { id: 2, title: 'Quantum Encryption Chat', creator: 'Alex Smith', category: 'Tech' },
  { id: 3, title: 'Hydra: Water Purification', creator: 'Sarah Lee', category: 'Social Impact' },
];

const rankIcons = [
  <Crown className="w-5 h-5 text-yellow-400" />,
  <Medal className="w-5 h-5 text-zinc-300" />,
  <Award className="w-5 h-5 text-amber-600" />,
];

const badgeColor = (b: VoterBadge): 'default' | 'success' | 'warning' | 'indigo' | 'rose' => {
  switch (b) {
    case 'guardian': return 'success';
    case 'trusted': return 'warning';
    case 'active': return 'indigo';
    case 'participant': return 'default';
    default: return 'default';
  }
};

const LeaderboardPage: React.FC = () => {
  const { activeAddress } = useWallet();
  const { getProjectVotes, getVoterProfile, allVotes } = useVoting();
  const [tab, setTab] = useState<'projects' | 'voters'>('projects');

  // ──── Project leaderboard ────
  const projectLeaderboard = useMemo(() => {
    return PROJECT_CATALOG.map(p => {
      const v = getProjectVotes(p.id);
      return { ...p, ...v };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
  }, [allVotes, getProjectVotes]);

  // ──── Voter leaderboard ────
  const voterLeaderboard = useMemo(() => {
    const walletSet = new Set(allVotes.map(v => v.wallet));
    return Array.from(walletSet)
      .map(w => {
        const profile = getVoterProfile(w);
        return {
          wallet: w,
          totalVotes: profile.totalVotesCast,
          badge: profile.badge,
          nftCount: profile.nftIds.length,
        };
      })
      .sort((a, b) => b.totalVotes - a.totalVotes);
  }, [allVotes, getVoterProfile]);

  const myProfile = activeAddress ? getVoterProfile(activeAddress) : null;
  const myBadgeMeta = myProfile ? BADGE_META[myProfile.badge] : null;

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-8">
        <h1 className="text-3xl font-display font-semibold text-white mb-2 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-400" />
          Leaderboard
        </h1>
        <p className="text-zinc-400">
          Community-driven rankings powered by NFT-verified votes — one wallet, one vote per project.
        </p>
      </div>

      {/* My Voter Card */}
      {activeAddress && myProfile && myBadgeMeta && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-r from-indigo-500/10 via-zinc-900 to-zinc-900 border-indigo-500/30">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center text-2xl">
                  {myBadgeMeta.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold">Your Voter Profile</span>
                    <ImpactBadge label={myBadgeMeta.label} color={badgeColor(myProfile.badge)} />
                  </div>
                  <p className="text-zinc-400 text-sm">{myBadgeMeta.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3 text-emerald-400" /> {myProfile.projectsUpvoted.length} upvoted
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsDown className="w-3 h-3 text-rose-400" /> {myProfile.projectsDownvoted.length} downvoted
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-indigo-400" /> {myProfile.nftIds.length} NFT receipts
                    </span>
                  </div>
                </div>
              </div>

              {/* Badge progression */}
              <div className="flex gap-2">
                {(Object.keys(BADGE_META) as VoterBadge[]).map(b => {
                  const meta = BADGE_META[b];
                  const isActive = b === myProfile.badge;
                  return (
                    <div
                      key={b}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all
                        ${isActive ? 'bg-indigo-500/30 ring-2 ring-indigo-500 scale-110' : 'bg-zinc-800 opacity-40'}`}
                      title={`${meta.label}: ${meta.description}`}
                    >
                      {meta.emoji}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800">
        <button
          onClick={() => setTab('projects')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px
            ${tab === 'projects'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          <Trophy className="w-4 h-4 inline mr-1.5" /> Project Rankings
        </button>
        <button
          onClick={() => setTab('voters')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px
            ${tab === 'voters'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
        >
          <Users className="w-4 h-4 inline mr-1.5" /> Top Voters
        </button>
      </div>

      {/* ──── Project Rankings Tab ──── */}
      {tab === 'projects' && (
        <div className="space-y-3">
          {projectLeaderboard.length === 0 ? (
            <Card className="text-center py-16">
              <Zap className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg">No votes cast yet.</p>
              <p className="text-zinc-500 text-sm mt-1">Head to the <Link to="/fundraise" className="text-indigo-400 hover:underline">Projects</Link> page and cast your first vote!</p>
            </Card>
          ) : (
            projectLeaderboard.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/project/${entry.id}`}>
                  <Card hoverable className="flex items-center gap-4">
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0
                      ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-zinc-600/30 text-zinc-300' : i === 2 ? 'bg-amber-600/20 text-amber-500' : 'bg-zinc-800 text-zinc-500'}`}>
                      {i < 3 ? rankIcons[i] : `#${entry.rank}`}
                    </div>

                    {/* Info */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-semibold truncate">{entry.title}</span>
                        <span className="text-xs text-zinc-500 hidden sm:inline">by {entry.creator}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500">
                        <span className="px-2 py-0.5 bg-zinc-800 rounded-full">{entry.category}</span>
                      </div>
                    </div>

                    {/* Vote counts */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="flex items-center gap-1 text-emerald-400">
                        <ThumbsUp className="w-4 h-4" />
                        <span className="text-sm font-medium">{entry.upvotes}</span>
                      </div>
                      <div className="flex items-center gap-1 text-rose-400">
                        <ThumbsDown className="w-4 h-4" />
                        <span className="text-sm font-medium">{entry.downvotes}</span>
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-bold min-w-[3rem] justify-end
                        ${entry.score > 0 ? 'text-emerald-400' : entry.score < 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                        {entry.score > 0 ? <TrendingUp className="w-4 h-4" /> : entry.score < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                        {entry.score > 0 ? `+${entry.score}` : entry.score}
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-600" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ──── Voter Rankings Tab ──── */}
      {tab === 'voters' && (
        <div className="space-y-3">
          {voterLeaderboard.length === 0 ? (
            <Card className="text-center py-16">
              <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg">No voters yet.</p>
              <p className="text-zinc-500 text-sm mt-1">Be the first to cast a vote and earn your badge!</p>
            </Card>
          ) : (
            voterLeaderboard.map((voter, i) => {
              const meta = BADGE_META[voter.badge];
              const isMe = activeAddress === voter.wallet;
              return (
                <motion.div
                  key={voter.wallet}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={`flex items-center gap-4 ${isMe ? 'ring-1 ring-indigo-500/50 bg-indigo-500/5' : ''}`}>
                    {/* Rank */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0
                      ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-zinc-600/30 text-zinc-300' : i === 2 ? 'bg-amber-600/20 text-amber-500' : 'bg-zinc-800 text-zinc-500'}`}>
                      {i < 3 ? rankIcons[i] : `#${i + 1}`}
                    </div>

                    {/* Voter info */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-medium font-mono text-sm truncate">
                          {voter.wallet.slice(0, 6)}…{voter.wallet.slice(-4)}
                        </span>
                        {isMe && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-medium">YOU</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-lg">{meta.emoji}</span>
                        <ImpactBadge label={meta.label} color={badgeColor(voter.badge)} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 flex-shrink-0 text-sm">
                      <div className="text-center">
                        <div className="text-white font-bold">{voter.totalVotes}</div>
                        <div className="text-zinc-500 text-xs">votes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-indigo-400 font-bold flex items-center gap-1">
                          <Shield className="w-3 h-3" /> {voter.nftCount}
                        </div>
                        <div className="text-zinc-500 text-xs">NFTs</div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* How it works */}
      <Card className="bg-zinc-900/50">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          How NFT-Verified Voting Works
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 bg-zinc-800/50 rounded-xl">
            <div className="text-lg mb-2">🔗</div>
            <h4 className="text-white text-sm font-medium mb-1">1. Connect Wallet</h4>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Each Algorand wallet address acts as a unique voter identity — no accounts, no emails needed.
            </p>
          </div>
          <div className="p-4 bg-zinc-800/50 rounded-xl">
            <div className="text-lg mb-2">🗳️</div>
            <h4 className="text-white text-sm font-medium mb-1">2. Cast Your Vote</h4>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Upvote or downvote any project. A unique NFT receipt is minted to your wallet as proof — one per project.
            </p>
          </div>
          <div className="p-4 bg-zinc-800/50 rounded-xl">
            <div className="text-lg mb-2">🛡️</div>
            <h4 className="text-white text-sm font-medium mb-1">3. Anti-Fraud Protection</h4>
            <p className="text-zinc-400 text-xs leading-relaxed">
              The NFT receipt prevents duplicate votes. One wallet = one vote per project. No bots, no ballot stuffing.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LeaderboardPage;
