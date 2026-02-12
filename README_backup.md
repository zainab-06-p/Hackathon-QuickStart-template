# CampusChain: Simple Campus Finance on Algorand

A fully decentralized blockchain platform for campus communities to manage fundraising campaigns, event ticketing, and financial governance on the Algorand network.

## Overview

CampusChain transforms campus finance by moving it entirely on-chain with Algorand smart contracts. Each fundraising campaign and event exists as its own deployed contract - completely decentralized, transparent, and trustless.

**Live on Algorand TestNet** ðŸŽ‰


## âœ¨ Features

### 1. Milestone-Based Fundraising
- Deploy individual smart contracts per campaign
- Goal-based fund locking (released only when goal met)
- Transparent donation tracking on-chain
- Multi-milestone fund releases for accountability
- Real-time progress monitoring

### 2. NFT Event Ticketing
- Mint tickets as Algorand NFTs (ASAs)
- QR code verification at event entry
- Anti-double-entry with box storage
- Organizer controls (toggle sales, view stats)
- Transparent ticket ownership

### 3. Federation & DAO
- Multi-university governance system
- Cross-campus collaboration platform
- Shared treasuries and voting
- Impact tracking dashboard

### 4. Additional Features
- **Reputation System**: Track on-chain activity and build trust scores
- **NFT Evolution**: Gamified level-up system for campus engagement NFTs
- **Yield Tracker**: Visualize DeFi yield opportunities 
- **Transaction History**: Complete on-chain activity log
- **Wallet Integration**: Support for Pera, Defly, Exodus, Daffi wallets

---

## 1) Project Setup

### Prerequisites

- **Node.js 18+** and npm - [Download](https://nodejs.org/)
- **AlgoKit CLI** - Install with `npm install -g @algorandfoundation/algokit`
- **Algorand Wallet** - Download [Pera Wallet](https://perawallet.app/) for mobile or browser extension
- **TestNet ALGO** - Get free test tokens from [TestNet Dispenser](https://bank.testnet.algorand.network/)

### Installation Steps

1. **Clone the Repository**
```bash
git clone <your-repo-url>
cd Hackathon-QuickStart-template
```

2. **Bootstrap the Workspace**
```bash
algokit project bootstrap all
```
This installs all dependencies for both frontend and smart contracts.

3. **Configure Environment Variables**

Create `projects/frontend/.env`:
```env
# Algorand TestNet Configuration
VITE_ENVIRONMENT=testnet
VITE_ALGOD_SERVER=https://testnet-api.algonode.cloud
VITE_ALGOD_PORT=
VITE_ALGOD_TOKEN=
VITE_ALGOD_NETWORK=testnet

# Indexer for queries
VITE_INDEXER_SERVER=https://testnet-idx.algonode.cloud
VITE_INDEXER_PORT=
VITE_INDEXER_TOKEN=
```

4. **Build Smart Contracts** (Optional)
```bash
algokit project run build
```

5. **Start Development Server**

```bash
cd projects/frontend
npm install
npm run dev
```

Optional: alternative starter to compare or borrow patterns from:

```bash
git clone https://github.com/Ganainmtech/Algorand-dApp-Quick-Start-Template-TypeScript.git
```
