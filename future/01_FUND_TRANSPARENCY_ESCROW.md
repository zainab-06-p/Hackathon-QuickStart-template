# FEATURE 1: Fund Transparency & Quotation-Based Escrow

## The Problem

Donors give money to campus fundraising campaigns but have **zero visibility** into how that money is actually spent. Current platforms (GoFundMe, Ketto, Milaap) all have the same issue:
- Fundraiser receives the money → donors hope it's spent correctly
- No mechanism to verify spending
- No way for donors to object if funds are misused
- Hidden platform fees reduce the actual amount raised

**CampusChain already solves the "where is my money" problem** (funds are locked in smart contracts, milestone-based release). But we need to go further — donors should be able to **see and approve exactly what the money is buying** before it's released.

---

## The Solution: Quotation-Based Escrow with Donor Voting

Instead of just releasing funds when a milestone is "completed", we add a **quotation verification step**:

1. Fundraiser says "I need 50 ALGO for sound equipment"
2. Fundraiser uploads a **vendor quotation** (invoice/bill) proving the cost
3. AI verifies the quotation is legitimate
4. Donors **vote** on whether to approve the withdrawal
5. Only after approval → funds are released
6. After spending, fundraiser uploads the **actual receipt** for proof

This creates a **closed-loop accountability system** — every rupee/ALGO is tracked from donation → quotation → approval → spending → receipt.

---

## Complete Pipeline Flow

```
CAMPAIGN CREATION
    │
    ▼
Fundraiser creates campaign with milestones
    │  (each milestone has: name, description, target amount)
    ▼
DONATION PHASE
    │
    ▼
Donors contribute ALGO → funds locked in smart contract escrow
    │
    ▼
WITHDRAWAL REQUEST PHASE (the core addition)
    │
    ▼
Fundraiser submits a Withdrawal Request:
    ├── amount_requested (must be ≤ milestone amount)
    ├── purpose (text description — "need to book venue hall")
    ├── quotation_hash (IPFS hash of uploaded quotation/invoice image)
    │
    ▼
AI VERIFICATION (automatic, <5 seconds)
    │
    ├── AI Receipt Verifier analyzes the quotation image
    ├── Checks: tampering detection, amount extraction, vendor validation
    ├── Returns confidence_score (0-100)
    │
    ├── IF confidence ≥ 90%:
    │   └── Status → "ai_approved" → displayed with ✅ AI-Verified badge
    │       (still needs donor vote but fast-tracked with green indicator)
    │
    └── IF confidence < 90%:
        └── Status → "pending_vote" → displayed with ⚠️ Needs Review badge
            (requires extra donor scrutiny)
    │
    ▼
DONOR VOTING PHASE
    │
    ├── All donors are notified (via Firebase push + on-chain event)
    ├── Donors review: quotation image, AI confidence score, purpose, amount
    ├── Donors vote: APPROVE or REJECT
    │   └── Vote weight = proportional to donation amount
    │       (donated 50 ALGO out of 500 total = 10% voting power)
    ├── Voting window: 48 hours (configurable by campaign creator)
    │
    ├── IF >50% weighted approval → Status: "approved" → funds released
    ├── IF >50% weighted rejection → Status: "rejected" → funds stay locked
    └── IF no quorum reached → Voting window extends by 24 hours (max 2 extensions)
    │
    ▼
FUND RELEASE
    │
    ├── Smart contract inner transaction sends approved amount to fundraiser
    ├── Release transaction hash logged on-chain
    ├── Donors see real-time balance: "320 ALGO remaining in escrow"
    │
    ▼
POST-SPEND VERIFICATION (closed-loop accountability)
    │
    ├── After spending, fundraiser uploads actual receipt/bill
    ├── AI compares receipt vs original quotation:
    │   ├── Amount match? (within 10% tolerance)
    │   ├── Same vendor?
    │   ├── Same items?
    │   └── Returns match_score (0-100)
    ├── Receipt hash stored on-chain alongside original quotation hash
    └── Donors can view: original quote vs actual receipt side-by-side
    │
    ▼
SAFETY MECHANISMS
    │
    ├── IF a withdrawal request is rejected 3 times:
    │   └── Campaign status → "frozen" (no more withdrawals allowed)
    │
    ├── IF campaign is frozen, donors can vote to:
    │   ├── UNFREEZE (give fundraiser another chance) — requires 60% approval
    │   └── CANCEL & REFUND (auto-refund all remaining escrow proportionally)
    │
    └── ALL actions are permanently logged on-chain → immutable audit trail
```

