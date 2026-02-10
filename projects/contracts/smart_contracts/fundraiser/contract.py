from algopy import *
from algopy.arc4 import abimethod


class Fundraiser(ARC4Contract):
    """
    CampusChain Fundraiser Contract
    Milestone-based crowdfunding for campus activities
    """

    goal_amount: UInt64
    raised_amount: UInt64
    milestone_count: UInt64
    current_milestone: UInt64
    is_active: bool
    creator: Account

    def __init__(self) -> None:
        self.goal_amount = UInt64(0)
        self.raised_amount = UInt64(0)
        self.milestone_count = UInt64(3)
        self.current_milestone = UInt64(0)
        self.is_active = True
        self.creator = Txn.sender

    @abimethod()
    def create_campaign(self, goal: UInt64, milestones: UInt64) -> UInt64:
        """Create a new fundraising campaign"""
        assert not self.goal_amount, "Campaign already created"
        self.goal_amount = goal
        self.milestone_count = milestones
        self.creator = Txn.sender
        return UInt64(1)

    @abimethod()
    def donate(self, payment: gtxn.PaymentTransaction) -> UInt64:
        """Donate to the campaign"""
        assert self.is_active, "Campaign not active"
        assert self.raised_amount < self.goal_amount, "Goal already reached"
        assert payment.receiver == Global.current_application_address
        
        self.raised_amount += payment.amount
        return self.raised_amount

    @abimethod()
    def release_milestone(self) -> UInt64:
        """Release funds for completed milestone (creator only)"""
        assert Txn.sender == self.creator, "Only creator can release"
        assert self.current_milestone < self.milestone_count, "All milestones completed"
        
        self.current_milestone += UInt64(1)
        return self.current_milestone

    @abimethod()
    def get_status(self) -> tuple[UInt64, UInt64, UInt64, bool]:
        """Get campaign status"""
        return self.goal_amount, self.raised_amount, self.current_milestone, self.is_active
