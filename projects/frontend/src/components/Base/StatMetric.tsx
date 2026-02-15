import React from 'react';

interface StatMetricProps {
  label: string;
  value: string | number;
  trend?: {
    value: string;
    direction: 'up' | 'down';
  };
  icon?: React.ReactNode;
}

export const StatMetric: React.FC<StatMetricProps> = ({
  label,
  value,
  trend,
  icon
}) => {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-zinc-500 mb-1">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-semibold tracking-tight text-white">{value}</span>
        {trend && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
            trend.direction === 'up' 
              ? 'text-emerald-400 bg-emerald-500/10' 
              : 'text-rose-400 bg-rose-500/10'
          }`}>
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
};
