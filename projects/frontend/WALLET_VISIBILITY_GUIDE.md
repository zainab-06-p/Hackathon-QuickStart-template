# Wallet Address & Data Visibility Guide

## Overview
This guide explains how wallet addresses work in CampusChain and ensures that all users can see events and campaigns created by any creator, regardless of wallet address.

## 🎯 Core Principle: Public Marketplace Model

### ✅ CORRECT BEHAVIOR (Current Implementation)
**All users see ALL events and campaigns, regardless of who created them.**

- **Creator A** (Wallet: `ALGO123...`) creates an event
- **Student B** (Wallet: `ALGO456...`) **CAN** see and buy tickets for that event
- **Student C** (Wallet: `ALGO789...`) **CAN ALSO** see and buy tickets for that event
- **Everyone sees the same marketplace** of all events and campaigns

### ❌ WHAT WE AVOID
**Filtering by connected wallet address would break the platform:**
- Creator with Wallet A creates an event
- Only Wallet A can see it
- Students with other wallets CANNOT see it
- ⚠️ This would make the platform useless!

## 📁 File Structure & Responsibilities

### Core Blockchain Files

#### `src/utils/contractRegistry.ts`
**Purpose**: Discovers all smart contracts on the Algorand blockchain

**Key Methods**:
```typescript
// ✅ PUBLIC MARKETPLACE (show everything)
ContractRegistry.getFundraisers()         // All campaigns from all creators
ContractRegistry.getTicketing()           // All events from all creators
ContractRegistry.getAllFundraisers()      // Explicit: all campaigns (same as above)
ContractRegistry.getAllEvents()           // Explicit: all events (same as above)

// 👤 CREATOR DASHBOARD (show only mine)
ContractRegistry.getMyFundraisers(address)  // Only my campaigns
ContractRegistry.getMyEvents(address)       // Only my events
```

**Important Notes**:
- Default behavior: Shows ALL contracts from ALL creators
- The optional `creatorAddress` parameter is used for optimization, NOT filtering
- Even when passing creatorAddress, the method scans ALL contracts
- Use the explicit `getAll*` or `getMy*` methods for clarity

#### `src/utils/blockchainData.ts`
**Purpose**: Fetches state from individual smart contracts

**Key Methods**:
```typescript
getCampaignState(algorand, metadata)  // Get campaign data from contract
getEventState(algorand, metadata)     // Get event data from contract
getCampaignContributors(algorand, appId)
getTicketPurchases(algorand, appId)
```

**Important Notes**:
- These methods fetch data from specific contracts
- They don't filter by wallet - they query the blockchain directly
- Anyone can query any contract's state

### Page Files

#### ✅ Public Marketplace Pages

##### `src/pages/FundraisingPageDecentralized.tsx`
- **Shows**: ALL campaigns from ALL creators
- **Access**: Public - no wallet required to view
- **Data Source**: `ContractRegistry.getFundraisers()` (no creatorAddress)
- **Users See**: Same campaign list regardless of wallet

##### `src/pages/TicketingPageDecentralized.tsx`
- **Shows**: ALL events from ALL creators
- **Access**: Public - no wallet required to view
- **Data Source**: `ContractRegistry.getTicketing()` (no creatorAddress)
- **Users See**: Same event list regardless of wallet

##### `src/pages/FundraisingPage.tsx` (Mock Data Version)
- **Shows**: Mock campaign data (not blockchain)
- **Purpose**: UI development and testing
- **Note**: Will be replaced by decentralized version

##### `src/pages/TicketingPage.tsx` (Mock Data Version)
- **Shows**: Mock event data (not blockchain)
- **Purpose**: UI development and testing
- **Note**: Will be replaced by decentralized version

#### 👤 Creator Dashboard Pages (To Be Created)

These pages would filter by creator wallet:

```typescript
// Example: My Events Page (creator dashboard)
import { ContractRegistry } from '../utils/contractRegistry'

function MyEventsPage() {
  const { activeAddress } = useWallet()
  const [myEvents, setMyEvents] = useState([])
  
  useEffect(() => {
    if (activeAddress) {
      // ✅ CORRECT: Filter by creator only on dashboard
      const events = await ContractRegistry.getMyEvents(activeAddress)
      setMyEvents(events)
    }
  }, [activeAddress])
  
  // Show only events created by connected wallet
}
```

## 🔄 Data Flow Diagrams

### Public Marketplace Flow
```
User A (Wallet: ALGO123...) logs in
    ↓
Visits FundraisingPageDecentralized
    ↓
Page calls ContractRegistry.getFundraisers() [no address]
    ↓
Registry scans ALL applications on blockchain
    ↓
Returns: [Campaign by ALGO456, Campaign by ALGO789, Campaign by ALGO111]
    ↓
User A sees ALL campaigns from ALL creators
    ↓
User A can donate to ANY campaign
```

