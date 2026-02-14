from algopy import *
from algopy.arc4 import abimethod


class Fundraiser(ARC4Contract):
    """
    CampusChain Fundraiser Contract
    Milestone-based crowdfunding for campus activities
    Each deployment = one campaign (fully decentralized)
    Funds released ONLY if goal is met!
    """

    goal_amount: UInt64
    raised_amount: UInt64
    milestone_count: UInt64
    current_milestone: UInt64
    deadline: UInt64
    is_active: bool
    creator: Account
    contributor_count: UInt64
    goal_reached: bool  # NEW: Track if goal was met

    @abimethod(allow_actions=['NoOp'], create='require')
    def create_campaign(self, goal: UInt64, milestones: UInt64, deadline: UInt64) -> UInt64:
        """Create a new fundraising campaign (called during contract creation)"""
        self.goal_amount = goal
        self.raised_amount = UInt64(0)
        self.milestone_count = milestones
        self.current_milestone = UInt64(0)
        self.deadline = deadline
        self.is_active = True
        self.creator = Txn.sender
        self.contributor_count = UInt64(0)
        self.goal_reached = False  # Initialize as not reached
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
        
        # NEW: Check if goal is reached
        if self.raised_amount >= self.goal_amount:
            self.goal_reached = True
        
        return self.raised_amount

    @abimethod()
    def release_milestone(self) -> UInt64:
        """
        Release funds for completed milestone (creator only)
        NEW: Can ONLY release if goal is met!
        FIXED: Reserves minimum balance (0.1 ALGO) in contract
        """
        assert Txn.sender == self.creator, "Only creator can release"
        assert self.current_milestone < self.milestone_count, "All milestones completed"
        
        # NEW: Must reach goal before ANY milestone can be released
        assert self.goal_reached, "Cannot release funds - goal not reached yet"
        
        # Calculate amount per milestone (integer division)
        amount_per_milestone = self.goal_amount // self.milestone_count
        
        # Reserve minimum balance requirement (0.1 ALGO = 100,000 microAlgos)
        min_balance = UInt64(100000)
        contract_balance = Global.current_application_address.balance
        
        # Ensure we keep the MBR in the contract
        assert contract_balance >= amount_per_milestone + min_balance, "Insufficient balance after MBR"
        
        # Send funds to creator using inner transaction
        itxn.Payment(
            receiver=self.creator,
            amount=amount_per_milestone,
            fee=0
        ).submit()
        
        self.current_milestone += UInt64(1)
        return self.current_milestone

    @abimethod()
    def get_status(self) -> tuple[UInt64, UInt64, UInt64, UInt64, UInt64, bool, bool]:
        """Get campaign status (includes goal_reached)"""
        return (
            self.goal_amount,
            self.raised_amount,
            self.current_milestone,
            self.milestone_count,
            self.contributor_count,
            self.is_active,
            self.goal_reached  # NEW: Include goal status
        )
    
    @abimethod(readonly=True)
    def get_creator(self) -> Account:
        """Get campaign creator address"""
        return self.creator
    
    @abimethod(readonly=True)
    def get_deadline(self) -> UInt64:
        """Get campaign deadline"""
        return self.deadline
