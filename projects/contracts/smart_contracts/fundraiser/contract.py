from algopy import *
from algopy.arc4 import abimethod, Address


class Fundraiser(ARC4Contract):
    """
    CampusChain Multi-Signature Fundraiser Contract
    Milestone-based crowdfunding with ON-CHAIN decentralized approvals
    Requires ALL 3 approvers to sign before milestone release
    100% DECENTRALIZED - No Firebase or centralized database!
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
    
    # Multi-signature approvers (3 required signers)
    approver1: Account
    approver2: Account
    approver3: Account
    
    # Approval tracking for CURRENT milestone (reset after each release)
    approver1_approved: bool
    approver2_approved: bool
    approver3_approved: bool

    @abimethod(allow_actions=['NoOp'], create='require')
    def create_campaign(
        self, 
        goal: UInt64, 
        milestones: UInt64, 
        deadline: UInt64,
        approver1: Address,
        approver2: Address,
        approver3: Address
    ) -> UInt64:
        """
        Create campaign with 3 mandatory approvers
        All 3 must approve each milestone before funds can be released
        """
        self.goal_amount = goal
        self.raised_amount = UInt64(0)
        self.milestone_count = milestones
        self.current_milestone = UInt64(0)
        self.deadline = deadline
        self.is_active = True
        self.creator = Txn.sender
        self.contributor_count = UInt64(0)
        self.goal_reached = False
        
        # Store approver addresses (convert ARC4 Address to native Account)
        self.approver1 = approver1.native
        self.approver2 = approver2.native
        self.approver3 = approver3.native
        
        # Initialize all approvals to false
        self.approver1_approved = False
        self.approver2_approved = False
        self.approver3_approved = False
        
        return UInt64(1)

    @abimethod()
    def donate(self, payment: gtxn.PaymentTransaction) -> UInt64:
        """Donate to the campaign"""
        assert self.is_active, "Campaign not active"
        assert Global.latest_timestamp <= self.deadline, "Campaign ended"
        assert self.raised_amount < self.goal_amount, "Goal already reached"
        assert payment.receiver == Global.current_application_address
        assert payment.amount >= UInt64(100000), "Minimum 0.1 ALGO donation"
        
        self.raised_amount += payment.amount
        self.contributor_count += UInt64(1)
        
        # Check if goal is reached
        if self.raised_amount >= self.goal_amount:
            self.goal_reached = True
        
        return self.raised_amount

    @abimethod()
    def approve_milestone(self) -> UInt64:
        """
        🔐 DECENTRALIZED ON-CHAIN APPROVAL
        Approvers call this to approve the current milestone
        Replaces Firebase - all approvals stored on blockchain!
        Returns: number of approvals received (1, 2, or 3)
        """
        assert self.goal_reached, "Cannot approve - goal not reached"
        assert self.current_milestone < self.milestone_count, "All milestones completed"
        
        # Check if sender is one of the approvers and mark their approval
        sender = Txn.sender
        approval_recorded = False
        
        if sender == self.approver1:
            assert not self.approver1_approved, "Already approved"
            self.approver1_approved = True
            approval_recorded = True
        elif sender == self.approver2:
            assert not self.approver2_approved, "Already approved"
            self.approver2_approved = True
            approval_recorded = True
        elif sender == self.approver3:
            assert not self.approver3_approved, "Already approved"
            self.approver3_approved = True
            approval_recorded = True
        else:
            assert False, "Only approvers can approve milestones"
        
        # Count total approvals
        approval_count = UInt64(0)
        if self.approver1_approved:
            approval_count += UInt64(1)
        if self.approver2_approved:
            approval_count += UInt64(1)
        if self.approver3_approved:
            approval_count += UInt64(1)
        
        return approval_count

    @abimethod()
    def release_milestone(self) -> UInt64:
        """
        Release funds for current milestone (creator only)
        🔒 REQUIRES ALL 3 APPROVERS TO HAVE APPROVED FIRST
        This ensures multi-signature security on-chain!
        """
        assert Txn.sender == self.creator, "Only creator can release"
        assert self.current_milestone < self.milestone_count, "All milestones completed"
        assert self.goal_reached, "Cannot release funds - goal not reached"
        
        # 🔐 CRITICAL: Verify ALL approvers have approved
        assert self.approver1_approved, "Approver 1 has not approved"
        assert self.approver2_approved, "Approver 2 has not approved"
        assert self.approver3_approved, "Approver 3 has not approved"
        
        # Calculate amount per milestone
        amount_per_milestone = self.goal_amount // self.milestone_count
        
        # Reserve minimum balance (0.1 ALGO)
        min_balance = UInt64(100000)
        contract_balance = Global.current_application_address.balance
        assert contract_balance >= amount_per_milestone + min_balance, "Insufficient balance after MBR"
        
        # Send funds to creator
        itxn.Payment(
            receiver=self.creator,
            amount=amount_per_milestone,
            fee=0
        ).submit()
        
        # Increment milestone counter
        self.current_milestone += UInt64(1)
        
        # 🔄 RESET approvals for next milestone
        self.approver1_approved = False
        self.approver2_approved = False
        self.approver3_approved = False
        
        return self.current_milestone

    @abimethod()
    def get_status(self) -> tuple[UInt64, UInt64, UInt64, UInt64, UInt64, bool, bool]:
        """Get campaign status"""
        return (
            self.goal_amount,
            self.raised_amount,
            self.current_milestone,
            self.milestone_count,
            self.contributor_count,
            self.is_active,
            self.goal_reached
        )
    
    @abimethod(readonly=True)
    def get_creator(self) -> Account:
        """Get campaign creator address"""
        return self.creator
    
    @abimethod(readonly=True)
    def get_deadline(self) -> UInt64:
        """Get campaign deadline"""
        return self.deadline
    
    @abimethod(readonly=True)
    def get_approvers(self) -> tuple[Address, Address, Address]:
        """Get all approver addresses (on-chain query)"""
        return (
            Address(self.approver1.bytes),
            Address(self.approver2.bytes),
            Address(self.approver3.bytes)
        )
    
    @abimethod(readonly=True)
    def get_approval_status(self) -> tuple[bool, bool, bool]:
        """
        Get current approval status for each approver
        Returns (approver1_approved, approver2_approved, approver3_approved)
        Frontend can use this instead of Firebase!
        """
        return (
            self.approver1_approved,
            self.approver2_approved,
            self.approver3_approved
        )
    
    @abimethod(readonly=True)
    def has_approved(self, approver_address: Address) -> bool:
        """Check if a specific address has approved the current milestone"""
        sender_account = approver_address.native
        
        if sender_account == self.approver1:
            return self.approver1_approved
        elif sender_account == self.approver2:
            return self.approver2_approved
        elif sender_account == self.approver3:
            return self.approver3_approved
        else:
            return False
    
    @abimethod(readonly=True)
    def get_approval_count(self) -> UInt64:
        """Get number of approvals for current milestone"""
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
        """Check if an address is one of the approvers"""
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
