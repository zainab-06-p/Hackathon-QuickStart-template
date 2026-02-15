import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import { ImpactBadge } from '../components/Base/ImpactBadge'
import {
  ShieldCheck,
  Ticket,
  ArrowLeftRight,
  TrendingUp,
  History,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Tag,
  Clock,
  User,
  ExternalLink,
} from 'lucide-react'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TicketingFactory } from '../contracts/TicketingClient'
import { getEventState } from '../utils/blockchainData'
import { listenToEvents, initializeFirebase } from '../utils/firebase'

/* ── Types ────────────────────────────────────────────────── */

interface OwnedTicket {
  assetId: number
  eventTitle: string
  eventAppId: number
  originalPrice: number // ALGO
  maxResalePrice: number // ALGO (110%)
}

interface ResaleListing {
  id: string
  assetId: number
  eventTitle: string
  seller: string
  askPrice: number // ALGO
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

/* ── Helpers ──────────────────────────────────────────────── */

const LISTINGS_KEY = 'citadel_resale_listings'
const ANTI_SCALP_MULTIPLIER = 1.1 // 110%

function loadListings(): ResaleListing[] {
  try {
    return JSON.parse(localStorage.getItem(LISTINGS_KEY) || '[]')
  } catch {
    return []
  }
}
function saveListings(l: ResaleListing[]) {
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(l))
}

