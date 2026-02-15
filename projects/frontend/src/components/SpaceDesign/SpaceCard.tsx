// src/components/SpaceDesign/SpaceCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface SpaceCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

export const SpaceCard: React.FC<SpaceCardProps> = ({ 
  children, 
  className, 
  onClick,
  hoverEffect = true 
}) => {
  return (
    <motion.div
      whileHover={hoverEffect ? { scale: 1.02, boxShadow: '0 0 20px rgba(0, 245, 255, 0.2)' } : undefined}
      onClick={onClick}
      className={twMerge(
        "bg-space-dark/60 backdrop-blur-md border border-space-accent/20 rounded-xl p-6",
        "relative overflow-hidden group",
        onClick ? "cursor-pointer" : "",
        className
      )}
    >
      {/* Decorative corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-space-accent opacity-50"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-space-accent opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-space-accent opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-space-accent opacity-50"></div>
      
      {/* Subtle shine effect on hover */}
      {hoverEffect && (
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}
      
      {children}
    </motion.div>
  );
};