---

## Smart Contract Design

### New ABI Methods to Add to Fundraiser Contract

```python
# 1. submit_withdrawal_request
# Called by: campaign creator/organizer only
# Stores request details in box storage
@abimethod
def submit_withdrawal_request(
    self,
    request_id: Bytes,          # unique ID for this request
    milestone_id: UInt64,       # which milestone this is for
    amount_requested: UInt64,   # ALGO amount (in microALGO)
    purpose_hash: Bytes,        # SHA-256 of purpose text (stored off-chain)
    quotation_hash: Bytes,      # IPFS CID of quotation image
) -> None:
    # Assert: caller is campaign creator
    # Assert: amount_requested <= remaining milestone amount
    # Assert: no other pending request for this milestone
    # Store in box: req_{request_id} → (amount, milestone, quotation_hash, status=PENDING_AI, timestamp, ...)

# 2. record_ai_verification
# Called by: designated AI oracle address (or the frontend as intermediary)
@abimethod
def record_ai_verification(
    self,
    request_id: Bytes,
    ai_confidence_score: UInt64,  # 0-100
    ai_result_hash: Bytes,        # hash of full AI analysis JSON
) -> None:
    # Assert: request exists and status == PENDING_AI
    # If score >= 90 → status = AI_APPROVED
    # If score < 90 → status = PENDING_VOTE
    # Set voting_deadline = Global.latest_timestamp() + 172800 (48 hours)

# 3. vote_on_request
# Called by: any donor who contributed to this campaign
@abimethod
def vote_on_request(
    self,
    request_id: Bytes,
    vote: UInt64,           # 1 = approve, 0 = reject
    pay_txn: PaymentTransaction,  # MBR for box storage of vote record
) -> UInt64:  # returns current approval percentage
    # Assert: caller has donated (check box storage for donor record)
    # Assert: hasn't already voted on this request (check vote box)
    # Assert: voting deadline not passed
    # Vote weight = caller's donation amount
    # Add to votes_for or votes_against
    # Check if threshold reached (>50% of total_raised)
    # If approved → update status, emit event
    # If rejected → update status, increment rejection_count
    # Return current approval percentage

# 4. release_request_funds
# Called by: campaign creator after request is approved
@abimethod
def release_request_funds(
    self,
    request_id: Bytes,
) -> None:
    # Assert: request status == APPROVED
    # Inner transaction: send amount to creator
    # Update: remaining_milestone_amount, total_released
    # Status → RELEASED

# 5. submit_spend_proof
# Called by: campaign creator after spending the released funds
@abimethod
def submit_spend_proof(
    self,
    request_id: Bytes,
    receipt_hash: Bytes,        # IPFS CID of actual receipt
    receipt_ai_score: UInt64,   # AI comparison score vs quotation
) -> None:
    # Assert: request status == RELEASED
    # Store receipt_hash alongside original quotation_hash
    # Status → COMPLETED

# 6. cancel_campaign_vote
# Called by: any donor when campaign rejection_count >= 3
@abimethod
def cancel_campaign_vote(
    self,
    vote: UInt64,  # 1 = cancel & refund, 0 = keep going
) -> None:
    # Assert: rejection_count >= 3 (campaign is frozen)
    # If >60% vote to cancel → auto-refund proportionally
```

### Box Storage Layout

