# CampusChain: Simple Campus Finance on Algorand

**A decentralized platform for campus fundraising, event ticketing, and financial governance powered by Algorand blockchain.**

CampusChain revolutionizes how campus communities manage finances, organize events, and collaborate across institutions. Built with fully decentralized smart contracts, every campaign and event exists as its own on-chain application - no central database, no intermediaries.

---

## ðŸŽ¯ Key Features

### 1. **Milestone-Based Fundraising** 
Create crowdfunding campaigns with goal-based fund release. Funds are locked in smart contracts and released ONLY when fundraising goals are met, ensuring accountability and trust.

- **Goal Tracking**: Set target amounts and deadlines
- **Milestone Unlocking**: Release funds in stages as milestones complete
- **Transparent Donations**: All contributions tracked on-chain
- **Real-time Updates**: Live progress tracking via blockchain state

### 2. **NFT Event Ticketing**
Blockchain-powered event tickets as NFTs with built-in verification and anti-scalping features.

- **NFT Minting**: Each ticket is a unique Algorand Standard Asset (ASA)
- **QR Code Verification**: Scan tickets at entry with built-in authenticity checks
- **Anti-Double-Entry**: Box storage prevents ticket reuse
- **Transferable**: Tickets can be traded on secondary markets
- **On-Chain Ownership**: Provable ticket ownership

### 3. **Federation & Cross-Campus DAO**
Multi-university governance system for collaborative initiatives and resource sharing.

- **University Network**: Connect multiple campuses in one ecosystem
- **Shared Treasuries**: Pool resources for inter-campus projects
- **Voting Rights**: Token-weighted governance proposals
- **Impact Metrics**: Track cross-campus collaboration

### 4. **Reputation System** (Concept UI)
Machine learning-driven reputation scoring based on on-chain activity.

- **Trust Scores**: Build reputation through successful campaigns
- **Predictive Analytics**: Success probability calculations
- **Tiered Benefits**: Unlock features based on reputation level
- **Historical Tracking**: Comprehensive activity dashboard

### 5. **NFT Evolution System** (Gamification)
PokÃ©mon-style leveling system where campus participation NFTs evolve over time.

- **XP Points**: Earn experience through platform activities
- **Tier Progression**: Bronze â†’ Silver â†’ Gold â†’ Platinum â†’ Diamond
- **Visual Evolution**: NFT artwork changes with levels
- **Achievement Badges**: Unlock special NFTs for milestones

---

## ðŸ—ï¸ Architecture

### Fully Decentralized Design
Unlike traditional platforms, CampusChain deploys **separate smart contract instances** for each campaign and event:

```
Create Campaign â†’ Deploy New Contract â†’ Unique App ID
Create Event â†’ Deploy New Contract â†’ Unique App ID
```

**Benefits:**
- âœ… No central point of failure
- âœ… Each creator owns their contract
- âœ… Permissionless participation
- âœ… Immutable transaction history
- âœ… Transparent fund management

### Smart Contracts (Python/PyTeal)

**Fundraiser Contract** (`smart_contracts/fundraiser/contract.py`)
- Goal-based fund locking
- Milestone release mechanism
- Contributor tracking
- Automatic refunds if goal not met

**Ticketing Contract** (`smart_contracts/ticketing/contract.py`)
- NFT ticket minting (ASA creation)
- Box storage for check-in status
- Entry verification logic
- Sales toggle functionality

**Bank Contract** (`smart_contracts/bank/contract.py`)
- Escrow deposits/withdrawals
- Transaction ledger
- Multi-user account system

---

## ðŸ› ï¸ Tech Stack

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS + DaisyUI
- Vite build system
- React Router v7

**Blockchain:**
- Algorand TestNet
- AlgoKit Utils for transaction building
- algosdk for cryptographic operations
- Multiple wallet support (Pera, Defly, Exodus, Daffi)

**Smart Contracts:**
- Python + AlgoPy framework
- ARC-4 compliant ABIs
- Box storage for state management
- Atomic transaction compositions

**Deployment:**
- Vercel hosting
- Public Algorand nodes (AlgoNode)
- Environment-based configuration

---

## ðŸš€ Quick Start

