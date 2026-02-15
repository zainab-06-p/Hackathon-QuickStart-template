import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { listenToCampaigns, listenToEvents, initializeFirebase } from '../utils/firebase'
import {
  Search, ExternalLink, ChevronLeft, ChevronRight, Filter, RefreshCw,
  ArrowUpDown, Copy, Check, Clock, Hash, Layers, Wallet, Activity, Database,
  ArrowRightLeft, FileCode, Coins, Zap
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface IndexerTransaction {
  id: string
  'confirmed-round': number
  'round-time': number
  sender: string
  fee: number
  'tx-type': string
  'payment-transaction'?: {
    receiver: string
    amount: number
    'close-remainder-to'?: string
  }
  'application-transaction'?: {
    'application-id': number
    'on-completion': string
    'application-args'?: string[]
  }
  'asset-transfer-transaction'?: {
    'asset-id': number
    amount: number
    receiver: string
  }
  'inner-txns'?: IndexerTransaction[]
  group?: string
  note?: string
}

interface ContractInfo {
  appId: number
  title: string
  type: 'campaign' | 'event'
  creator: string
}

type TxFilter = 'all' | 'appl' | 'pay' | 'axfer'

// ─── Constants ───────────────────────────────────────────────────────────────

const LORA_BASE = 'https://lora.algokit.io/testnet'
const PAGE_SIZE = 25

// ─── Component ───────────────────────────────────────────────────────────────

const ExplorerPage = () => {
  const { activeAddress } = useWallet()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const indexerBase = `${indexerConfig.server}${indexerConfig.port ? ':' + indexerConfig.port : ''}`

  // State
  const [contracts, setContracts] = useState<ContractInfo[]>([])
  const [transactions, setTransactions] = useState<IndexerTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTxns, setLoadingTxns] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<TxFilter>('all')
  const [selectedContract, setSelectedContract] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [nextToken, setNextToken] = useState<string | null>(null)
  const [pageTokens, setPageTokens] = useState<Record<number, string>>({})
  const [totalTxns, setTotalTxns] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [networkStats, setNetworkStats] = useState({ latestRound: 0, txnCount: 0 })
  const [showContractPanel, setShowContractPanel] = useState(true)

  // ─── Load contracts from Firebase ────────────────────────────────────────

  useEffect(() => {
    initializeFirebase()
    const allContracts: ContractInfo[] = []

    const unsubCampaigns = listenToCampaigns((campaigns) => {
      const campaignContracts: ContractInfo[] = campaigns.map(c => ({
        appId: parseInt(c.appId),
        title: c.title || `Campaign #${c.appId}`,
        type: 'campaign' as const,
        creator: c.creator
      }))
      // Merge: keep events, replace campaigns
      setContracts(prev => {
        const events = prev.filter(c => c.type === 'event')
        return [...campaignContracts, ...events].sort((a, b) => b.appId - a.appId)
      })
      setLoading(false)
    })

    const unsubEvents = listenToEvents((events) => {
      const eventContracts: ContractInfo[] = events.map(e => ({
        appId: parseInt(e.appId),
        title: e.title || `Event #${e.appId}`,
        type: 'event' as const,
        creator: e.creator
      }))
      setContracts(prev => {
        const campaigns = prev.filter(c => c.type === 'campaign')
        return [...campaigns, ...eventContracts].sort((a, b) => b.appId - a.appId)
      })
      setLoading(false)
    })

    // Get latest round from algod
    fetchLatestRound()

    return () => { unsubCampaigns(); unsubEvents() }
  }, [])

  // ─── Fetch latest round ──────────────────────────────────────────────────

  const fetchLatestRound = async () => {
    try {
      const algodServer = import.meta.env.VITE_ALGOD_SERVER || 'https://testnet-api.algonode.cloud'
      const res = await fetch(`${algodServer}/v2/status`, {
        headers: { 'X-Algo-API-Token': import.meta.env.VITE_ALGOD_TOKEN || '' }
      })
      const data = await res.json()
      setNetworkStats(prev => ({ ...prev, latestRound: data['last-round'] || 0 }))
    } catch (e) {
      console.warn('Failed to fetch latest round:', e)
    }
  }

  // ─── Fetch transactions for a contract ───────────────────────────────────

  const fetchTransactions = useCallback(async (appId: number | null, pageToken?: string) => {
    setLoadingTxns(true)
    try {
      let url: string
      if (appId) {
        url = `${indexerBase}/v2/transactions?application-id=${appId}&limit=${PAGE_SIZE}`
      } else {
        // Fetch txns for ALL contracts
        const allTxns: IndexerTransaction[] = []
        for (const contract of contracts) {
          try {
            const res = await fetch(
              `${indexerBase}/v2/transactions?application-id=${contract.appId}&limit=50`
            )
            const data = await res.json()
            if (data.transactions) {
              allTxns.push(...data.transactions)
            }
          } catch (e) {
            console.warn(`Failed to fetch txns for app ${contract.appId}:`, e)
          }
        }
        // Sort by round-time descending and deduplicate
        const seen = new Set<string>()
        const unique = allTxns.filter(tx => {
          if (seen.has(tx.id)) return false
          seen.add(tx.id)
          return true
        }).sort((a, b) => (b['round-time'] || 0) - (a['round-time'] || 0))
        
        setTransactions(unique)
        setTotalTxns(unique.length)
        setLoadingTxns(false)
        setLastRefresh(new Date())
        return
      }

      if (pageToken) url += `&next=${pageToken}`

      const res = await fetch(url)
      const data = await res.json()

      setTransactions(data.transactions || [])
      setNextToken(data['next-token'] || null)
      setTotalTxns(data.transactions?.length || 0)
      setLastRefresh(new Date())
    } catch (e) {
      console.error('Failed to fetch transactions:', e)
      setTransactions([])
    }
    setLoadingTxns(false)
  }, [contracts, indexerBase])

  // Auto-load all txns when contracts are loaded
  useEffect(() => {
    if (contracts.length > 0 && transactions.length === 0) {
      fetchTransactions(selectedContract)
    }
  }, [contracts])

  // ─── Handle contract click ───────────────────────────────────────────────

  const handleSelectContract = (appId: number | null) => {
    setSelectedContract(appId)
    setPage(1)
    setPageTokens({})
    fetchTransactions(appId)
  }

  // ─── Handle pagination ──────────────────────────────────────────────────

  const handleNextPage = () => {
    if (nextToken) {
      const newPage = page + 1
      setPageTokens(prev => ({ ...prev, [newPage]: nextToken }))
      setPage(newPage)
      fetchTransactions(selectedContract, nextToken)
    }
  }

  const handlePrevPage = () => {
    if (page > 1) {
      const newPage = page - 1
      setPage(newPage)
      fetchTransactions(selectedContract, pageTokens[newPage])
    }
  }

  // ─── Copy to clipboard ──────────────────────────────────────────────────

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ─── Filter & search ────────────────────────────────────────────────────

  const filteredTxns = transactions.filter(tx => {
    // Type filter
    if (filter !== 'all' && tx['tx-type'] !== filter) return false

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        tx.id?.toLowerCase().includes(q) ||
        tx.sender?.toLowerCase().includes(q) ||
        tx['payment-transaction']?.receiver?.toLowerCase().includes(q) ||
        tx['application-transaction']?.['application-id']?.toString().includes(q) ||
        tx['confirmed-round']?.toString().includes(q)
      )
    }
    return true
  })

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const formatAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—'
  const formatTime = (ts: number) => {
    if (!ts) return '—'
    const d = new Date(ts * 1000)
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }
  const formatAlgo = (microAlgo: number) => (microAlgo / 1_000_000).toFixed(4)

  const getTxTypeLabel = (type: string) => {
    switch (type) {
      case 'appl': return 'App Call'
      case 'pay': return 'Payment'
      case 'axfer': return 'ASA Transfer'
      case 'acfg': return 'ASA Config'
      case 'afrz': return 'ASA Freeze'
      case 'keyreg': return 'Key Reg'
      default: return type
    }
  }

  const getTxTypeIcon = (type: string) => {
    switch (type) {
      case 'appl': return <FileCode className="h-3.5 w-3.5" />
      case 'pay': return <Coins className="h-3.5 w-3.5" />
      case 'axfer': return <ArrowRightLeft className="h-3.5 w-3.5" />
      default: return <Zap className="h-3.5 w-3.5" />
    }
  }

  const getTxTypeBadge = (type: string) => {
    switch (type) {
      case 'appl': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
      case 'pay': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'axfer': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    }
  }

  const getOnCompletionLabel = (oc: string) => {
    switch (oc) {
      case 'noop': return 'NoOp'
      case 'optin': return 'OptIn'
      case 'closeout': return 'CloseOut'
      case 'clear': return 'ClearState'
      case 'update': return 'Update'
      case 'delete': return 'Delete'
      default: return oc
    }
  }

  const decodeAppArg = (arg: string) => {
    try {
      const decoded = atob(arg)
      // If it's printable ASCII, return it
      if (/^[\x20-\x7E]+$/.test(decoded)) return decoded
      return arg.slice(0, 8) + '…'
    } catch {
      return arg.slice(0, 8) + '…'
    }
  }

  const getContractTitle = (appId: number) => {
    const contract = contracts.find(c => c.appId === appId)
    return contract?.title || `App #${appId}`
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-16">
      {/* Hero Header */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-cyan-600/10 rounded-2xl blur-xl" />
        <div className="relative bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                  <Database className="h-6 w-6 text-indigo-400" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  On-Chain Explorer
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 animate-pulse">
                  LIVE
                </span>
              </div>
              <p className="text-zinc-400 text-sm max-w-xl">
                Full transaction ledger for all Citadel smart contracts on Algorand TestNet. 
                Every donation, ticket purchase, milestone release — all on-chain and verifiable.
              </p>
            </div>

            {/* Network Stats */}
            <div className="flex gap-3">
              <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-center min-w-[100px]">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Contracts</div>
                <div className="text-xl font-bold text-white">{contracts.length}</div>
              </div>
              <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-center min-w-[100px]">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Transactions</div>
                <div className="text-xl font-bold text-white">{filteredTxns.length}</div>
              </div>
              {networkStats.latestRound > 0 && (
                <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-center min-w-[120px]">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Latest Block</div>
                  <div className="text-xl font-bold text-indigo-400">#{networkStats.latestRound.toLocaleString()}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar — Contract List */}
        <div className={`${showContractPanel ? 'lg:w-72' : 'lg:w-12'} flex-shrink-0 transition-all duration-300`}>
          {/* Toggle button */}
          <button 
            onClick={() => setShowContractPanel(!showContractPanel)}
            className="lg:hidden mb-3 w-full py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
          >
            <Layers className="h-4 w-4" />
            {showContractPanel ? 'Hide Contracts' : 'Show Contracts'}
          </button>

          {showContractPanel && (
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-400" />
                  Smart Contracts
                </h3>
              </div>

              {/* All Contracts button */}
              <button
                onClick={() => handleSelectContract(null)}
                className={`w-full px-4 py-3 text-left text-sm hover:bg-zinc-800/60 transition-colors border-b border-zinc-800/50 flex items-center gap-3 ${
                  selectedContract === null ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''
                }`}
              >
                <Activity className={`h-4 w-4 ${selectedContract === null ? 'text-indigo-400' : 'text-zinc-500'}`} />
                <div>
                  <div className={`font-medium ${selectedContract === null ? 'text-indigo-300' : 'text-zinc-300'}`}>
                    All Contracts
                  </div>
                  <div className="text-xs text-zinc-500">{contracts.length} total</div>
                </div>
              </button>

              {/* Contract list */}
              <div className="max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
                {loading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-xs text-zinc-500">Loading contracts...</p>
                  </div>
                ) : contracts.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 text-sm">No contracts found</div>
                ) : (
                  contracts.map(c => (
                    <button
                      key={c.appId}
                      onClick={() => handleSelectContract(c.appId)}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-zinc-800/60 transition-colors border-b border-zinc-800/30 ${
                        selectedContract === c.appId ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className={`font-medium truncate ${selectedContract === c.appId ? 'text-indigo-300' : 'text-zinc-300'}`}>
                            {c.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              c.type === 'campaign' 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {c.type === 'campaign' ? '🏦 Fund' : '🎫 Event'}
                            </span>
                            <span className="text-xs text-zinc-600 font-mono">#{c.appId}</span>
                          </div>
                        </div>
                        <ExternalLink 
                          className="h-3.5 w-3.5 text-zinc-600 hover:text-indigo-400 flex-shrink-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`${LORA_BASE}/application/${c.appId}`, '_blank')
                          }}
                        />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right — Transaction Table */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-xl p-4 mb-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by Txn ID, address, app ID, or block..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                />
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-zinc-500" />
                {(['all', 'appl', 'pay', 'axfer'] as TxFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      filter === f
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-zinc-800/60 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    {f === 'all' ? 'All' : getTxTypeLabel(f)}
                  </button>
                ))}
              </div>

              {/* Refresh */}
              <button
                onClick={() => {
                  fetchTransactions(selectedContract)
                  fetchLatestRound()
                }}
                disabled={loadingTxns}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loadingTxns ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Active filter info */}
            <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
              <span>
                Showing {filteredTxns.length} transaction{filteredTxns.length !== 1 ? 's' : ''}
                {selectedContract ? ` for ${getContractTitle(selectedContract)} (#${selectedContract})` : ' across all contracts'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Transaction Table */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-xl overflow-hidden">
            {loadingTxns ? (
              <div className="p-12 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-zinc-400 text-sm">Fetching transactions from Algorand Indexer...</p>
              </div>
            ) : filteredTxns.length === 0 ? (
              <div className="p-12 text-center">
                <Database className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-zinc-400 mb-1">No Transactions Found</h3>
                <p className="text-sm text-zinc-500">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : selectedContract
                      ? 'This contract has no transactions yet'
                      : 'Select a contract or click "All Contracts" to load transactions'
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[140px_90px_100px_1fr_1fr_110px_90px_40px] gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-800/40 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1"><Hash className="h-3 w-3" /> Txn Hash</div>
                  <div className="flex items-center gap-1"><Layers className="h-3 w-3" /> Block</div>
                  <div>Type</div>
                  <div className="flex items-center gap-1"><Wallet className="h-3 w-3" /> From</div>
                  <div>To / App</div>
                  <div className="flex items-center gap-1"><Coins className="h-3 w-3" /> Amount</div>
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> Age</div>
                  <div></div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-zinc-800/50">
                  {filteredTxns.map((tx, idx) => {
                    const appId = tx['application-transaction']?.['application-id']
                    const receiver = tx['payment-transaction']?.receiver
                      || tx['asset-transfer-transaction']?.receiver
                    const amount = tx['payment-transaction']?.amount
                      || tx['asset-transfer-transaction']?.amount
                    const isAppCall = tx['tx-type'] === 'appl'
                    const onCompletion = tx['application-transaction']?.['on-completion']
                    const age = tx['round-time'] ? getTimeAgo(tx['round-time']) : '—'

                    return (
                      <div
                        key={tx.id || idx}
                        className="group hover:bg-zinc-800/40 transition-colors"
                      >
                        {/* Desktop row */}
                        <div className="hidden md:grid grid-cols-[140px_90px_100px_1fr_1fr_110px_90px_40px] gap-3 px-4 py-3 items-center text-sm">
                          {/* Txn ID */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <button
                              onClick={() => copyToClipboard(tx.id)}
                              className="text-indigo-400 hover:text-indigo-300 font-mono text-xs truncate"
                              title={tx.id}
                            >
                              {tx.id?.slice(0, 8)}...{tx.id?.slice(-4)}
                            </button>
                            {copiedId === tx.id ? (
                              <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                            ) : (
                              <Copy className="h-3 w-3 text-zinc-600 opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer" onClick={() => copyToClipboard(tx.id)} />
                            )}
                          </div>

                          {/* Block */}
                          <div className="font-mono text-xs text-zinc-400">
                            {tx['confirmed-round']?.toLocaleString() || '—'}
                          </div>

                          {/* Type Badge */}
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${getTxTypeBadge(tx['tx-type'])}`}>
                              {getTxTypeIcon(tx['tx-type'])}
                              {getTxTypeLabel(tx['tx-type'])}
                            </span>
                            {isAppCall && onCompletion && (
                              <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                                {getOnCompletionLabel(onCompletion)}
                                {tx['application-transaction']?.['application-args']?.[0] && (
                                  <span className="text-zinc-600 ml-1">
                                    → {decodeAppArg(tx['application-transaction']['application-args'][0])}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* From */}
                          <div className="min-w-0">
                            <button
                              onClick={() => copyToClipboard(tx.sender)}
                              className="font-mono text-xs text-zinc-300 hover:text-white truncate block"
                              title={tx.sender}
                            >
                              {formatAddr(tx.sender)}
                            </button>
                            {tx.sender === activeAddress && (
                              <span className="text-[10px] text-indigo-400 font-semibold">YOU</span>
                            )}
                          </div>

                          {/* To / App */}
                          <div className="min-w-0">
                            {isAppCall && appId ? (
                              <div>
                                <a
                                  href={`${LORA_BASE}/application/${appId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
                                >
                                  App #{appId}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                                <div className="text-[10px] text-zinc-500 truncate">
                                  {getContractTitle(appId)}
                                </div>
                              </div>
                            ) : receiver ? (
                              <button
                                onClick={() => copyToClipboard(receiver)}
                                className="font-mono text-xs text-zinc-300 hover:text-white truncate block"
                                title={receiver}
                              >
                                {formatAddr(receiver)}
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-600">—</span>
                            )}
                          </div>

                          {/* Amount */}
                          <div className="text-xs">
                            {amount && amount > 0 ? (
                              <span className="text-emerald-400 font-semibold">
                                {tx['tx-type'] === 'axfer'
                                  ? amount.toLocaleString() + ' ASA'
                                  : formatAlgo(amount) + ' ALGO'
                                }
                              </span>
                            ) : (
                              <span className="text-zinc-600">
                                {tx.fee ? `Fee: ${formatAlgo(tx.fee)}` : '—'}
                              </span>
                            )}
                          </div>

                          {/* Age */}
                          <div className="text-xs text-zinc-500" title={formatTime(tx['round-time'])}>
                            {age}
                          </div>

                          {/* External Link */}
                          <div>
                            <a
                              href={`${LORA_BASE}/transaction/${tx.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-600 hover:text-indigo-400 transition-colors"
                              title="View on Lora Explorer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>

                        {/* Mobile card */}
                        <div className="md:hidden px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${getTxTypeBadge(tx['tx-type'])}`}>
                                {getTxTypeIcon(tx['tx-type'])}
                                {getTxTypeLabel(tx['tx-type'])}
                              </span>
                              {isAppCall && appId && (
                                <span className="text-[11px] text-purple-400 font-mono">App #{appId}</span>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500">{age}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div>
                              <span className="text-zinc-500">Txn: </span>
                              <button onClick={() => copyToClipboard(tx.id)} className="text-indigo-400 font-mono">
                                {tx.id?.slice(0, 12)}...
                              </button>
                            </div>
                            {amount && amount > 0 && (
                              <span className="text-emerald-400 font-semibold">{formatAlgo(amount)} ALGO</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-[11px]">
                            <div>
                              <span className="text-zinc-500">From: </span>
                              <span className="text-zinc-300 font-mono">{formatAddr(tx.sender)}</span>
                              {tx.sender === activeAddress && (
                                <span className="text-indigo-400 font-semibold ml-1">YOU</span>
                              )}
                            </div>
                            <a
                              href={`${LORA_BASE}/transaction/${tx.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-500 hover:text-indigo-400 ml-auto"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination */}
                {selectedContract && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-800/20">
                    <button
                      onClick={handlePrevPage}
                      disabled={page === 1}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </button>
                    <span className="text-xs text-zinc-500">Page {page}</span>
                    <button
                      onClick={handleNextPage}
                      disabled={!nextToken}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom info bar */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Algorand TestNet
              </span>
              <span>Indexer: {indexerBase}</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={LORA_BASE}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                Open Lora Explorer <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://allo.info/testnet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
              >
                Allo.info <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Time Ago Helper ─────────────────────────────────────────────────────────

function getTimeAgo(unixTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - unixTimestamp
  if (diff < 0) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`
  return `${Math.floor(diff / 2592000)}mo ago`
}

export default ExplorerPage
