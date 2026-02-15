import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Rocket, 
  ShieldCheck, 
  Users, 
  ShoppingBag, 
  TrendingUp, 
  Globe, 
  ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { BrandButton } from '../components/Base/BrandButton';
import { Card } from '../components/Base/Card';

const DashboardPage: React.FC = () => {
  const features = [
    {
      title: 'Start a Project',
      desc: 'Launch your fundraising campaign and gather community support.',
      icon: Rocket,
      link: '/create-campaign',
      color: 'text-indigo-400'
    },
    {
      title: 'Explore Ideas',
      desc: 'Discover innovative student projects waiting for your backing.',
      icon: Globe,
      link: '/fundraise',
      color: 'text-emerald-400'
    },
    {
      title: 'Transparent Tracking',
      desc: 'Monitor milestone progress and escrow usage in real-time.',
      icon: ShieldCheck,
      link: '/fund-tracker',
      color: 'text-amber-400'
    },
    {
      title: 'Asset Marketplace',
      desc: 'Trade project assets and services securely.',
      icon: ShoppingBag,
      link: '/marketplace',
      color: 'text-rose-400'
    },
    {
      title: 'Savings Pools',
      desc: 'Collaborative saving pools for collective goals.',
      icon: TrendingUp,
      link: '/savings',
      color: 'text-sky-400'
    },
    {
      title: 'Community',
      desc: 'Connect with fellow students and collaborate on projects.',
      icon: Users,
      link: '/leaderboard',
      color: 'text-violet-400'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="flex flex-col gap-24 pb-20">
      {/* Hero Section */}
      <section className="pt-20 md:pt-32 text-center max-w-4xl mx-auto space-y-8 px-4 relative">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl -z-10" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-400 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live on Testnet
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-medium tracking-tight text-white">
            Turn student ideas into <br />
            <span className="text-zinc-500">real-world impact.</span>
          </h1>
        </motion.div>

        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-xl text-zinc-400 font-light max-w-2xl mx-auto leading-relaxed"
        >
          The decentralized platform for fundraising, tracking, and scaling student initiatives.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/create-campaign">
            <BrandButton size="lg" className="group">
              Start Building
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </BrandButton>
          </Link>
          <Link to="/fundraise">
            <BrandButton variant="secondary" size="lg">
              Browse Projects
            </BrandButton>
          </Link>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="px-4 md:px-0">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-semibold text-white">Platform Features</h2>
        </div>
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((item, idx) => (
            <motion.div key={idx} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
              <Link to={item.link}>
                <Card hoverable className="h-full group">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-zinc-800/50 group-hover:bg-zinc-800 transition-colors ${item.color}`}>
                      <item.icon className="h-6 w-6" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Stats / Social Proof */}
      <section className="bg-zinc-900/30 border-y border-zinc-800 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[ 
            { label: 'Total Volume', value: '4.5k' },
            { label: 'Active Projects', value: '86' },
            { label: 'Contributors', value: '1.2k+' },
            { label: 'Success Rate', value: '94%' },
          ].map((stat, i) => (
            <div key={i}>
              <div className="text-3xl font-display font-semibold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-zinc-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