### Prerequisites
- Node.js 18+
- AlgoKit CLI (`npm install -g @algorandfoundation/algokit`)
- Algorand wallet (Pera recommended)
- TestNet ALGO (free from [dispenser](https://bank.testnet.algorand.network/))

### Installation

1. **Clone Repository**
```bash
git clone <your-repo-url>
cd Hackathon-QuickStart-template
```

2. **Install Dependencies**
```bash
# Boostrap entire workspace (contracts + frontend)
algokit project bootstrap all

# Or install frontend only
cd projects/frontend
npm install
```

3. **Environment Setup**
Create `projects/frontend/.env`:
```env
VITE_ENVIRONMENT=testnet
VITE_ALGOD_SERVER=https://testnet-api.algonode.cloud
VITE_ALGOD_PORT=
VITE_ALGOD_TOKEN=
VITE_ALGOD_NETWORK=testnet
VITE_INDEXER_SERVER=https://testnet-idx.algonode.cloud
VITE_INDEXER_PORT=
VITE_INDEXER_TOKEN=
```

4. **Run Development Server**
```bash
cd projects/frontend
npm run dev
```

Visit `http://localhost:5173`

### Building Smart Contracts

```bash
cd projects/contracts
algokit project run build
```

Compiled contracts output to `smart_contracts/artifacts/`

---

## ðŸ“– Usage Guide

### Creating a Fundraising Campaign

1. **Connect Wallet**: Click "Connect Wallet" (top-right) and select provider
2. **Navigate**: Go to "Fundraising (On-Chain)" page
3. **Click**: "Create New Campaign" button
4. **Fill Details**:
   - Campaign title and description
   - Goal amount (in ALGO)
   - Number of milestones
   - Deadline date
5. **Deploy**: Sign the deployment transaction (~0.3 ALGO fee)
6. **Success**: Campaign appears with unique App ID

### Donating to Campaigns

1. Browse active campaigns on Fundraising page
2. Click "View Details" on any campaign
3. Enter donation amount
4. Click "Donate" and sign transaction
5. View updated progress bar and contributor count

### Creating Event Tickets

1. Navigate to " Ticketing (On-Chain)" page
2. Click "Create New Event"
3. Fill event details:
   - Event name and description
   - Ticket price (in ALGO)
   - Max supply (number of tickets)
   - Event date and sales end date
4. Deploy contract and await confirmation
5. Event appears in list with App ID

### Buying Tickets

1. Browse events on Ticketing page
2. Click "Buy Ticket" on desired event
3. Confirm payment transaction (Step 1/3)
4. Approve opt-in for ticket NFT (Step 2/3)
5. Receive ticket automatically (Step 3/3)
6. View your tickets in "My Tickets" tab

### Verifying Tickets at Entry

1. Event organizers can scan QR codes shown on ticket holders' screens
2. Scanner verifies NFT ownership on-chain
3. Marks ticket as "checked-in" in box storage
4. Prevents double-entry attempts

---

## ðŸ”§ Development

### Project Structure
```
CampusChain/
  projects/
    contracts/                        # Smart contracts (Python)
      smart_contracts/
        fundraiser/                    # Fundraising contract
        ticketing/                     # Ticketing contract
        bank/                          # Banking contract
      pyproject.toml
    
    frontend/                          # React application
      src/
        pages/                         # Route components
        components/                    # Reusable UI components
        contracts/                     # Generated TypeScript clients
        utils/                         # Helper functions
      package.json
```

### Key Frontend Files

- `src/pages/FundraisingPageDecentralized.tsx` - Campaign management
- `src/pages/TicketingPageDecentralized.tsx` - Event ticketing
- `src/contracts/FundraiserClient.ts` - Generated contract client
- `src/contracts/TicketingClient.ts` - Generated contract client
- `src/utils/blockchainData.ts` - State query helpers
- `src/utils/contractRegistry.ts` - App ID tracking

### Testing

```bash
# Run frontend tests
cd projects/frontend
npm run test

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint
```

---

## ðŸŒ Supported Wallets

- **Pera Wallet** - Mobile and browser extension
- **Defly Wallet** - Mobile wallet with DeFi features
- **Exodus Wallet** - Multi-chain desktop/mobile
- **Daffi Wallet** - Algorand-focused mobile wallet

All wallets support:
- Transaction signing
- Asset opt-ins
- Multi-transaction grouping
- WalletConnect v2

---

## ðŸ“Š Smart Contract Interactions

### Box Storage
Contracts use box storage for scalable state management:
- **Campaign Donations**: Track individual contributors
- **Ticket Check-ins**: Prevent double-entry
- **Key Format**: Uses decoded 32-byte addresses

### Atomic Transactions
Multi-step operations grouped atomically:
- Payment + Contract Call (donations)
- NFT Mint + Opt-in + Transfer (ticket purchase)
- Ensures all-or-nothing execution

### Resource Management
- `populateAppCallResources: false` - Manual resource specification
- `boxReferences` - Explicit box access declarations
- `assetReferences` - Foreign asset array for NFTs
- `coverAppCallInnerTransactionFees: true` - Fee coverage

---

## ðŸ› Troubleshooting

### Common Issues

**"Transaction pool error" / Box Reference Invalid**
- Ensure box references use decoded address bytes:
  ```typescript
  boxReferences: [{
    appId: BigInt(appId),
    name: algosdk.decodeAddress(address).publicKey
  }]
  ```

**"Asset not found" / Opt-in Required**
- User must opt-in to ASA before receiving:
  ```typescript
  await algorand.send.assetOptIn({ sender, assetId })
  ```

**"Insufficient ALGO Balance"**
- Minimum balance requirement increases with:
  - Opted-in assets (+0.1 ALGO each)
  - Created contracts (+0.1 ALGO base + storage)
  - Box storage (dynamic based on size)

**Environment Variables Not Loading**
- Restart dev server after editing `.env`
- Ensure variables prefixed with `VITE_`
- Check browser console for config errors

---

## ðŸ“„ License

This project is open source. Contributions welcome!

---

## ðŸ¤ Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## ðŸ“ž Support

For questions or issues:
- Open a GitHub issue
- Check Algorand Developer Portal: https://developer.algorand.org/
- Join Algorand Discord: https://discord.gg/algorand

---

**Built with â¤ï¸ on Algorand blockchain**


