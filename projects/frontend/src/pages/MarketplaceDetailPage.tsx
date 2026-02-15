import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import { useSnackbar } from 'notistack';
import { Card } from '../components/Base/Card';
import { BrandButton } from '../components/Base/BrandButton';
import { ImpactBadge } from '../components/Base/ImpactBadge';
import {
  ArrowLeft, Clock, Tag, User, ShoppingBag, Star,
  Shield, MessageSquare, ExternalLink, ChevronRight,
  Package, MapPin, AlertCircle
} from 'lucide-react';

// Full marketplace item data
const allItems = [
  {
    id: 1,
    title: 'Advanced Calculus Textbook',
    price: 45,
    category: 'Books',
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=1000',
    description: 'Used but in good condition. Minimal highlighting.',
    longDescription: `This Advanced Calculus textbook covers:\n- Multivariable calculus and vector analysis\n- Differential equations and series\n- Real analysis foundations\n\nCondition: Good - some pages have light pencil annotations that can be erased. Spine is intact, no water damage. Perfect for MATH 301/302.\n\nOriginal retail price: $120. Selling at a significant discount.`,
    seller: 'student_01',
    sellerRating: 4.8,
    sellerSales: 12,
    condition: 'Good',
    listedDate: '2 days ago',
    location: 'Campus Bookstore Pickup',
    tags: ['Calculus', 'Mathematics', 'Textbook', 'MATH 301'],
  },
  {
    id: 2,
    title: 'Lab Coat (Size M)',
    price: 25,
    category: 'Equipment',
    image: 'https://images.unsplash.com/photo-1582719201911-39c9b5f54367?auto=format&fit=crop&q=80&w=1000',
    description: 'Required for Chem 101. Worn once.',
    longDescription: `White lab coat, Size Medium.\n\nWorn only once during orientation week. Freshly dry-cleaned and in like-new condition. Required for all Chemistry and Biology lab courses.\n\nFeatures:\n- 100% cotton, flame-resistant\n- Two large front pockets\n- Button closure\n- Name tag slot\n\nSaving you a trip to the campus store and about 60% off retail.`,
    seller: 'science_major',
    sellerRating: 5.0,
    sellerSales: 3,
    condition: 'Like New',
    listedDate: '5 hours ago',
    location: 'Science Building Lobby',
    tags: ['Lab Coat', 'Chemistry', 'Biology', 'Lab Equipment'],
  },
  {
    id: 3,
    title: 'Graphing Calculator',
    price: 80,
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1574607383476-f517f260d30b?auto=format&fit=crop&q=80&w=1000',
    description: 'TI-84 Plus CE. Includes charging cable.',
    longDescription: `Texas Instruments TI-84 Plus CE Graphing Calculator.\n\nPerfect working condition. Battery holds full charge. Includes:\n- Original USB charging cable\n- Protective slide case\n- Pre-loaded with standard math programs\n\nGreat for engineering, math, and science courses. Approved for SAT, ACT, AP, and IB exams.\n\nUpgrading to TI-Nspire so selling this one at a fair price.`,
    seller: 'tech_guy',
    sellerRating: 4.5,
    sellerSales: 8,
    condition: 'Excellent',
    listedDate: '1 day ago',
    location: 'Engineering Building',
    tags: ['Calculator', 'TI-84', 'Engineering', 'Mathematics'],
  },
  {
    id: 4,
    title: 'Organic Chemistry Notes',
    price: 15,
    category: 'Notes',
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=1000',
    description: 'Full semester notes, digitized PDF format.',
    longDescription: `Complete Organic Chemistry (CHEM 201) notes from Fall 2025.\n\nIncludes:\n- All lecture notes (40+ pages)\n- Reaction mechanism diagrams\n- Exam prep summaries for Midterm 1, 2, and Final\n- Practice problem solutions\n\nFormat: High-quality digitized PDF. Will be sent to your email immediately after purchase.\n\nI scored an A+ in this course - these notes are comprehensive and well-organized.`,
    seller: 'top_student',
    sellerRating: 4.9,
    sellerSales: 25,
    condition: 'Digital',
    listedDate: '3 days ago',
    location: 'Digital Delivery',
    tags: ['Chemistry', 'Notes', 'Exam Prep', 'CHEM 201'],
  },
];

const MarketplaceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeAddress } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const item = allItems.find(i => i.id === Number(id));

  if (!item) {
    return (
      <div className="max-w-7xl mx-auto pb-20 pt-10 text-center">
        <h2 className="text-2xl font-semibold text-white mb-4">Item Not Found</h2>
        <p className="text-zinc-500 mb-8">This listing may have been removed or sold.</p>
        <BrandButton onClick={() => navigate('/marketplace')}>Back to Marketplace</BrandButton>
      </div>
    );
  }

  const suggestions = allItems.filter(i => i.id !== item.id).slice(0, 3);

  const handlePurchase = () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' });
      return;
    }
    enqueueSnackbar(`Processing purchase for ${item.title}...`, { variant: 'info' });
    setTimeout(() => {
      enqueueSnackbar('Purchase successful!', { variant: 'success' });
    }, 2000);
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'Like New': return 'success';
      case 'Excellent': return 'indigo';
      case 'Good': return 'warning';
      case 'Digital': return 'indigo';
      default: return 'default';
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 pt-4">
        <button onClick={() => navigate('/marketplace')} className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Marketplace
        </button>
        <span>/</span>
        <span className="text-zinc-400">{item.category}</span>
        <span>/</span>
        <span className="text-indigo-400 truncate">{item.title}</span>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image */}
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
            <img src={item.image} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>All transactions are secured on-chain via smart contract escrow</span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <ImpactBadge label={item.category} color="indigo" size="sm" />
              <ImpactBadge label={item.condition} color={getConditionColor(item.condition) as any} size="sm" />
            </div>
            <h1 className="text-3xl font-display font-semibold text-white">{item.title}</h1>
            <div className="flex items-center gap-4 text-sm text-zinc-400">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {item.listedDate}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.location}</span>
            </div>
          </div>

          {/* Price */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Price</p>
                <div className="text-4xl font-bold text-white">
                  {item.price} <span className="text-lg text-zinc-500 font-normal">ALGO</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
                <Shield className="w-4 h-4" /> Escrow Protected
              </div>
            </div>

            <BrandButton fullWidth size="lg" onClick={handlePurchase}>
              <ShoppingBag className="w-4 h-4 mr-2" /> Buy Now for {item.price} ALGO
            </BrandButton>
          </div>

          {/* Seller Info */}
          <Card>
            <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Seller</h4>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="text-white font-medium">@{item.seller}</div>
                <div className="flex items-center gap-3 text-sm text-zinc-500 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    {item.sellerRating}
                  </span>
                  <span>{item.sellerSales} sales</span>
                </div>
              </div>
              <button className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all">
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>
          </Card>

          {/* Description */}
          <Card>
            <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Description</h4>
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
              {item.longDescription}
            </div>
          </Card>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-1.5 hover:border-zinc-700 transition-colors cursor-pointer">
                <Tag className="w-3 h-3" /> {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Related Items */}
      <div className="pt-8 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-semibold text-white">You Might Also Like</h2>
          <Link to="/marketplace" className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {suggestions.map((si) => (
            <Link key={si.id} to={`/marketplace/${si.id}`}>
              <Card hoverable noPadding className="overflow-hidden h-full">
                <div className="aspect-[4/3] overflow-hidden bg-zinc-900">
                  <img src={si.image} alt={si.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-white line-clamp-1">{si.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-400 line-clamp-1 mb-3">{si.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-white">{si.price} <span className="text-xs text-zinc-500 font-normal">ALGO</span></span>
                    <ImpactBadge label={si.category} color="default" size="sm" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MarketplaceDetailPage;