### Creator Dashboard Flow (for future implementation)
```
User A (Wallet: ALGO123...) logs in
    ↓
Visits MyEventsPage (dashboard)
    ↓
Page calls ContractRegistry.getMyEvents(ALGO123...)
    ↓
Registry gets all events, filters by creator
    ↓
Returns: [Only events where creator === ALGO123...]
    ↓
User A sees ONLY their own events
    ↓
User A can manage their events
```

## 🧪 Testing Checklist

Before deploying, verify these scenarios:

### Scenario 1: Multiple Creators
- [ ] Create campaign with Wallet A
- [ ] Create campaign with Wallet B
- [ ] Log in with Wallet C (student)
- [ ] Open FundraisingPageDecentralized
- [ ] ✅ Verify: See BOTH campaigns from A and B
- [ ] ✅ Verify: Can donate to EITHER campaign

### Scenario 2: Cross-Device Discovery
- [ ] Create event with Wallet A on Device 1
- [ ] Open app with Wallet B on Device 2
- [ ] Wait for indexer sync (~10 seconds)
- [ ] ✅ Verify: Device 2 sees event from Device 1
- [ ] ✅ Verify: Can buy tickets for event from Device 1

### Scenario 3: New User Experience
- [ ] Create brand new wallet (never used)
- [ ] Connect to app
- [ ] Open events and campaigns pages
- [ ] ✅ Verify: See ALL existing events/campaigns
- [ ] ✅ Verify: NOT an empty page
- [ ] ✅ Verify: Can interact with any item

### Scenario 4: Live Updates
- [ ] Open FundraisingPageDecentralized with Wallet A
- [ ] Another user creates campaign with Wallet B
- [ ] Wait for polling interval (10 seconds)
- [ ] ✅ Verify: New campaign appears automatically
- [ ] ✅ Verify: No page refresh required

## 🚨 Common Mistakes to Avoid

### ❌ Mistake 1: Filtering Public Pages by Wallet
```typescript
// WRONG - Don't do this on public pages!
const { activeAddress } = useWallet()
const campaigns = await ContractRegistry.getMyFundraisers(activeAddress)
// This would only show campaigns created by current user!
```

### ❌ Mistake 2: Adding Wallet Dependencies
```typescript
// WRONG - Don't depend on wallet for public data!
useEffect(() => {
  loadCampaigns()
}, [activeAddress])  // ❌ Bad! Changes when wallet changes
```

### ❌ Mistake 3: Manual Filtering
```typescript
// WRONG - Why would you filter after fetching?
const allCampaigns = await ContractRegistry.getAllFundraisers()
const filtered = allCampaigns.filter(c => c.creator === myWallet)
// This defeats the purpose on public pages!
```

### ✅ Correct Implementations
```typescript
// CORRECT - Public marketplace
const campaigns = await ContractRegistry.getFundraisers()
// Shows ALL campaigns from ALL creators

// CORRECT - No wallet dependency for public data
useEffect(() => {
  loadCampaigns()
}, [])  // ✅ Good! Loads once, shows all campaigns

// CORRECT - Creator dashboard only
if (activeAddress) {
  const myCampaigns = await ContractRegistry.getMyFundraisers(activeAddress)
  // Only on dashboard pages!
}
```

## 📖 Code Examples

### Example 1: Public Events Page (Current)
```typescript
// src/pages/TicketingPageDecentralized.tsx

const loadEvents = async (forceRefresh = false) => {
  try {
    // ✅ CORRECT: No wallet address passed
    const registry = await ContractRegistry.getTicketing(forceRefresh)
    
    const eventStates: EventState[] = []
    for (const metadata of registry) {
      const state = await getEventState(algorand, metadata)
      if (state) {
        eventStates.push(state)
      }
    }
    
    setEvents(eventStates)  // All events from all creators
  } catch (error) {
    console.error('Error loading events:', error)
  }
}

// ✅ CORRECT: No wallet dependency
useEffect(() => {
  loadEvents()
  const interval = setInterval(() => loadEvents(), 10000)
  return () => clearInterval(interval)
}, [])  // Everyone sees the same events
```

### Example 2: Creator Dashboard (Future)
```typescript
// Future: src/pages/MyEventsPage.tsx

const loadMyEvents = async () => {
  if (!activeAddress) return
  
  try {
    // ✅ CORRECT: Filter by creator on dashboard
    const registry = await ContractRegistry.getMyEvents(activeAddress)
    
    const myEventStates: EventState[] = []
    for (const metadata of registry) {
      const state = await getEventState(algorand, metadata)
      if (state) {
        myEventStates.push(state)
      }
    }
    
    setMyEvents(myEventStates)  // Only my events
  } catch (error) {
    console.error('Error loading my events:', error)
  }
}

// ✅ CORRECT: Depends on wallet for creator-specific page
useEffect(() => {
  loadMyEvents()
}, [activeAddress])  // Reload when wallet changes
```

