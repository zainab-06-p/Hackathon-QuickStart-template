import React from 'react';
import { ThumbsUp, ThumbsDown, Shield } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';
import { useVoting } from '../../utils/votingContext';
import toast from 'react-hot-toast';

interface VoteButtonsProps {
  projectId: number;
  /** 'row' = side-by-side small, 'column' = stacked large (detail page) */
  layout?: 'row' | 'column';
}

export const VoteButtons: React.FC<VoteButtonsProps> = ({ projectId, layout = 'row' }) => {
  const { activeAddress } = useWallet();
  const { castVote, getMyVote, getProjectVotes } = useVoting();
  const myVote = activeAddress ? getMyVote(projectId, activeAddress) : null;
  const { upvotes, downvotes, score } = getProjectVotes(projectId);

  const handleVote = (e: React.MouseEvent, type: 'up' | 'down') => {
    e.preventDefault();
    e.stopPropagation();
    if (!activeAddress) {
      toast.error('Connect your wallet to vote');
      return;
    }
    const nftId = castVote(projectId, activeAddress, type);
    if (myVote === type) {
      toast('Vote removed', { icon: '🗑️' });
    } else {
      toast.success(
        <span className="text-sm">
          {type === 'up' ? '👍 Upvoted!' : '👎 Downvoted!'}{' '}
          <span className="text-zinc-400 text-xs">NFT: {nftId.slice(0, 16)}…</span>
        </span>
      );
    }
  };

  if (layout === 'column') {
    return (
      <div className="flex flex-col items-center gap-1">
        {/* Up */}
        <button
          onClick={(e) => handleVote(e, 'up')}
          className={`group flex items-center justify-center w-10 h-10 rounded-lg border transition-all
            ${myVote === 'up'
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'border-zinc-700 text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-400'
            }`}
        >
          <ThumbsUp className="w-4 h-4" />
        </button>

        {/* Score */}
        <span className={`text-sm font-bold tabular-nums ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
          {score > 0 ? `+${score}` : score}
        </span>

        {/* Down */}
        <button
          onClick={(e) => handleVote(e, 'down')}
          className={`group flex items-center justify-center w-10 h-10 rounded-lg border transition-all
            ${myVote === 'down'
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
              : 'border-zinc-700 text-zinc-500 hover:border-rose-500/40 hover:text-rose-400'
            }`}
        >
          <ThumbsDown className="w-4 h-4" />
        </button>

        {/* NFT badge */}
        {myVote && (
          <div className="flex items-center gap-1 mt-1" title="Your vote is recorded as a unique NFT receipt — prevents duplicate voting">
            <Shield className="w-3 h-3 text-indigo-400" />
            <span className="text-[10px] text-indigo-400">NFT Verified</span>
          </div>
        )}
      </div>
    );
  }

  // Row layout (compact — for cards)
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => handleVote(e, 'up')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-all
          ${myVote === 'up'
            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
            : 'border-zinc-700 text-zinc-500 hover:border-emerald-500/40 hover:text-emerald-400'
          }`}
      >
        <ThumbsUp className="w-3 h-3" />
        <span>{upvotes}</span>
      </button>

      <button
        onClick={(e) => handleVote(e, 'down')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-all
          ${myVote === 'down'
            ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
            : 'border-zinc-700 text-zinc-500 hover:border-rose-500/40 hover:text-rose-400'
          }`}
      >
        <ThumbsDown className="w-3 h-3" />
        <span>{downvotes}</span>
      </button>

      {myVote && (
        <div className="flex items-center gap-1" title="Vote secured by NFT receipt">
          <Shield className="w-3 h-3 text-indigo-400" />
        </div>
      )}
    </div>
  );
};
