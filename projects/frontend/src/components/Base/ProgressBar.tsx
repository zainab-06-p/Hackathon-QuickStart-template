import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  max?: number;
  label?: string;
  sublabel?: string;
  color?: 'indigo' | 'emerald' | 'amber';
}

const colors = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  max = 100,
  label,
  sublabel,
  color = 'emerald'
}) => {
  const percentage = Math.min(Math.max((progress / max) * 100, 0), 100);

  return (
    <div className="w-full">
      {(label || sublabel) && (
        <div className="flex justify-between items-end mb-2">
          {label && <span className="text-sm font-medium text-zinc-300">{label}</span>}
          {sublabel && <span className="text-xs text-zinc-500">{sublabel}</span>}
        </div>
      )}
      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full rounded-full ${colors[color]}`}
        />
      </div>
    </div>
  );
};