## 🔍 How ContractRegistry Works

### Discovery Process

1. **Local Storage** (Immediate)
   - Contracts created on this device are stored locally
   - Provides instant visibility before blockchain sync

2. **Blockchain Indexer** (5-second cache)
   - Queries Algorand Indexer for ALL applications
   - Scans up to 5000 recent applications
   - Identifies contracts by global state keys:
     - Fundraiser: `goal_amount`, `raised_amount`, `milestone_count`
     - Ticketing: `ticket_price`, `max_supply`, `sold_count`

3. **Merge & Deduplicate**
   - Combines local + indexer results
   - Removes duplicates by app ID
   - Returns complete list of all contracts

### When creatorAddress is Passed (Optional)

Even when passing a `creatorAddress`:

1. **Optimization Query** (Strategy 1)
   - First queries contracts by creator address
   - Faster for creators with many contracts

2. **Complete Scan** (Strategy 2)
   - STILL scans ALL applications
   - Ensures cross-creator visibility
   - Prevents missing contracts

3. **Result**
   - Returns ALL contracts, not just creator's
   - The parameter is an optimization, not a filter
   - Use `getMyFundraisers()` or `getMyEvents()` for actual filtering

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│         Algorand Blockchain (TestNet)                   │
├─────────────────────────────────────────────────────────┤
│  Smart Contract #1: Fundraiser                          │
│    Creator: ALGO123ABC...                               │
│    Goal: 50 ALGO, Raised: 30 ALGO                      │
├─────────────────────────────────────────────────────────┤
│  Smart Contract #2: Ticketing                           │
│    Creator: ALGO456DEF...                               │
│    Event: Tech Fest, Price: 2 ALGO                     │
├─────────────────────────────────────────────────────────┤
│  Smart Contract #3: Fundraiser                          │
│    Creator: ALGO789GHI...                               │
│    Goal: 100 ALGO, Raised: 75 ALGO                     │
└─────────────────────────────────────────────────────────┘
                          ↓
                          ↓ (ContractRegistry scans ALL)
                          ↓
┌─────────────────────────────────────────────────────────┐
│        ContractRegistry.getTicketing()                   │
│        (no creatorAddress parameter)                     │
└─────────────────────────────────────────────────────────┘
                          ↓
                          ↓ (Returns ALL events)
                          ↓
┌─────────────────────────────────────────────────────────┐
│      TicketingPageDecentralized.tsx                      │
│      Shows: [Event #2 + any other events]              │
└─────────────────────────────────────────────────────────┘
                          ↓
                          ↓ (Visible to ALL users)
                          ↓
┌──────────────┬──────────────┬──────────────────────────┐
│  Student A   │  Student B   │  Creator (ALGO456DEF...) │
│ ALGO111...   │ ALGO222...   │ Sees same events         │
│ Sees all     │ Sees all     │ as everyone else         │
│ events       │ events       │                           │
└──────────────┴──────────────┴──────────────────────────┘
```

## 🚀 Implementation Status

### ✅ Completed
- [x] ContractRegistry discovers ALL contracts
- [x] FundraisingPageDecentralized shows ALL campaigns
- [x] TicketingPageDecentralized shows ALL events
- [x] Added explicit `getAll*` and `getMy*` methods
- [x] Comprehensive documentation
- [x] Clear comments in code
- [x] No wallet-based filtering on public pages

### 🔜 Future Enhancements
- [ ] Create MyEventsPage (creator dashboard)
- [ ] Create MyCampaignsPage (creator dashboard)
- [ ] Add "Created by" labels on event/campaign cards
- [ ] Add creator profile pages
- [ ] Add analytics for creators

## 📞 Questions?

**Q: Why can't I see events I just created?**  
A: Wait 5-10 seconds for blockchain indexer sync, or click the refresh button.

**Q: I'm a creator. How do I see only my events?**  
A: Use the creator dashboard pages (to be implemented) which use `getMyEvents(address)`.

**Q: Can I create a "Trending Events" page?**  
A: Yes! Use `getAllEvents()` and sort by `soldCount` or other metrics.

**Q: Why does ContractRegistry have a creatorAddress parameter if it still scans all contracts?**  
A: It's an optimization for creators with many contracts. It queries by creator first, then scans all to ensure completeness.

---

**Last Updated**: February 13, 2026  
**Status**: ✅ Correctly Implemented  
**Version**: 1.0
