// src/components/SpaceDesign/FuelBar.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface FuelBarProps {
  current: number;
  max: number;
  label?: string;
  className?: string;
}

export const FuelBar: React.FC<FuelBarProps> = ({ current, max, label = "FUEL LEVEL" }) => {
  const percentage = Math.min(Math.round((current / max) * 100), 100);
  
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-orbitron text-space-accent tracking-widest">{label}</span>
        <span className="text-xs font-mono text-gray-400">{percentage}%</span>
      </div>
      <div className="h-4 bg-gray-900 rounded-full border border-gray-700 relative overflow-hidden">
        {/* Background Grid Lines to look like a tank */}
        <div className="absolute inset-0 flex justify-between px-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-[1px] h-full bg-gray-800" />
          ))}
        </div>
        
        {/* Liquid Fill */}
        <motion.div 
          className="h-full bg-gradient-to-r from-blue-600 via-space-accent to-blue-400 relative"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          {/* Bubbles / Flow effect */}
          <motion.div 
            className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] opacity-20"
            animate={{ x: [-20, 0] }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
          
          {/* Glow at the tip */}
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]" />
        </motion.div>
      </div>
    </div>
  );
};
