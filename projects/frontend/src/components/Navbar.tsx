import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Rocket, Menu, X, LayoutDashboard, Search, Activity, ShoppingBag, Trophy, Ticket, Database } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';
import { WalletId } from '@txnlab/use-wallet';
import { BrandButton } from './Base/BrandButton';
import ConnectWallet from './ConnectWallet';

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { activeAddress, activeWallet, wallets } = useWallet();
  const location = useLocation();

  const handleWalletAction = () => {
    if (activeAddress && activeWallet) {
      activeWallet.disconnect();
      return;
    }
    setWalletModalOpen(true);
  };

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Projects', path: '/fundraise', icon: Search },
    { name: 'Activity', path: '/fund-tracker', icon: Activity },
    { name: 'Market', path: '/marketplace', icon: ShoppingBag },
    { name: 'Events', path: '/ticketing', icon: Ticket },
    { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { name: 'Explorer', path: '/explorer', icon: Database },
  ];

  return (
    <nav className='fixed w-full z-50 top-0 left-0 border-b border-zinc-800 bg-background/80 backdrop-blur-md'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between h-16'>
          
          {/* Logo */}
          <Link to='/' className='flex items-center gap-2 group'>
            <div className='p-1.5 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors'>
              <Rocket className='h-5 w-5 text-indigo-500' />
            </div>
            <span className='font-display font-bold text-lg tracking-tight text-white'>
              Citadel
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className='hidden md:flex items-center space-x-1'>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    isActive 
                      ? 'bg-zinc-800 text-white' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <Icon className='h-4 w-4 opacity-70' />
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Wallet Button */}
          <div className='hidden md:block'>
            <BrandButton 
              variant={activeAddress ? 'secondary' : 'primary'}
              size='sm'
              onClick={handleWalletAction}
            >
              {activeAddress ? (
                <span className='font-mono text-xs'>{activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}</span>
              ) : (
                'Connect Wallet'
              )}
            </BrandButton>
          </div>

          {/* Mobile menu button */}
          <div className='md:hidden flex items-center'>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className='text-zinc-400 hover:text-white p-2'
            >
              {isOpen ? <X className='h-6 w-6' /> : <Menu className='h-6 w-6' />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className='md:hidden bg-background border-b border-zinc-800'>
          <div className='px-2 pt-2 pb-3 space-y-1 sm:px-3'>
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className='text-zinc-300 hover:bg-zinc-800 hover:text-white block px-3 py-2 rounded-md text-base font-medium'
              >
                {link.name}
              </Link>
            ))}
            <div className='pt-4 pb-2'>
              <BrandButton 
                variant={activeAddress ? 'secondary' : 'primary'}
                fullWidth
                onClick={() => {
                  handleWalletAction();
                  setIsOpen(false);
                }}
              >
                {activeAddress ? 'Disconnect' : 'Connect Wallet'}
              </BrandButton>
            </div>
          </div>
        </div>
      )}
      <ConnectWallet openModal={walletModalOpen} closeModal={() => setWalletModalOpen(false)} />
    </nav>
  );
};