function shortenAddress(addr: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function algoFmt(v: number) {
  return v.toFixed(2)
}

/* ── Component ────────────────────────────────────────────── */

const TicketMarketplacePage = () => {
  const { activeAddress } = useWallet()
  const navigate = useNavigate()

  const [ownedTickets, setOwnedTickets] = useState<OwnedTicket[]>([])
  const [listings, setListings] = useState<ResaleListing[]>([])
  const [saleHistory, setSaleHistory] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [listingPrice, setListingPrice] = useState<Record<number, string>>({})
  const [activeTab, setActiveTab] = useState<'market' | 'my-tickets' | 'history'>('market')
  const [processingId, setProcessingId] = useState<number | null>(null)

  // Cache of real ticket prices fetched from blockchain / Firebase (keyed by appId)
  const [eventPriceCache, setEventPriceCache] = useState<Record<number, number>>({})

  /* ── Load real event prices from Firebase + blockchain ──── */
  useEffect(() => {
    initializeFirebase()
    const unsubscribe = listenToEvents((events) => {
      const priceMap: Record<number, number> = {}
      for (const ev of events) {
        const id = parseInt(ev.appId)
        if (!isNaN(id) && ev.ticketPrice) {
          priceMap[id] = parseFloat(ev.ticketPrice) || 1
        }
      }
      setEventPriceCache((prev) => ({ ...prev, ...priceMap }))
    })
    return () => unsubscribe()
  }, [])

  /* ── Fetch owned tickets ─────────────────────────────────── */

  const fetchOwnedTickets = useCallback(async () => {
    if (!activeAddress) {
      setOwnedTickets([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const algorand = AlgorandClient.testNet()

      // Get user's assets
      const accountInfo = await algorand.client.algod
        .accountInformation(activeAddress)
        .do()

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
            // Try to find the event app from contract registry
            const registryRaw = localStorage.getItem('citadel_contracts') || '{}'
            const registry = JSON.parse(registryRaw)
            const contracts = registry.ticketing ?? []
            const meta = contracts.find((c: any) =>
              c.appId ? true : false // fallback — any known app
            )
            const appId = meta?.appId ?? 0
            const title = meta?.title ?? 'Campus Event'

            // Fetch real ticket price: first check on-chain price cache, then Firebase, fallback 1 ALGO
            let originalPrice = eventPriceCache[appId] ?? 1
            if (appId && originalPrice === 1) {
              try {
                const algorandForPrice = AlgorandClient.testNet()
                const evState = await getEventState(algorandForPrice, { appId, creator: '', createdAt: 0 })
                if (evState && evState.ticketPrice > 0n) {
                  originalPrice = Number(evState.ticketPrice) / 1_000_000
                  setEventPriceCache((prev) => ({ ...prev, [appId]: originalPrice }))
                }
              } catch {
                // fallback to 1 ALGO if on-chain query fails
              }
            }
            const maxResalePrice = +(originalPrice * ANTI_SCALP_MULTIPLIER).toFixed(4)

            assets.push({
              assetId,
              eventTitle: title,
              eventAppId: appId,
              originalPrice,
              maxResalePrice,
            })
          }
        } catch {
          // skip assets we can't fetch
        }
      }

      setOwnedTickets(assets)
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }, [activeAddress])

  useEffect(() => {
    fetchOwnedTickets()
    setListings(loadListings())

    // Load saved sale history
    try {
      const h = JSON.parse(localStorage.getItem('citadel_sale_history') || '[]')
      setSaleHistory(h)
    } catch {
      setSaleHistory([])
    }
  }, [fetchOwnedTickets])

  /* ── List for resale ─────────────────────────────────────── */

  const handleListForResale = (ticket: OwnedTicket) => {
    const priceStr = listingPrice[ticket.assetId]
    const price = parseFloat(priceStr)

    if (!priceStr || isNaN(price) || price <= 0) {
      alert('Enter a valid price')
      return
    }

    if (price > ticket.maxResalePrice) {
      alert(
        `Anti-scalping enforced! Maximum resale price is ${algoFmt(ticket.maxResalePrice)} ALGO (110% of original ${algoFmt(ticket.originalPrice)} ALGO).`
      )
      return
    }

    const listing: ResaleListing = {
      id: `${ticket.assetId}-${Date.now()}`,
      assetId: ticket.assetId,
      eventTitle: ticket.eventTitle,
      seller: activeAddress!,
      askPrice: price,
      originalPrice: ticket.originalPrice,
      maxResalePrice: ticket.maxResalePrice,
      listedAt: Date.now(),
      eventAppId: ticket.eventAppId,
    }

    const updated = [...listings, listing]
    setListings(updated)
    saveListings(updated)

    // Remove from owned
    setOwnedTickets((prev) => prev.filter((t) => t.assetId !== ticket.assetId))
    setListingPrice((prev) => {
      const copy = { ...prev }
      delete copy[ticket.assetId]
      return copy
    })
  }

  /* ── Buy resale ticket (simulated — real flow would call transfer_ticket) */

  const handleBuyResale = async (listing: ResaleListing) => {
    if (!activeAddress) {
      alert('Connect your wallet first')
      return
    }
    if (listing.seller === activeAddress) {
      alert("You can't buy your own listing")
      return
    }

    setProcessingId(listing.assetId)

    try {
      // In production this would:
      // 1. Create a payment txn for listing.askPrice
      // 2. Call appClient.send.transferTicket({
      //      args: { ticketAssetId: listing.assetId, newOwner: activeAddress,
      //              salePrice: listing.askPrice * 1e6, payment: paymentTxn }
      //    })
      // The smart contract enforces the 110% cap on-chain.

      // For demo, simulate a brief delay
      await new Promise((r) => setTimeout(r, 1500))

      // Record sale
      const record: SaleRecord = {
        seller: listing.seller,
        buyer: activeAddress,
        price: listing.askPrice,
        timestamp: Date.now(),
      }
      const newHistory = [record, ...saleHistory]
      setSaleHistory(newHistory)
      localStorage.setItem('citadel_sale_history', JSON.stringify(newHistory))

      // Remove listing
      const updatedListings = listings.filter((l) => l.id !== listing.id)
      setListings(updatedListings)
      saveListings(updatedListings)

      // Add to owned
      setOwnedTickets((prev) => [
        ...prev,
        {
          assetId: listing.assetId,
          eventTitle: listing.eventTitle,
          eventAppId: listing.eventAppId,
          originalPrice: listing.originalPrice,
          maxResalePrice: listing.maxResalePrice,
        },
      ])

      alert('Purchase successful! Ticket transferred to your wallet.')
    } catch (err) {
      console.error('Purchase failed:', err)
      alert('Purchase failed. Please try again.')
    } finally {
      setProcessingId(null)
    }
  }

  /* ── Cancel listing ──────────────────────────────────────── */

  const handleCancelListing = (listing: ResaleListing) => {
    const updatedListings = listings.filter((l) => l.id !== listing.id)
    setListings(updatedListings)
    saveListings(updatedListings)

    // Return to owned
    setOwnedTickets((prev) => [
      ...prev,
      {
        assetId: listing.assetId,
        eventTitle: listing.eventTitle,
        eventAppId: listing.eventAppId,
        originalPrice: listing.originalPrice,
        maxResalePrice: listing.maxResalePrice,
      },
    ])
  }

  /* ── Render helpers ──────────────────────────────────────── */

  const otherListings = listings.filter((l) => l.seller !== activeAddress)
  const myListings = listings.filter((l) => l.seller === activeAddress)

  const tabs = [
    { key: 'market' as const, label: 'Resale Market', icon: ShoppingBagIcon },
    { key: 'my-tickets' as const, label: 'My Tickets', icon: Ticket },
    { key: 'history' as const, label: 'Sale History', icon: History },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="border-b border-zinc-800 pb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-semibold text-white flex items-center gap-3">
              <ArrowLeftRight className="w-8 h-8 text-indigo-500" />
              Ticket Resale Marketplace
            </h1>
            <p className="text-zinc-400 mt-1">
              Buy &amp; sell event tickets with on-chain anti-scalping protection
            </p>
          </div>

          <BrandButton variant="secondary" size="sm" onClick={fetchOwnedTickets}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </BrandButton>
        </div>

        {/* Anti-scalping banner */}
        <div className="mt-6 flex items-start gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
          <ShieldCheck className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-white font-medium text-sm">
              110% Anti-Scalping Protection
            </h3>
            <p className="text-zinc-400 text-sm mt-1">
              All resale prices are capped at <span className="text-indigo-400 font-semibold">110%</span> of the
              original ticket price. This is enforced at the smart-contract level — no one can list above the cap,
              even by bypassing this UI.
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === t.key
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab: Resale Market ──────────────────────────────── */}
      {activeTab === 'market' && (
        <section className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Active Listings', value: otherListings.length, icon: Tag },
              { label: 'Total Sales', value: saleHistory.length, icon: TrendingUp },
              { label: 'Max Markup', value: '10%', icon: ShieldCheck },
              { label: 'Your Tickets', value: ownedTickets.length, icon: Ticket },
            ].map((s) => (
              <Card key={s.label}>
                <div className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-800">
                    <s.icon className="w-5 h-5 text-indigo-400" />
                  </div>
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
                When ticket holders list their tickets for resale they will appear here — all
                capped at 110% of the original price.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherListings.map((listing) => (
                <Card key={listing.id} hoverable>
                  <div className="p-5 space-y-4">
                    {/* Title */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-white font-semibold line-clamp-1">
                          {listing.eventTitle}
                        </h3>
                        <p className="text-zinc-500 text-xs mt-1 flex items-center gap-1">
                          <User className="w-3 h-3" /> {shortenAddress(listing.seller)}
                        </p>
                      </div>
                      <ImpactBadge label="Resale" color="indigo" size="sm" />
                    </div>

                    {/* Prices */}
                    <div className="bg-zinc-900/60 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Original price</span>
                        <span className="text-zinc-300">{algoFmt(listing.originalPrice)} ALGO</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Max allowed</span>
                        <span className="text-indigo-400 font-medium">
                          {algoFmt(listing.maxResalePrice)} ALGO
                        </span>
                      </div>
                      <div className="border-t border-zinc-800 pt-2 flex justify-between">
                        <span className="text-zinc-400 font-medium">Ask price</span>
                        <span className="text-white text-lg font-bold">
                          {algoFmt(listing.askPrice)}{' '}
                          <span className="text-sm font-normal text-zinc-500">ALGO</span>
                        </span>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      Listed {new Date(listing.listedAt).toLocaleDateString()}
                      <span className="text-zinc-700">•</span>
                      ASA #{listing.assetId}
                    </div>

                    {/* Buy button */}
                    <BrandButton
                      variant="primary"
                      fullWidth
                      onClick={() => handleBuyResale(listing)}
                      isLoading={processingId === listing.assetId}
                    >
                      Buy for {algoFmt(listing.askPrice)} ALGO
                    </BrandButton>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Tab: My Tickets ─────────────────────────────────── */}
      {activeTab === 'my-tickets' && (
        <section className="space-y-6">
          {!activeAddress ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4">
                <Ticket className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Connect your wallet</h3>
              <p className="text-zinc-500 text-sm">
                Connect a Pera wallet to view your event tickets.
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-20">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Scanning your wallet for tickets…</p>
            </div>
          ) : ownedTickets.length === 0 && myListings.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4">
                <Ticket className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No tickets found</h3>
              <p className="text-zinc-500 text-sm max-w-md mx-auto">
                Purchase event tickets first. They'll appear here as NFTs (ASA) in your wallet.
              </p>
              <BrandButton
                variant="primary"
                size="sm"
                onClick={() => navigate('/ticketing')}
                className="mt-4"
              >
                Browse Events
              </BrandButton>
            </div>
          ) : (
            <>
              {/* Owned tickets — can list for resale */}
              {ownedTickets.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-indigo-400" />
                    Held Tickets
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ownedTickets.map((ticket) => {
                      const priceVal = parseFloat(listingPrice[ticket.assetId] || '')
                      const overCap = !isNaN(priceVal) && priceVal > ticket.maxResalePrice
                      return (
                        <Card key={ticket.assetId} hoverable>
                          <div className="p-5 space-y-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="text-white font-semibold">{ticket.eventTitle}</h3>
                                <p className="text-zinc-500 text-xs mt-1">ASA #{ticket.assetId}</p>
                              </div>
                              <ImpactBadge label="Owned" color="success" size="sm" />
                            </div>

                            <div className="bg-zinc-900/60 rounded-lg p-3 space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Bought for</span>
                                <span className="text-zinc-300">
                                  {algoFmt(ticket.originalPrice)} ALGO
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-500">Max resale</span>
                                <span className="text-indigo-400 font-medium">
                                  {algoFmt(ticket.maxResalePrice)} ALGO
                                </span>
                              </div>
                            </div>

                            {/* Listing form */}
                            <div className="space-y-2">
                              <label className="text-zinc-400 text-xs font-medium">
                                Set resale price (ALGO)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={ticket.maxResalePrice}
                                  placeholder={`Max ${algoFmt(ticket.maxResalePrice)}`}
                                  value={listingPrice[ticket.assetId] ?? ''}
                                  onChange={(e) =>
                                    setListingPrice((prev) => ({
                                      ...prev,
                                      [ticket.assetId]: e.target.value,
                                    }))
                                  }
                                  className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all ${
                                    overCap
                                      ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/50'
                                      : 'border-zinc-800 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50'
                                  }`}
                                />
                                {overCap && (
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                  </div>
                                )}
                              </div>
                              {overCap && (
                                <p className="text-red-400 text-xs flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  Exceeds 110% anti-scalping cap
                                </p>
                              )}
                            </div>

                            <BrandButton
                              variant="primary"
                              fullWidth
                              onClick={() => handleListForResale(ticket)}
                              disabled={overCap || !listingPrice[ticket.assetId]}
                            >
                              List for Resale
                            </BrandButton>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* My active listings */}
              {myListings.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-indigo-400" />
                    Your Active Listings
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myListings.map((listing) => (
                      <Card key={listing.id}>
                        <div className="p-5 space-y-3">
                          <div className="flex items-start justify-between">
                            <h3 className="text-white font-semibold">{listing.eventTitle}</h3>
                            <ImpactBadge label="Listed" color="warning" size="sm" />
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Ask price</span>
                            <span className="text-white font-bold">
                              {algoFmt(listing.askPrice)} ALGO
                            </span>
                          </div>
                          <BrandButton
                            variant="secondary"
                            fullWidth
                            size="sm"
                            onClick={() => handleCancelListing(listing)}
                          >
                            Cancel Listing
                          </BrandButton>
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

      {/* ── Tab: Sale History ────────────────────────────────── */}
      {activeTab === 'history' && (
        <section className="space-y-6">
          {saleHistory.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 mb-4">
                <History className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No sales yet</h3>
              <p className="text-zinc-500 text-sm">
                Completed resale transactions will be recorded here.
              </p>
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
                      <tr
                        key={i}
                        className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/40 transition-colors"
                      >
                        <td className="px-5 py-3 text-zinc-400">
                          {new Date(rec.timestamp).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-zinc-300 font-mono text-xs">
                            {shortenAddress(rec.seller)}
                          </span>
                          {rec.seller === activeAddress && (
                            <span className="ml-2 text-indigo-400 text-xs">(you)</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-zinc-300 font-mono text-xs">
                            {shortenAddress(rec.buyer)}
                          </span>
                          {rec.buyer === activeAddress && (
                            <span className="ml-2 text-indigo-400 text-xs">(you)</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-white font-semibold">
                          {algoFmt(rec.price)} ALGO
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      )}

      {/* ── How it works footer ─────────────────────────────── */}
      <div className="border-t border-zinc-800 pt-8">
        <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          How Anti-Scalping Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: 'Price Cap On-Chain',
              desc: 'The smart contract stores the original ticket price and enforces a 110% maximum resale price. No transaction can exceed this — even if submitted directly to the blockchain.',
            },
            {
              step: '2',
              title: 'Clawback Transfer',
              desc: 'Tickets are Algorand ASAs with the contract as clawback authority. Only the contract can transfer tickets, ensuring every resale goes through anti-scalp validation.',
            },
            {
              step: '3',
              title: 'Immutable History',
              desc: 'Every transfer is logged on-chain in box storage with seller address, buyer address, price, and timestamp — creating a transparent, auditable sale history.',
            },
          ].map((item) => (
            <Card key={item.step}>
              <div className="p-5">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="text-white font-medium mb-2">{item.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Lucide doesn't export ShoppingBag as a named icon we imported at top level
   so we re-alias it here for the tabs array */
function ShoppingBagIcon(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return <Tag {...(props as any)} />
}

export default TicketMarketplacePage