```
Box Name                        Size        Content
─────────────────────────────────────────────────────────
req_{request_id}                256 bytes   Packed: amount(8) + milestone(8) + quotation_hash(46)
                                            + ai_score(8) + status(1) + votes_for(8)
                                            + votes_against(8) + timestamp(8)
                                            + receipt_hash(46) + receipt_ai_score(8)
                                            + voting_deadline(8)

vote_{request_id}_{voter}       1 byte      0x01 = approved, 0x00 = rejected

donor_{address}                 8 bytes     donation_amount (for vote weighting)
```

**Why Box Storage?** Algorand global state is limited to 64 key-value pairs. With potentially dozens of withdrawal requests and hundreds of donor votes, box storage (8KB+ per box, unlimited boxes) is the only scalable approach.

---

## AI Verification Service

### Option A: Lightweight (Recommended for Hackathon)

Use **Google Gemini Vision API** or **OpenAI GPT-4o** to analyze quotation images:

```python
# API endpoint: POST /verify-quotation
# Input: { image_base64, claimed_amount, vendor_name, campaign_id }
# Processing:
#   1. Send image to Gemini/GPT-4o with prompt:
#      "Analyze this document. Is it a legitimate vendor quotation?
#       Extract: total_amount, vendor_name, itemized_list, date.
#       Check for signs of image manipulation or forgery."
#   2. Compare extracted_amount vs claimed_amount
#   3. Calculate confidence_score based on:
#      - Is it a real quotation format? (+30 points)
#      - Amount matches claim? (+25 points)
#      - Has vendor info? (+20 points)
#      - No manipulation detected? (+25 points)
# Output: { confidence_score, extracted_amount, vendor, fraud_indicators }
```

### Option B: Post-Spend Comparison

```python
# API endpoint: POST /compare-receipt-to-quotation
# Input: { quotation_image, receipt_image, expected_amount }
# Processing:
#   1. Extract data from both images via Gemini
#   2. Compare: amounts (within 10% tolerance), vendor, items
# Output: { match_score, amount_difference, discrepancies[] }
```

### Where to Host

- **For hackathon demo**: Run locally or deploy as a simple Flask/FastAPI service on Render/Railway (free tier)
- **For production**: Could be an Algorand Oracle service that posts verification results on-chain

---

## Frontend UI Design

### New Page: Fund Tracker Dashboard (`/fundraising/:id/track`)

```
┌──────────────────────────────────────────────────────────────────┐
│  📊 Campaign: Annual Tech Fest 2026                     [Active] │
│  Created by: Tech Club VIT | App ID: 755123456                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FUND OVERVIEW                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐      │
│  │  Raised  │  │In Escrow │  │ Released │  │ Your Share │      │
│  │ 500 ALGO │  │ 320 ALGO │  │ 180 ALGO │  │  25 ALGO   │      │
│  │          │  │  (64%)   │  │  (36%)   │  │  (5% vote) │      │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘      │
│                                                                  │
│  ═══════════════════════════════════════════                      │
│  MILESTONE PROGRESS                                              │
│  ═══════════════════════════════════════════                      │
│                                                                  │
│  ✅ Milestone 1: Venue Booking                      [Completed]  │
│  │  Released: 80 ALGO │ Receipt AI: 94% ✓                       │
│  │  [View Quotation] [View Receipt] [View On-Chain Proof]       │
│  │                                                               │
│  ✅ Milestone 2: Equipment Purchase                 [Completed]  │
│  │  Released: 100 ALGO │ Receipt AI: 91% ✓                      │
│  │  [View Quotation] [View Receipt] [View On-Chain Proof]       │
│  │                                                               │
│  🗳️ Milestone 3: Marketing & Promotions           [Voting Now]  │
│  │  Requested: 120 ALGO                                         │
│  │  AI Verification Score: 87% ⚠️                               │
│  │  ┌──────────────────────────────────────┐                    │
│  │  │ Approve: ███████████░░░░ 62%         │                    │
│  │  │ Reject:  ████░░░░░░░░░░░ 18%         │                    │
│  │  │ Pending: ░░░░░░░░░░░░░░░ 20%         │                    │
│  │  └──────────────────────────────────────┘                    │
│  │  Time remaining: 23h 14m                                     │
│  │  [View Quotation] [✅ VOTE APPROVE] [❌ VOTE REJECT]         │
│  │                                                               │
│  ⏳ Milestone 4: Event Day Logistics                [Upcoming]   │
│  │  Budget: 200 ALGO │ Not yet requested                        │
│                                                                  │
│  ═══════════════════════════════════════════                      │
│  WITHDRAWAL REQUEST HISTORY (On-Chain Audit Trail)               │
│  ═══════════════════════════════════════════                      │
│  ┌────┬───────────────────┬──────────┬───────────┬─────────┐    │
│  │ #  │ Purpose           │ Amount   │ AI Score  │ Status  │    │
│  ├────┼───────────────────┼──────────┼───────────┼─────────┤    │
│  │ 1  │ Venue deposit     │ 80 ALGO  │ 94% ✓    │ ✅ Done │    │
│  │ 2  │ Sound system      │ 100 ALGO │ 91% ✓    │ ✅ Done │    │
│  │ 3  │ Social media ads  │ 120 ALGO │ 87% ⚠️   │ 🗳️ Vote│    │
│  └────┴───────────────────┴──────────┴───────────┴─────────┘    │
│                                                                  │
│  [🔙 Back to Campaigns]                                         │
└──────────────────────────────────────────────────────────────────┘
```

