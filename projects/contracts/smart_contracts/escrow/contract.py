from algopy import *
from algopy.arc4 import abimethod, Address


class FundraiserEscrow(ARC4Contract):
    """
    CampusChain Fundraiser with Quotation-Based Escrow
    
    Extends the base Fundraiser with:
    - Withdrawal requests with quotation proof (IPFS hash)
    - AI verification score recording
    - Donor weighted voting on withdrawal requests
    - Post-spend receipt verification
    - Frozen campaign & auto-refund mechanisms
    
    Pipeline: Create → Donate → Submit Withdrawal Request → AI Verify →
              Donor Vote → Release Funds → Submit Spend Proof
    """

    # Campaign parameters
    goal_amount: UInt64
    raised_amount: UInt64
    milestone_count: UInt64
    current_milestone: UInt64
    deadline: UInt64
    is_active: bool
    creator: Account
    contributor_count: UInt64
    goal_reached: bool

    # Multi-signature approvers
    approver1: Account
    approver2: Account
    approver3: Account
    approver1_approved: bool
    approver2_approved: bool
    approver3_approved: bool

    # Escrow tracking
    total_released: UInt64
    request_count: UInt64
    rejection_count: UInt64
    is_frozen: bool
    voting_window: UInt64  # default 172800 = 48 hours

    def __init__(self) -> None:
        self.donors = BoxMap(Account, UInt64, key_prefix=b"d_")

    @abimethod(allow_actions=["NoOp"], create="require")
    def create_campaign(
        self,
        goal: UInt64,
        milestones: UInt64,
        deadline: UInt64,
        approver1: Address,
        approver2: Address,
        approver3: Address,
    ) -> UInt64:
        self.goal_amount = goal
        self.raised_amount = UInt64(0)
        self.milestone_count = milestones
        self.current_milestone = UInt64(0)
        self.deadline = deadline
        self.is_active = True
        self.creator = Txn.sender
        self.contributor_count = UInt64(0)
        self.goal_reached = False

        self.approver1 = approver1.native
        self.approver2 = approver2.native
        self.approver3 = approver3.native
        self.approver1_approved = False
        self.approver2_approved = False
        self.approver3_approved = False

        # Escrow state
        self.total_released = UInt64(0)
        self.request_count = UInt64(0)
        self.rejection_count = UInt64(0)
        self.is_frozen = False
        self.voting_window = UInt64(172800)  # 48 hours

        return UInt64(1)

    @abimethod()
    def donate(self, payment: gtxn.PaymentTransaction) -> UInt64:
        """Donate to the campaign. Tracks per-donor amount for vote weighting."""
        assert self.is_active, "Campaign not active"
        assert not self.is_frozen, "Campaign is frozen"
        assert Global.latest_timestamp <= self.deadline, "Campaign ended"
        assert payment.receiver == Global.current_application_address
        assert payment.amount >= UInt64(100000), "Minimum 0.1 ALGO"

        self.raised_amount += payment.amount
        self.contributor_count += UInt64(1)

        # Track per-donor total for weighted voting
        existing, exists = self.donors.maybe(payment.sender)
        if exists:
            self.donors[payment.sender] = existing + payment.amount
        else:
            self.donors[payment.sender] = payment.amount

        if self.raised_amount >= self.goal_amount:
            self.goal_reached = True

        return self.raised_amount

    @abimethod()
    def approve_milestone(self) -> UInt64:
        """Approver signs off on current milestone (3-of-3 multisig)."""
        assert self.goal_reached, "Goal not reached"
        assert self.current_milestone < self.milestone_count, "All milestones done"

        sender = Txn.sender
        if sender == self.approver1:
            assert not self.approver1_approved, "Already approved"
            self.approver1_approved = True
        elif sender == self.approver2:
            assert not self.approver2_approved, "Already approved"
            self.approver2_approved = True
        elif sender == self.approver3:
            assert not self.approver3_approved, "Already approved"
            self.approver3_approved = True
        else:
            assert False, "Not an approver"

        count = UInt64(0)
        if self.approver1_approved:
            count += UInt64(1)
        if self.approver2_approved:
            count += UInt64(1)
        if self.approver3_approved:
            count += UInt64(1)
        return count

    @abimethod()
    def release_milestone(self) -> UInt64:
        """Release milestone funds after 3/3 approval."""
        assert Txn.sender == self.creator, "Only creator"
        assert self.current_milestone < self.milestone_count, "All done"
        assert self.goal_reached, "Goal not reached"
        assert self.approver1_approved, "Approver 1 pending"
        assert self.approver2_approved, "Approver 2 pending"
        assert self.approver3_approved, "Approver 3 pending"

        amount_per_milestone = self.goal_amount // self.milestone_count
        min_balance = UInt64(100000)
        assert Global.current_application_address.balance >= amount_per_milestone + min_balance

        itxn.Payment(receiver=self.creator, amount=amount_per_milestone, fee=0).submit()

        self.current_milestone += UInt64(1)
        self.total_released += amount_per_milestone
        self.approver1_approved = False
        self.approver2_approved = False
        self.approver3_approved = False

        return self.current_milestone

    # ============================================================
    # ESCROW: Withdrawal Request System
    # ============================================================

    @abimethod()
    def submit_withdrawal_request(
        self,
        request_id: UInt64,
        amount_requested: UInt64,
        purpose_hash: Bytes,
        quotation_hash: Bytes,
    ) -> UInt64:
        """
        Fundraiser submits a withdrawal request with quotation proof.
        Creates a box: req_{id} with packed data.
        """
        assert Txn.sender == self.creator, "Only creator"
        assert not self.is_frozen, "Campaign frozen"
        assert self.goal_reached, "Goal not reached"

        remaining = self.raised_amount - self.total_released
        assert amount_requested <= remaining, "Exceeds available"
        assert amount_requested > UInt64(0), "Zero amount"

        # Box key: "wr_" + request_id (8 bytes)
        box_key = b"wr_" + op.itob(request_id)

        # Check request doesn't already exist
        _existing, exists = op.Box.get(box_key)
        assert not exists, "Request already exists"

        # Pack data: amount(8) + status(8) + ai_score(8) + votes_for(8) + votes_against(8) +
        #            timestamp(8) + voting_deadline(8) = 56 bytes fixed
        # Then: purpose_hash (variable) + quotation_hash (variable) stored separately
        status = UInt64(0)  # 0=pending_ai
        timestamp = Global.latest_timestamp
        voting_deadline = UInt64(0)

        packed = (
            op.itob(amount_requested)
            + op.itob(status)
            + op.itob(UInt64(0))  # ai_score
            + op.itob(UInt64(0))  # votes_for
            + op.itob(UInt64(0))  # votes_against
            + op.itob(timestamp)
            + op.itob(voting_deadline)
        )
        op.Box.put(box_key, packed)

        # Store quotation hash in separate box
        quote_key = b"qt_" + op.itob(request_id)
        op.Box.put(quote_key, quotation_hash)

        # Store purpose hash
        purp_key = b"pp_" + op.itob(request_id)
        op.Box.put(purp_key, purpose_hash)

        self.request_count += UInt64(1)
        return request_id

    @abimethod()
    def record_ai_verification(
        self,
        request_id: UInt64,
        ai_confidence_score: UInt64,
    ) -> UInt64:
        """Record AI verification result. Sets status and opens voting."""
        box_key = b"wr_" + op.itob(request_id)
        packed, exists = op.Box.get(box_key)
        assert exists, "Request not found"

        status = op.extract_uint64(packed, 8)
        assert status == UInt64(0), "Not pending AI"

        # Update status: 1=ai_approved (>=80), 2=pending_vote (<80)
        new_status = UInt64(1) if ai_confidence_score >= UInt64(80) else UInt64(2)
        voting_deadline = Global.latest_timestamp + self.voting_window

        new_packed = (
            op.extract(packed, 0, 8)  # amount
            + op.itob(new_status)  # status
            + op.itob(ai_confidence_score)  # ai_score
            + op.extract(packed, 24, 8)  # votes_for
            + op.extract(packed, 32, 8)  # votes_against
            + op.extract(packed, 40, 8)  # timestamp
            + op.itob(voting_deadline)  # voting_deadline
        )
        op.Box.put(box_key, new_packed)
        return ai_confidence_score

    @abimethod()
    def vote_on_request(
        self,
        request_id: UInt64,
        vote: UInt64,
    ) -> UInt64:
        """
        Donor votes on withdrawal request. Weight = donation amount.
        vote: 1=approve, 0=reject
        Returns current approval percentage (0-100).
        """
        box_key = b"wr_" + op.itob(request_id)
        packed, exists = op.Box.get(box_key)
        assert exists, "Request not found"

        status = op.extract_uint64(packed, 8)
        assert status == UInt64(1) or status == UInt64(2), "Not in voting phase"

        voting_deadline = op.extract_uint64(packed, 48)
        assert Global.latest_timestamp <= voting_deadline, "Voting ended"

        # Check caller is a donor
        donor_amount, is_donor = self.donors.maybe(Txn.sender)
        assert is_donor, "Not a donor"

        # Check hasn't voted already (per-request vote box)
        vote_key = b"vt_" + op.itob(request_id) + Txn.sender.bytes
        _vote_data, already_voted = op.Box.get(vote_key)
        assert not already_voted, "Already voted"

        # Record vote
        op.Box.put(vote_key, op.itob(vote))

        # Update tallies
        votes_for = op.extract_uint64(packed, 24)
        votes_against = op.extract_uint64(packed, 32)

        if vote == UInt64(1):
            votes_for += donor_amount
        else:
            votes_against += donor_amount

        # Check if threshold reached (>50% of raised)
        threshold = self.raised_amount // UInt64(2)
        new_status = op.extract_uint64(packed, 8)

        if votes_for > threshold:
            new_status = UInt64(3)  # approved
        elif votes_against > threshold:
            new_status = UInt64(4)  # rejected
            self.rejection_count += UInt64(1)
            if self.rejection_count >= UInt64(3):
                self.is_frozen = True

        new_packed = (
            op.extract(packed, 0, 8)  # amount
            + op.itob(new_status)
            + op.extract(packed, 16, 8)  # ai_score
            + op.itob(votes_for)
            + op.itob(votes_against)
            + op.extract(packed, 40, 8)  # timestamp
            + op.extract(packed, 48, 8)  # voting_deadline
        )
        op.Box.put(box_key, new_packed)

        # Return approval percentage
        total_votes = votes_for + votes_against
        if total_votes > UInt64(0):
            return (votes_for * UInt64(100)) // total_votes
        return UInt64(0)

    @abimethod()
    def release_request_funds(self, request_id: UInt64) -> UInt64:
        """Release funds for an approved withdrawal request."""
        assert Txn.sender == self.creator, "Only creator"

        box_key = b"wr_" + op.itob(request_id)
        packed, exists = op.Box.get(box_key)
        assert exists, "Request not found"

        status = op.extract_uint64(packed, 8)
        assert status == UInt64(3), "Not approved"

        amount = op.extract_uint64(packed, 0)
        min_balance = UInt64(100000)
        assert Global.current_application_address.balance >= amount + min_balance

        itxn.Payment(receiver=self.creator, amount=amount, fee=0).submit()
        self.total_released += amount

        # Update status to released (5)
        new_packed = (
            op.extract(packed, 0, 8)
            + op.itob(UInt64(5))  # released
            + op.extract(packed, 16, 40)
        )
        op.Box.put(box_key, new_packed)

        return amount

    @abimethod()
    def submit_spend_proof(
        self,
        request_id: UInt64,
        receipt_hash: Bytes,
        receipt_ai_score: UInt64,
    ) -> bool:
        """Submit post-spend receipt proof for an already-released request."""
        assert Txn.sender == self.creator, "Only creator"

        box_key = b"wr_" + op.itob(request_id)
        packed, exists = op.Box.get(box_key)
        assert exists, "Request not found"

        status = op.extract_uint64(packed, 8)
        assert status == UInt64(5), "Not released yet"

        # Store receipt in separate box
        receipt_key = b"rc_" + op.itob(request_id)
        op.Box.put(receipt_key, receipt_hash)

        # Store receipt AI score
        rcs_key = b"rs_" + op.itob(request_id)
        op.Box.put(rcs_key, op.itob(receipt_ai_score))

        # Update status to completed (6)
        new_packed = (
            op.extract(packed, 0, 8)
            + op.itob(UInt64(6))  # completed
            + op.extract(packed, 16, 40)
        )
        op.Box.put(box_key, new_packed)

        return True

    # ============================================================
    # READ METHODS
    # ============================================================

    @abimethod()
    def get_status(self) -> tuple[UInt64, UInt64, UInt64, UInt64, UInt64, bool, bool]:
        return (
            self.goal_amount,
            self.raised_amount,
            self.current_milestone,
            self.milestone_count,
            self.contributor_count,
            self.is_active,
            self.goal_reached,
        )

    @abimethod(readonly=True)
    def get_escrow_status(self) -> tuple[UInt64, UInt64, UInt64, bool]:
        """Returns (total_released, request_count, rejection_count, is_frozen)"""
        return (self.total_released, self.request_count, self.rejection_count, self.is_frozen)

    @abimethod(readonly=True)
    def get_request_info(self, request_id: UInt64) -> tuple[UInt64, UInt64, UInt64, UInt64, UInt64, UInt64, UInt64]:
        """
        Returns withdrawal request info:
        (amount, status, ai_score, votes_for, votes_against, timestamp, voting_deadline)
        Status codes: 0=pending_ai, 1=ai_approved, 2=pending_vote,
                      3=approved, 4=rejected, 5=released, 6=completed
        """
        box_key = b"wr_" + op.itob(request_id)
        packed, exists = op.Box.get(box_key)
        assert exists, "Request not found"

        return (
            op.extract_uint64(packed, 0),
            op.extract_uint64(packed, 8),
            op.extract_uint64(packed, 16),
            op.extract_uint64(packed, 24),
            op.extract_uint64(packed, 32),
            op.extract_uint64(packed, 40),
            op.extract_uint64(packed, 48),
        )

    @abimethod(readonly=True)
    def get_donor_weight(self, donor: Address) -> UInt64:
        """Get donor's voting weight (= total donated amount)."""
        amount, exists = self.donors.maybe(donor.native)
        if exists:
            return amount
        return UInt64(0)

    @abimethod(readonly=True)
    def get_creator(self) -> Account:
        return self.creator

    @abimethod(readonly=True)
    def get_deadline(self) -> UInt64:
        return self.deadline

    @abimethod(readonly=True)
    def get_approvers(self) -> tuple[Address, Address, Address]:
        return (
            Address(self.approver1.bytes),
            Address(self.approver2.bytes),
            Address(self.approver3.bytes),
        )

    @abimethod(readonly=True)
    def get_approval_status(self) -> tuple[bool, bool, bool]:
        return (self.approver1_approved, self.approver2_approved, self.approver3_approved)

    @abimethod(readonly=True)
    def get_approval_count(self) -> UInt64:
        count = UInt64(0)
        if self.approver1_approved:
            count += UInt64(1)
        if self.approver2_approved:
            count += UInt64(1)
        if self.approver3_approved:
            count += UInt64(1)
        return count

    @abimethod(readonly=True)
    def is_approver(self, address: Address) -> bool:
        account = address.native
        if account == self.creator:
            return True
        if account == self.approver1:
            return True
        if account == self.approver2:
            return True
        if account == self.approver3:
            return True
        return False
