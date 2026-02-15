// src/components/SpaceDesign/SpaceButton.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SpaceButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const SpaceButton: React.FC<SpaceButtonProps> = ({ 
  children, 
  className, 
  variant = 'primary',
  fullWidth = false,
  isLoading = false,
  ...props 
}) => {
  const baseStyles = "relative px-6 py-3 rounded-lg font-orbitron font-semibold tracking-wider transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden";
  
  const variants = {
    primary: "bg-space-accent text-space-black shadow-neon hover:bg-cyan-300 hover:shadow-[0_0_20px_rgba(0,245,255,0.7)]",
    secondary: "bg-space-highlight text-white hover:bg-purple-500 shadow-neon-purple",
    outline: "bg-transparent border border-space-accent text-space-accent hover:bg-space-accent/10 hover:shadow-neon",
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/5"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      disabled={isLoading || props.disabled}
      className={twMerge(
        baseStyles,
        variants[variant],
        fullWidth ? "w-full" : "",
        (isLoading || props.disabled) ? "opacity-50 cursor-not-allowed" : "",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          Initializing...
        </>
      ) : children}
      
      {/* Button Shine Animation */}
      {variant === 'primary' && !isLoading && !props.disabled && (
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shine_1s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
      )}
    </motion.button>
  );
};
