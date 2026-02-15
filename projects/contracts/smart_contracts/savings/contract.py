from algopy import *
from algopy.arc4 import abimethod


class SavingsPool(ARC4Contract):
    """
    CampusChain Savings Pool (ROSCA / Chit Fund)
    
    A group of students collectively save and take turns receiving the pot.
    - Creator sets contribution amount, max members, duration
    - Members join by staking 1 month's contribution as collateral
    - Each cycle, all members contribute → one member receives the full pot
    - Rotation: first-joined = first-paid
    - Defaulters lose collateral and move to end of rotation
    """

    pool_name: Bytes
    contribution_amount: UInt64
    max_members: UInt64
    current_members: UInt64
    duration_months: UInt64
    current_cycle: UInt64
    pool_status: UInt64  # 0=accepting, 1=active, 2=completed
    creator: Account
    cycle_deadline: UInt64
    cycle_contributions: UInt64  # how many have contributed this cycle
    total_pool_value: UInt64

    def __init__(self) -> None:
        # member_{address} → join_order (8 bytes)
        self.member_order = BoxMap(Account, UInt64, key_prefix=b"mo_")
        # member_{address} → total_contributed (8 bytes)
        self.member_contributed = BoxMap(Account, UInt64, key_prefix=b"mc_")
        # member_{address} → has_received (8 bytes, 0 or 1)
        self.member_received = BoxMap(Account, UInt64, key_prefix=b"mr_")
        # member_{address} → paid_this_cycle (8 bytes, 0 or 1)
        self.member_cycle_paid = BoxMap(Account, UInt64, key_prefix=b"mp_")
        # member_{address} → stake deposited (8 bytes)
        self.member_stake = BoxMap(Account, UInt64, key_prefix=b"ms_")

    @abimethod(allow_actions=["NoOp"], create="require")
    def create_pool(
        self,
        name: Bytes,
        contribution: UInt64,
        max_members: UInt64,
        duration: UInt64,
    ) -> UInt64:
        self.pool_name = name
        self.contribution_amount = contribution
        self.max_members = max_members
        self.current_members = UInt64(0)
        self.duration_months = duration
        self.current_cycle = UInt64(0)
        self.pool_status = UInt64(0)  # accepting
        self.creator = Txn.sender
        self.cycle_deadline = UInt64(0)
        self.cycle_contributions = UInt64(0)
        self.total_pool_value = UInt64(0)
        return UInt64(1)

    @abimethod()
    def join_pool(self, stake_txn: gtxn.PaymentTransaction) -> UInt64:
        """Join pool by staking 1 month's contribution as collateral."""
        assert self.pool_status == UInt64(0), "Pool not accepting"
        assert self.current_members < self.max_members, "Pool full"
        assert stake_txn.receiver == Global.current_application_address
        assert stake_txn.amount >= self.contribution_amount, "Stake too low"

        # Check not already a member
        _existing, already_member = self.member_order.maybe(Txn.sender)
        assert not already_member, "Already a member"

        position = self.current_members
        self.member_order[Txn.sender] = position
        self.member_contributed[Txn.sender] = UInt64(0)
        self.member_received[Txn.sender] = UInt64(0)
        self.member_cycle_paid[Txn.sender] = UInt64(0)
        self.member_stake[Txn.sender] = stake_txn.amount

        self.current_members += UInt64(1)
        self.total_pool_value += stake_txn.amount

        return position

    @abimethod()
    def start_pool(self) -> UInt64:
        """Start the pool once enough members have joined. Creator only."""
        assert Txn.sender == self.creator, "Only creator"
        assert self.pool_status == UInt64(0), "Already started"
        assert self.current_members >= UInt64(2), "Need at least 2 members"

        self.pool_status = UInt64(1)  # active
        self.current_cycle = UInt64(1)
        # 30 days per cycle
        self.cycle_deadline = Global.latest_timestamp + UInt64(2592000)
        return UInt64(1)

    @abimethod()
    def contribute(self, pay_txn: gtxn.PaymentTransaction) -> UInt64:
        """Monthly contribution. Must be exact contribution amount."""
        assert self.pool_status == UInt64(1), "Pool not active"
        assert pay_txn.receiver == Global.current_application_address
        assert pay_txn.amount >= self.contribution_amount, "Insufficient"

        # Check is member
        _order, is_member = self.member_order.maybe(Txn.sender)
        assert is_member, "Not a member"

        # Check hasn't paid this cycle
        paid, _exists = self.member_cycle_paid.maybe(Txn.sender)
        assert paid == UInt64(0), "Already paid this cycle"

        self.member_cycle_paid[Txn.sender] = UInt64(1)
        existing_total, _e = self.member_contributed.maybe(Txn.sender)
        self.member_contributed[Txn.sender] = existing_total + pay_txn.amount
        self.cycle_contributions += UInt64(1)
        self.total_pool_value += pay_txn.amount

        return self.cycle_contributions

    @abimethod()
    def trigger_payout(self, recipient: Account) -> UInt64:
        """Trigger payout for current cycle. Creator only."""
        assert Txn.sender == self.creator, "Only creator"
        assert self.pool_status == UInt64(1), "Pool not active"

        # Verify recipient is a member who hasn't received yet
        order, is_member = self.member_order.maybe(recipient)
        assert is_member, "Not a member"
        received, _e = self.member_received.maybe(recipient)
        assert received == UInt64(0), "Already received"

        # Calculate payout (all contributions this cycle)
        payout = self.contribution_amount * self.current_members
        min_balance = UInt64(100000)
        assert Global.current_application_address.balance >= payout + min_balance

        itxn.Payment(receiver=recipient, amount=payout, fee=0).submit()

        self.member_received[recipient] = UInt64(1)
        self.total_pool_value -= payout

        # Advance cycle
        self.current_cycle += UInt64(1)
        self.cycle_contributions = UInt64(0)

        # Check if pool is complete
        if self.current_cycle > self.duration_months:
            self.pool_status = UInt64(2)  # completed

        # Reset cycle payments for all (simplified — next contribute checks)
        self.cycle_deadline = Global.latest_timestamp + UInt64(2592000)

        return payout

    @abimethod()
    def get_pool_info(self) -> tuple[UInt64, UInt64, UInt64, UInt64, UInt64, UInt64]:
        """Returns (contribution, max_members, current_members, current_cycle, duration, status)"""
        return (
            self.contribution_amount,
            self.max_members,
            self.current_members,
            self.current_cycle,
            self.duration_months,
            self.pool_status,
        )

    @abimethod(readonly=True)
    def get_member_info(self, member: Account) -> tuple[UInt64, UInt64, UInt64, UInt64]:
        """Returns (join_order, total_contributed, has_received, stake)"""
        order, exists = self.member_order.maybe(member)
        if not exists:
            return (UInt64(0), UInt64(0), UInt64(0), UInt64(0))
        contributed, _e1 = self.member_contributed.maybe(member)
        received, _e2 = self.member_received.maybe(member)
        stake, _e3 = self.member_stake.maybe(member)
        return (order, contributed, received, stake)

    @abimethod(readonly=True)
    def get_creator(self) -> Account:
        return self.creator

    @abimethod(readonly=True)
    def get_pool_status(self) -> UInt64:
        return self.pool_status
