import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  hoverable?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  noPadding = false,
  hoverable = false,
  onClick
}) => {
  return (
    <div 
      className={`
        bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl overflow-hidden
        ${hoverable ? 'hover:border-zinc-700 transition-colors duration-200' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};
