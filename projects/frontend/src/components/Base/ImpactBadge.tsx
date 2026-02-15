import React from 'react';

interface ImpactBadgeProps {
  label: string;
  color?: 'default' | 'success' | 'warning' | 'indigo' | 'rose';
  size?: 'sm' | 'md';
}

const colors = {
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export const ImpactBadge: React.FC<ImpactBadgeProps> = ({ 
  label, 
  color = 'default',
  size = 'md'
}) => {
  return (
    <span className={`
      inline-flex items-center rounded-full border font-medium
      ${colors[color]}
      ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-sm'}
    `}>
      {label}
    </span>
  );
};
