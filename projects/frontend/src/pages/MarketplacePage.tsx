import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import { ImpactBadge } from '../components/Base/ImpactBadge'
import {
  ShoppingBag, Clock, Tag, Search, Filter,
  ShieldCheck, Ticket, ArrowLeftRight, TrendingUp, History,
  AlertTriangle, RefreshCw, User,
} from 'lucide-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { getEventState } from '../utils/blockchainData'
import { listenToEvents, initializeFirebase } from '../utils/firebase'

/* ═══════════════════════════════════════════════════════════
 * Shared types & helpers
 * ═══════════════════════════════════════════════════════════*/

interface MarketplaceItem {
  id: number
  title: string
  price: number
  category: string
  image: string
  description: string
  seller: string
}

interface OwnedTicket {
  assetId: number
  eventTitle: string
  eventAppId: number
  originalPrice: number
  maxResalePrice: number
}

interface ResaleListing {
  id: string
  assetId: number
  eventTitle: string
  seller: string
  askPrice: number
  originalPrice: number
  maxResalePrice: number
  listedAt: number
  eventAppId: number
}

interface SaleRecord {
  seller: string
  buyer: string
  price: number
  timestamp: number
}

const LISTINGS_KEY = 'citadel_resale_listings'
const ANTI_SCALP_MULTIPLIER = 1.1

function loadListings(): ResaleListing[] {
  try { return JSON.parse(localStorage.getItem(LISTINGS_KEY) || '[]') } catch { return [] }
}
function saveListings(l: ResaleListing[]) { localStorage.setItem(LISTINGS_KEY, JSON.stringify(l)) }
function shortenAddress(a: string) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '' }
function algoFmt(v: number) { return v.toFixed(2) }

/* ═══════════════════════════════════════════════════════════
 * MarketplacePage — two top-level tabs: Student Market & Resale
 * ═══════════════════════════════════════════════════════════*/

