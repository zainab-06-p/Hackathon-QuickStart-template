# CampusChain — Future Roadmap

## Quick Navigation

| Document | What It Covers |
|---|---|
| [01_FUND_TRANSPARENCY_ESCROW.md](./01_FUND_TRANSPARENCY_ESCROW.md) | Quotation-based escrow, AI verification, donor voting, post-spend audit |
| [02_REVENUE_MODEL.md](./02_REVENUE_MODEL.md) | DeFi yield on escrow, premium features, NFT royalties, sponsorships |
| [03_FUTURE_ENHANCEMENTS.md](./03_FUTURE_ENHANCEMENTS.md) | Savings Pools, Campus Marketplace, Study Group Staking, Expense Splitter, DAO, Scholarships |

---

## Current State (What's Built)

| Feature | Status | Smart Contract | Frontend |
|---|---|---|---|
| Milestone-based Fundraising (3-of-3 multisig) | **LIVE** | `fundraiser/contract.py` | `FundraisingPageDecentralized.tsx` |
| NFT Event Ticketing (QR verify, multi-organizer) | **LIVE** | `ticketing/contract.py` | `TicketingPageDecentralized.tsx` |
| Bank (Escrow deposits/withdrawals) | **LIVE** | `bank/contract.py` | `Bank.tsx` |
| On-Chain Registry (cross-device discovery) | **LIVE** | `registry/contract.py` | `contractRegistry.ts` |
| Firebase Real-Time Sync | **Code Ready** | N/A | `firebase.ts` |
| Federation (Cross-Campus) | **Demo UI** | N/A | `FederationPage.tsx` |
| NFT Evolution (Gamification) | **Demo UI** | N/A | `NFTEvolutionPage.tsx` |
| Reputation DAO | **Demo UI** | N/A | `ReputationDAOPage.tsx` |
| DeFi Yield Tracker | **Simulated** | N/A | `YieldTracker.tsx` |

---

## Roadmap — Implementation Order

### Phase 1: Hackathon Priority (Next 7 Days)

**Goal:** Win the hackathon with these differentiators.

| # | Feature | Effort | Impact |
|---|---|---|---|
| 1 | **Fund Transparency Escrow** — quotation uploads, donor voting, on-chain audit trail | 6 days | Directly answers "how does donor know funds are used correctly?" |
| 2 | **Revenue Model Demo** — show DeFi yield calculation on escrowed funds | 1 day | Answers "how does platform earn without fees?" |

**Hackathon Talking Points:**
- "100% of donations reach the campaign — zero platform fees"
- "Donors vote on every withdrawal with AI-verified quotations"
- "Every rupee tracked: quotation → approval → spending → receipt — all on Algorand"
- "Platform earns from DeFi yield on idle escrow, not from student pockets"

### Phase 2: Post-Hackathon MVP (Month 1-2)

| # | Feature | Effort |
|---|---|---|
| 3 | **Savings Pools (Chit Fund)** — group savings with rotation payouts | 4 days |
| 4 | **Expense Splitter** — group bill splitting with auto-settlement | 3 days |
| 5 | **Real DAO governance** — convert demo to functional on-chain voting | 4 days |

### Phase 3: Campus Ecosystem (Month 3-4)

| # | Feature | Effort |
|---|---|---|
| 6 | **Campus Marketplace** — buy/sell with escrow + dispute resolution | 5 days |
| 7 | **Study Group Staking** — attendance accountability with financial incentives | 3 days |
| 8 | **Scholarship Tracker** — on-chain scholarship disbursement | 5 days |

### Phase 4: Scale & Polish (Month 5+)

| # | Feature | Effort |
|---|---|---|
| 9 | **Real NFT Evolution** — connect XP from all activities to on-chain NFTs | 3 days |
| 10 | **Cross-Campus Federation** — multi-college registry and shared governance | 5 days |
| 11 | **Mobile App** — React Native or PWA version | 2 weeks |
| 12 | **MainNet Deployment** — move from TestNet to production | 1 week |

---

## Architecture After All Features

```
┌───────────────────────────────────────────────────────────┐
│                    CAMPUSCHAIN PLATFORM                     │
├───────────┬───────────┬───────────┬───────────┬───────────┤
│ Fundraise │ Ticketing │ Savings   │ Market-   │ Study     │
│ + Escrow  │ + NFT     │ Pools     │ place     │ Groups    │
│ + AI      │ + QR      │ + ROSCA   │ + Escrow  │ + Stake   │
│ + Voting  │ + Resale  │ + Default │ + Dispute │ + Attend  │
├───────────┴───────────┴───────────┴───────────┴───────────┤
│                 SHARED INFRASTRUCTURE                      │
├───────────┬───────────┬───────────┬───────────┬───────────┤
│ Registry  │ DeFi      │ Reputation│ DAO       │ Expense   │
│ (App IDs) │ Yield     │ (XP/NFT)  │ Governance│ Splitter  │
├───────────┴───────────┴───────────┴───────────┴───────────┤
│                    DATA LAYERS                             │
├───────────────────┬───────────────────┬───────────────────┤
│ Algorand          │ Firebase          │ IPFS              │
│ (Transactions,    │ (Real-time sync,  │ (Quotations,      │
│  State, Escrow)   │  Discovery)       │  Receipts, Images)│
├───────────────────┴───────────────────┴───────────────────┤
│                    WALLET LAYER                            │
├───────────┬───────────┬───────────┬───────────────────────┤
│ Pera      │ Defly     │ Exodus    │ Lute                  │
└───────────┴───────────┴───────────┴───────────────────────┘
```

---

## Technical Decisions Summary

| Decision | Choice | Reason |
|---|---|---|
| Smart contract state | **Box Storage** | Global state limited to 64 keys; boxes scale unlimited |
| Image storage | **IPFS (Pinata)** | Content-addressed, tamper-proof, blockchain-compatible |
| AI verification | **Gemini Vision API** | Free tier, good at document analysis |
| Real-time sync | **Firebase RTDB** | Already integrated, WebSocket-based, free tier |
| Frontend state | **React useState + Firebase listeners** | Simple, no Redux overhead needed |
| Revenue model | **DeFi yield on escrow** | Zero fees to users, aligned incentives |
| Dispute resolution | **DAO-style voting** | Decentralized, no central authority needed |

---

## Hackathon Problem Statement Alignment

**Track 1: Future of Finance** asks for:

| Requirement | CampusChain's Answer |
|---|---|
| "Send and receive payments" | **Bank contract** — deposit/withdraw ALGO |
| "Split expenses" | **Expense Splitter** — auto-settlement on-chain |
| "Save funds" | **Savings Pools** — group savings with rotation payouts |
| "Raise money" | **Fundraising with Escrow** — milestone + quotation + voting |
| "Manage event access" | **NFT Ticketing** — mint, buy, QR verify, anti-double-entry |
| "Transparency" | **On-chain audit trail** — every action logged permanently |
| "No unnecessary fees" | **DeFi yield model** — 100% of funds reach recipients |
| "Low transaction complexity" | **Atomic transactions** — multi-step ops in single sign |
| "Clear user experience" | **React + Tailwind + DaisyUI** — clean, responsive UI |
| "Blockchain wallets & tokens" | **Multi-wallet support** — Pera, Defly, Exodus, Lute |
| "Smart contracts" | **5 production contracts** — Fundraiser, Ticketing, Bank, Registry, Counter |