### New Components Needed

| Component | Purpose |
|---|---|
| `FundOverview` | 4-card stats grid showing raised/escrow/released/your-share |
| `MilestoneTracker` | Visual timeline with status badges and expandable details |
| `WithdrawalRequestCard` | Shows quotation, AI score, voting progress, vote buttons |
| `VoteButton` | Triggers on-chain vote transaction (weighted by donation amount) |
| `QuotationUploader` | Fundraiser uploads quotation image → pinned to IPFS → hash stored on-chain |
| `ReceiptComparer` | Side-by-side view of original quotation vs actual receipt |
| `AuditTrail` | Chronological log of all on-chain actions (reads from indexer) |

---

## How This Answers the Hackathon Question

**"How does the donor know whether his funds are getting used correctly?"**

Answer: CampusChain provides **5 layers of verification**:

1. **Escrow Lock** — Funds never leave the smart contract until explicitly approved
2. **Quotation Proof** — Fundraiser must show exactly what they plan to buy
3. **AI Verification** — Automated fraud detection on quotation documents
4. **Donor Democracy** — Donors vote (weighted by contribution) on every withdrawal
5. **Post-Spend Audit** — Actual receipt is compared against original quotation on-chain

No other campus fundraising platform offers this level of transparency. Every single action is **permanently recorded on the Algorand blockchain** — immutable, auditable, and trustless.

---

## Implementation Priority

| Step | Task | Effort |
|---|---|---|
| 1 | Add box storage for withdrawal requests to Fundraiser contract | 1 day |
| 2 | Add `submit_withdrawal_request` + `vote_on_request` methods | 1 day |
| 3 | Add `release_request_funds` + `submit_spend_proof` methods | 0.5 day |
| 4 | Build AI verification endpoint (Gemini/GPT-4o) | 0.5 day |
| 5 | Build Fund Tracker UI page with voting | 1.5 days |
| 6 | IPFS integration for quotation/receipt storage | 0.5 day |
| 7 | Testing & demo preparation | 1 day |
| **Total** | | **~6 days** |

---

## IPFS Storage (for Quotation/Receipt Images)

**Recommended: Pinata (free tier — 1GB)**

```
Fundraiser uploads quotation image
    ↓
Frontend pins to IPFS via Pinata API
    ↓
Gets back CID (content identifier): QmX3f4...abc
    ↓
CID stored on-chain in box storage (46 bytes)
    ↓
Anyone can view: https://gateway.pinata.cloud/ipfs/QmX3f4...abc
```

This way quotation images are:
- **Permanent** (IPFS content-addressed)
- **Tamper-proof** (changing image = different CID)
- **Publicly verifiable** (anyone can check the hash matches)