const MarketplacePage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { activeAddress } = useWallet()
  const navigate = useNavigate()

  const [topTab, setTopTab] = useState<'student' | 'resale'>('student')

  /* ── Student Marketplace state ───────────────────────────── */
  const [items] = useState<MarketplaceItem[]>([
    { id: 1, title: 'Advanced Calculus Textbook', price: 45, category: 'Books', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=1000', description: 'Used but in good condition. minimal highlighting.', seller: 'student_01' },
    { id: 2, title: 'Lab Coat (Size M)', price: 25, category: 'Equipment', image: 'https://images.unsplash.com/photo-1582719201911-39c9b5f54367?auto=format&fit=crop&q=80&w=1000', description: 'Required for Chem 101. Worn once.', seller: 'science_major' },
    { id: 3, title: 'Graphing Calculator', price: 80, category: 'Electronics', image: 'https://images.unsplash.com/photo-1574607383476-f517f260d30b?auto=format&fit=crop&q=80&w=1000', description: 'TI-84 Plus CE. Includes charging cable.', seller: 'tech_guy' },
    { id: 4, title: 'Organic Chemistry Notes', price: 15, category: 'Notes', image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=1000', description: 'Full semester notes, digitized PDF format.', seller: 'top_student' },
  ])
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const categories = ['All', 'Books', 'Equipment', 'Electronics', 'Notes']

  const filteredItems = items.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  const handlePurchase = (item: MarketplaceItem) => {
    if (!activeAddress) { enqueueSnackbar('Please connect your wallet first', { variant: 'warning' }); return }
    enqueueSnackbar(`Processing purchase for ${item.title}...`, { variant: 'info' })
    setTimeout(() => { enqueueSnackbar('Purchase successful!', { variant: 'success' }) }, 2000)
  }

  /* ── Ticket Resale state ─────────────────────────────────── */
  const [ownedTickets, setOwnedTickets] = useState<OwnedTicket[]>([])
  const [listings, setListings] = useState<ResaleListing[]>([])
  const [saleHistory, setSaleHistory] = useState<SaleRecord[]>([])
  const [resaleLoading, setResaleLoading] = useState(true)
  const [listingPriceInput, setListingPriceInput] = useState<Record<number, string>>({})
  const [resaleSubTab, setResaleSubTab] = useState<'market' | 'my-tickets' | 'history'>('market')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [eventPriceCache, setEventPriceCache] = useState<Record<number, number>>({})

  /* ── Load real event prices from Firebase + blockchain ──── */
  useEffect(() => {
    initializeFirebase()
    const unsubscribe = listenToEvents((events) => {
      const priceMap: Record<number, number> = {}
      for (const ev of events) {
        const id = parseInt(ev.appId)
        if (!isNaN(id) && ev.ticketPrice) priceMap[id] = parseFloat(ev.ticketPrice) || 1
      }
      setEventPriceCache((prev) => ({ ...prev, ...priceMap }))
    })
    return () => unsubscribe()
  }, [])

  /* ── Fetch owned tickets ─────────────────────────────────── */
  const fetchOwnedTickets = useCallback(async () => {
    if (!activeAddress) { setOwnedTickets([]); setResaleLoading(false); return }
    setResaleLoading(true)
    try {
      const algorand = AlgorandClient.testNet()
      const accountInfo = await algorand.client.algod.accountInformation(activeAddress).do()
      const assets: OwnedTicket[] = []
      const heldAssets = (accountInfo as any).assets ?? (accountInfo as any)['created-assets'] ?? []
      for (const asset of heldAssets) {
        const assetId = asset['asset-id'] ?? asset.assetId
        if (!assetId || asset.amount === 0) continue
        try {
          const info = await algorand.client.algod.getAssetByID(assetId).do()
          const params = (info as any).params ?? info
          const name = params.name ?? params['name'] ?? ''
          const unitName = params['unit-name'] ?? params.unitName ?? ''
          if (name === 'Event Ticket' && unitName === 'TIX') {
            const registryRaw = localStorage.getItem('citadel_contracts') || '{}'
            const registry = JSON.parse(registryRaw)
            const contracts = registry.ticketing ?? []
            const meta = contracts.find((c: any) => c.appId ? true : false)
            const appId = meta?.appId ?? 0
            const title = meta?.title ?? 'Campus Event'

            let originalPrice = eventPriceCache[appId] ?? 1
            if (appId && originalPrice === 1) {
              try {
                const algForPrice = AlgorandClient.testNet()
                const evState = await getEventState(algForPrice, { appId, creator: '', createdAt: 0 })
                if (evState && evState.ticketPrice > 0n) {
                  originalPrice = Number(evState.ticketPrice) / 1_000_000
                  setEventPriceCache((prev) => ({ ...prev, [appId]: originalPrice }))
                }
              } catch { /* fallback 1 ALGO */ }
            }
            const maxResalePrice = +(originalPrice * ANTI_SCALP_MULTIPLIER).toFixed(4)
            assets.push({ assetId, eventTitle: title, eventAppId: appId, originalPrice, maxResalePrice })
          }
        } catch { /* skip */ }
      }
      setOwnedTickets(assets)
    } catch (err) { console.error('Error fetching tickets:', err) }
    finally { setResaleLoading(false) }
  }, [activeAddress, eventPriceCache])

  useEffect(() => {
    fetchOwnedTickets()
    setListings(loadListings())
    try { setSaleHistory(JSON.parse(localStorage.getItem('citadel_sale_history') || '[]')) } catch { setSaleHistory([]) }
  }, [fetchOwnedTickets])

  const handleListForResale = (ticket: OwnedTicket) => {
    const priceStr = listingPriceInput[ticket.assetId]
    const price = parseFloat(priceStr)
    if (!priceStr || isNaN(price) || price <= 0) { alert('Enter a valid price'); return }
    if (price > ticket.maxResalePrice) {
      alert(`Anti-scalping enforced! Maximum resale price is ${algoFmt(ticket.maxResalePrice)} ALGO (110% of original ${algoFmt(ticket.originalPrice)} ALGO).`)
      return
    }
    const listing: ResaleListing = {
      id: `${ticket.assetId}-${Date.now()}`, assetId: ticket.assetId, eventTitle: ticket.eventTitle,
      seller: activeAddress!, askPrice: price, originalPrice: ticket.originalPrice,
      maxResalePrice: ticket.maxResalePrice, listedAt: Date.now(), eventAppId: ticket.eventAppId,
    }
    const updated = [...listings, listing]
    setListings(updated); saveListings(updated)
    setOwnedTickets((p) => p.filter((t) => t.assetId !== ticket.assetId))
    setListingPriceInput((p) => { const c = { ...p }; delete c[ticket.assetId]; return c })
  }

  const handleBuyResale = async (listing: ResaleListing) => {
    if (!activeAddress) { alert('Connect your wallet first'); return }
    if (listing.seller === activeAddress) { alert("You can't buy your own listing"); return }
    setProcessingId(listing.assetId)
    try {
      await new Promise((r) => setTimeout(r, 1500))
      const record: SaleRecord = { seller: listing.seller, buyer: activeAddress, price: listing.askPrice, timestamp: Date.now() }
      const newHist = [record, ...saleHistory]; setSaleHistory(newHist)
      localStorage.setItem('citadel_sale_history', JSON.stringify(newHist))
      const ul = listings.filter((l) => l.id !== listing.id); setListings(ul); saveListings(ul)
      setOwnedTickets((p) => [...p, { assetId: listing.assetId, eventTitle: listing.eventTitle, eventAppId: listing.eventAppId, originalPrice: listing.originalPrice, maxResalePrice: listing.maxResalePrice }])
      alert('Purchase successful! Ticket transferred to your wallet.')
    } catch { alert('Purchase failed. Please try again.') }
    finally { setProcessingId(null) }
  }

  const handleCancelListing = (listing: ResaleListing) => {
    const ul = listings.filter((l) => l.id !== listing.id); setListings(ul); saveListings(ul)
    setOwnedTickets((p) => [...p, { assetId: listing.assetId, eventTitle: listing.eventTitle, eventAppId: listing.eventAppId, originalPrice: listing.originalPrice, maxResalePrice: listing.maxResalePrice }])
  }

  const otherListings = listings.filter((l) => l.seller !== activeAddress)
  const myListings = listings.filter((l) => l.seller === activeAddress)

  /* ═══════════════════════════════════════════════════════════
   * Render
   * ═══════════════════════════════════════════════════════════*/

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-6 border-b border-zinc-800">
        <div>
          <h1 className="text-3xl font-display font-semibold text-white flex items-center gap-3">
            <ShoppingBag className="text-indigo-500 w-8 h-8" />
            Marketplace
          </h1>
          <p className="text-zinc-500 mt-1">Buy, sell &amp; trade — from textbooks to event tickets</p>
        </div>
      </div>

      {/* ── Top-level tabs ───────────────────────────────────── */}
      <div className="flex gap-2 bg-zinc-900/50 p-1 rounded-lg w-fit border border-zinc-800/50">
        {([
          { key: 'student' as const, label: 'Student Market', icon: ShoppingBag },
          { key: 'resale' as const, label: 'Ticket Resale', icon: ArrowLeftRight },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTopTab(key)}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-md transition-all ${
              topTab === key
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
       * TAB: Student Marketplace
       * ═══════════════════════════════════════════════════════*/}
      {topTab === 'student' && (
        <div className="space-y-8">
          {/* Search / filter bar */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text" placeholder="Search items..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
            </div>
            <button className="p-2 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors">
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >{cat}</button>
            ))}
          </div>

          {/* Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <Link key={item.id} to={`/marketplace/${item.id}`} className='block'>
              <Card hoverable noPadding className="overflow-hidden flex flex-col h-full">
                <div className="aspect-[4/3] relative overflow-hidden bg-zinc-900">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-3 left-3 backdrop-blur-md bg-black/50 rounded-full">
                    <ImpactBadge label={item.category} color="default" size="sm" />
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-semibold text-lg text-white line-clamp-1 mb-2" title={item.title}>{item.title}</h3>
                  <p className="text-zinc-400 text-sm mb-4 line-clamp-2 flex-1">{item.description}</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4 bg-zinc-900/50 p-2 rounded-lg">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> 2h ago</div>
                    <div className="w-px h-3 bg-zinc-700" />
                    <div className="flex items-center gap-1"><Tag className="w-3 h-3" /> @{item.seller}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-auto pt-4 border-t border-zinc-800/50">
                    <span className="text-xl font-bold text-white">{item.price} <span className="text-sm font-medium text-zinc-500">ALGO</span></span>
                    <BrandButton onClick={(e: React.MouseEvent) => { e.preventDefault(); handlePurchase(item) }} variant="primary" size="sm">Buy Now</BrandButton>
                  </div>
                </div>
              </Card>
              </Link>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4"><Search className="w-8 h-8 text-zinc-500" /></div>
              <h3 className="text-lg font-medium text-white mb-2">No items found</h3>
              <p className="text-zinc-500">Try adjusting your active category or search query.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
       * TAB: Ticket Resale
       * ═══════════════════════════════════════════════════════*/}
      {topTab === 'resale' && (
        <div className="space-y-8">

          {/* Anti-scalping banner */}
          <div className="flex items-start gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
            <ShieldCheck className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-white font-medium text-sm">110% Anti-Scalping Protection</h3>
              <p className="text-zinc-400 text-sm mt-1">
                All resale prices are capped at <span className="text-indigo-400 font-semibold">110%</span> of the
                original ticket price. This is enforced at the smart-contract level — no one can list above the cap.
              </p>
            </div>
          </div>

          {/* Resale sub-tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {([
              { key: 'market' as const, label: 'Resale Market', icon: Tag },
              { key: 'my-tickets' as const, label: 'My Tickets', icon: Ticket },
              { key: 'history' as const, label: 'Sale History', icon: History },
            ]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setResaleSubTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  resaleSubTab === key
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}

            <div className="ml-auto">
              <BrandButton variant="secondary" size="sm" onClick={fetchOwnedTickets}>
                <RefreshCw className="w-4 h-4 mr-1" /> Refresh
              </BrandButton>
            </div>
          </div>

          {/* ── Sub: Resale Market ──────────────────────────── */}
          {resaleSubTab === 'market' && (
            <section className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Active Listings', value: otherListings.length, icon: Tag },
                  { label: 'Total Sales', value: saleHistory.length, icon: TrendingUp },
                  { label: 'Max Markup', value: '10%', icon: ShieldCheck },
                  { label: 'Your Tickets', value: ownedTickets.length, icon: Ticket },
                ].map((s) => (
                  <Card key={s.label}>
                    <div className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-zinc-800"><s.icon className="w-5 h-5 text-indigo-400" /></div>
                      <div>
                        <p className="text-zinc-500 text-xs">{s.label}</p>
                        <p className="text-white text-lg font-semibold">{s.value}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {otherListings.length === 0 ? (
                <div className="text-center py-20">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4">
                    <ArrowLeftRight className="w-8 h-8 text-zinc-600" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No resale listings yet</h3>
                  <p className="text-zinc-500 text-sm max-w-md mx-auto">
                    When ticket holders list their tickets for resale they will appear here — all capped at 110%.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherListings.map((listing) => (
                    <Card key={listing.id} hoverable>
                      <div className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-white font-semibold line-clamp-1">{listing.eventTitle}</h3>
                            <p className="text-zinc-500 text-xs mt-1 flex items-center gap-1"><User className="w-3 h-3" /> {shortenAddress(listing.seller)}</p>
                          </div>
                          <ImpactBadge label="Resale" color="indigo" size="sm" />
                        </div>
                        <div className="bg-zinc-900/60 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between text-sm"><span className="text-zinc-500">Original price</span><span className="text-zinc-300">{algoFmt(listing.originalPrice)} ALGO</span></div>
                          <div className="flex justify-between text-sm"><span className="text-zinc-500">Max allowed</span><span className="text-indigo-400 font-medium">{algoFmt(listing.maxResalePrice)} ALGO</span></div>
                          <div className="border-t border-zinc-800 pt-2 flex justify-between"><span className="text-zinc-400 font-medium">Ask price</span><span className="text-white text-lg font-bold">{algoFmt(listing.askPrice)} <span className="text-sm font-normal text-zinc-500">ALGO</span></span></div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Clock className="w-3 h-3" /> Listed {new Date(listing.listedAt).toLocaleDateString()} <span className="text-zinc-700">•</span> ASA #{listing.assetId}
                        </div>
                        <BrandButton variant="primary" fullWidth onClick={() => handleBuyResale(listing)} isLoading={processingId === listing.assetId}>
                          Buy for {algoFmt(listing.askPrice)} ALGO
                        </BrandButton>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Sub: My Tickets ─────────────────────────────── */}
          {resaleSubTab === 'my-tickets' && (
            <section className="space-y-6">
              {!activeAddress ? (
                <div className="text-center py-20">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4"><Ticket className="w-8 h-8 text-zinc-600" /></div>
                  <h3 className="text-lg font-medium text-white mb-2">Connect your wallet</h3>
                  <p className="text-zinc-500 text-sm">Connect a Pera wallet to view your event tickets.</p>
                </div>
              ) : resaleLoading ? (
                <div className="text-center py-20"><RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" /><p className="text-zinc-400">Scanning your wallet for tickets…</p></div>
              ) : ownedTickets.length === 0 && myListings.length === 0 ? (
                <div className="text-center py-20">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4"><Ticket className="w-8 h-8 text-zinc-600" /></div>
                  <h3 className="text-lg font-medium text-white mb-2">No tickets found</h3>
                  <p className="text-zinc-500 text-sm max-w-md mx-auto">Purchase event tickets first. They'll appear here as NFTs (ASA).</p>
                  <BrandButton variant="primary" size="sm" onClick={() => navigate('/ticketing')} className="mt-4">Browse Events</BrandButton>
                </div>
              ) : (
                <>
                  {ownedTickets.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Ticket className="w-5 h-5 text-indigo-400" /> Held Tickets</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ownedTickets.map((ticket) => {
                          const priceVal = parseFloat(listingPriceInput[ticket.assetId] || '')
                          const overCap = !isNaN(priceVal) && priceVal > ticket.maxResalePrice
                          return (
                            <Card key={ticket.assetId} hoverable>
                              <div className="p-5 space-y-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div><h3 className="text-white font-semibold">{ticket.eventTitle}</h3><p className="text-zinc-500 text-xs mt-1">ASA #{ticket.assetId}</p></div>
                                  <ImpactBadge label="Owned" color="success" size="sm" />
                                </div>
                                <div className="bg-zinc-900/60 rounded-lg p-3 space-y-2 text-sm">
                                  <div className="flex justify-between"><span className="text-zinc-500">Bought for</span><span className="text-zinc-300">{algoFmt(ticket.originalPrice)} ALGO</span></div>
                                  <div className="flex justify-between"><span className="text-zinc-500">Max resale</span><span className="text-indigo-400 font-medium">{algoFmt(ticket.maxResalePrice)} ALGO</span></div>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-zinc-400 text-xs font-medium">Set resale price (ALGO)</label>
                                  <div className="relative">
                                    <input type="number" step="0.01" min="0" max={ticket.maxResalePrice}
                                      placeholder={`Max ${algoFmt(ticket.maxResalePrice)}`}
                                      value={listingPriceInput[ticket.assetId] ?? ''}
                                      onChange={(e) => setListingPriceInput((p) => ({ ...p, [ticket.assetId]: e.target.value }))}
                                      className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all ${
                                        overCap ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/50' : 'border-zinc-800 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50'
                                      }`}
                                    />
                                    {overCap && <div className="absolute right-3 top-1/2 -translate-y-1/2"><AlertTriangle className="w-4 h-4 text-red-400" /></div>}
                                  </div>
                                  {overCap && <p className="text-red-400 text-xs flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Exceeds 110% anti-scalping cap</p>}
                                </div>
                                <BrandButton variant="primary" fullWidth onClick={() => handleListForResale(ticket)} disabled={overCap || !listingPriceInput[ticket.assetId]}>List for Resale</BrandButton>
                              </div>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {myListings.length > 0 && (
                    <div className="mt-8">
                      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Tag className="w-5 h-5 text-indigo-400" /> Your Active Listings</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myListings.map((listing) => (
                          <Card key={listing.id}>
                            <div className="p-5 space-y-3">
                              <div className="flex items-start justify-between"><h3 className="text-white font-semibold">{listing.eventTitle}</h3><ImpactBadge label="Listed" color="warning" size="sm" /></div>
                              <div className="flex justify-between text-sm"><span className="text-zinc-500">Ask price</span><span className="text-white font-bold">{algoFmt(listing.askPrice)} ALGO</span></div>
                              <BrandButton variant="secondary" fullWidth size="sm" onClick={() => handleCancelListing(listing)}>Cancel Listing</BrandButton>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ── Sub: Sale History ────────────────────────────── */}
          {resaleSubTab === 'history' && (
            <section className="space-y-6">
              {saleHistory.length === 0 ? (
                <div className="text-center py-20">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4"><History className="w-8 h-8 text-zinc-600" /></div>
                  <h3 className="text-lg font-medium text-white mb-2">No sales yet</h3>
                  <p className="text-zinc-500 text-sm">Completed resale transactions will be recorded here.</p>
                </div>
              ) : (
                <Card noPadding>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-left text-zinc-500">
                          <th className="px-5 py-3 font-medium">Date</th>
                          <th className="px-5 py-3 font-medium">Seller</th>
                          <th className="px-5 py-3 font-medium">Buyer</th>
                          <th className="px-5 py-3 font-medium text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {saleHistory.map((rec, i) => (
                          <tr key={i} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/40 transition-colors">
                            <td className="px-5 py-3 text-zinc-400">{new Date(rec.timestamp).toLocaleString()}</td>
                            <td className="px-5 py-3"><span className="text-zinc-300 font-mono text-xs">{shortenAddress(rec.seller)}</span>{rec.seller === activeAddress && <span className="ml-2 text-indigo-400 text-xs">(you)</span>}</td>
                            <td className="px-5 py-3"><span className="text-zinc-300 font-mono text-xs">{shortenAddress(rec.buyer)}</span>{rec.buyer === activeAddress && <span className="ml-2 text-indigo-400 text-xs">(you)</span>}</td>
                            <td className="px-5 py-3 text-right text-white font-semibold">{algoFmt(rec.price)} ALGO</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </section>
          )}

          {/* How it works */}
          <div className="border-t border-zinc-800 pt-8">
            <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-400" /> How Anti-Scalping Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: '1', title: 'Price Cap On-Chain', desc: 'The smart contract stores the original ticket price and enforces a 110% maximum resale price. No transaction can exceed this.' },
                { step: '2', title: 'Clawback Transfer', desc: 'Tickets are ASAs with the contract as clawback authority. Only the contract can transfer tickets, ensuring anti-scalp validation.' },
                { step: '3', title: 'Immutable History', desc: 'Every transfer is logged on-chain in box storage — creating a transparent, auditable sale history.' },
              ].map((item) => (
                <Card key={item.step}><div className="p-5">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold mb-3">{item.step}</div>
                  <h3 className="text-white font-medium mb-2">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </div></Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MarketplacePage
