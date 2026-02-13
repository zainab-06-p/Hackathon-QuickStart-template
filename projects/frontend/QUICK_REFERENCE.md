# Quick Reference: Wallet Visibility

## 🎯 When to Use Which Function

```typescript
import { ContractRegistry } from './utils/contractRegistry'

// ✅ PUBLIC MARKETPLACE PAGES (everyone sees everything)
const campaigns = await ContractRegistry.getFundraisers()       // All campaigns
const events = await ContractRegistry.getTicketing()            // All events
const campaigns = await ContractRegistry.getAllFundraisers()    // Explicit: all
const events = await ContractRegistry.getAllEvents()            // Explicit: all

// 👤 CREATOR DASHBOARD PAGES (show only mine)
const myCampaigns = await ContractRegistry.getMyFundraisers(myAddress)
const myEvents = await ContractRegistry.getMyEvents(myAddress)
```

## 📍 Current Page Implementation

| File | Shows | Method Used | Correct? |
|------|-------|-------------|----------|
| `FundraisingPageDecentralized.tsx` | ALL campaigns | `getFundraisers()` | ✅ Yes |
| `TicketingPageDecentralized.tsx` | ALL events | `getTicketing()` | ✅ Yes |
| `FundraisingPage.tsx` | Mock data | localStorage | ✅ Yes (temp) |
| `TicketingPage.tsx` | Mock data | localStorage | ✅ Yes (temp) |

## ⚡ Code Snippets

### Public Page (Show Everything)
```typescript
const loadCampaigns = async () => {
  // ✅ No wallet address - shows ALL campaigns from ALL creators
  const registry = await ContractRegistry.getFundraisers()
  
  const campaignStates = []
  for (const metadata of registry) {
    const state = await getCampaignState(algorand, metadata)
    if (state) campaignStates.push(state)
  }
  
  setCampaigns(campaignStates)  // Everyone sees the same list
}

// ✅ No wallet dependency - loads once for all users
useEffect(() => {
  loadCampaigns()
  const interval = setInterval(loadCampaigns, 10000)
  return () => clearInterval(interval)
}, [])  // No activeAddress here!
```

### Creator Dashboard (Show Only Mine)
```typescript
const loadMyCampaigns = async () => {
  if (!activeAddress) return
  
  // ✅ Filter by creator - shows only campaigns from this wallet
  const registry = await ContractRegistry.getMyFundraisers(activeAddress)
  
  const myCampaignStates = []
  for (const metadata of registry) {
    const state = await getCampaignState(algorand, metadata)
    if (state) myCampaignStates.push(state)
  }
  
  setMyCampaigns(myCampaignStates)  // Only my campaigns
}

// ✅ Depends on wallet - reloads when wallet changes
useEffect(() => {
  loadMyCampaigns()
}, [activeAddress])
```

## 🚫 Common Mistakes

### ❌ DON'T
```typescript
// WRONG: Filtering public page by wallet
const campaigns = await ContractRegistry.getMyFundraisers(activeAddress)

// WRONG: Adding wallet dependency to public data
useEffect(() => {
  loadCampaigns()
}, [activeAddress])  // ❌ Bad for public pages

// WRONG: Manual filtering after fetching all
const campaigns = await ContractRegistry.getAllFundraisers()
const filtered = campaigns.filter(c => c.creator === myAddress)  // Why?
```

### ✅ DO
```typescript
// CORRECT: Public page shows all
const campaigns = await ContractRegistry.getFundraisers()

// CORRECT: No wallet dependency for public data
useEffect(() => {
  loadCampaigns()
}, [])  // ✅ Good!

// CORRECT: Creator dashboard filters appropriately
const myCampaigns = await ContractRegistry.getMyFundraisers(activeAddress)
```

## 🔍 Decision Tree

```
Need to show events/campaigns?
│
├─ Public marketplace page?
│  ├─ YES → getFundraisers() or getTicketing()
│  └─ NO → Go to next question
│
└─ Creator dashboard page?
   ├─ YES → getMyFundraisers(address) or getMyEvents(address)
   └─ NO → Default to showing all (public)
```

## 📊 Method Comparison

| Method | Returns | Use Case | Filter by Wallet? |
|--------|---------|----------|-------------------|
| `getFundraisers()` | All campaigns | Public marketplace | ❌ No |
| `getTicketing()` | All events | Public marketplace | ❌ No |
| `getAllFundraisers()` | All campaigns | Explicit public | ❌ No |
| `getAllEvents()` | All events | Explicit public | ❌ No |
| `getMyFundraisers(addr)` | My campaigns | Creator dashboard | ✅ Yes |
| `getMyEvents(addr)` | My events | Creator dashboard | ✅ Yes |

## 🧪 Quick Test

To verify correct behavior:

1. Create event with Wallet A
2. Log in with Wallet B
3. Open TicketingPageDecentralized
4. ✅ Should see event from Wallet A
5. ✅ Should be able to buy ticket

If you don't see the event → Implementation is wrong!

## 📖 Full Documentation

See [WALLET_VISIBILITY_GUIDE.md](./WALLET_VISIBILITY_GUIDE.md) for complete details.

---

**Remember**: Default = Show All (marketplace model)
