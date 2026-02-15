from algopy import *
from algopy.arc4 import abimethod, Address


class StudyGroup(ARC4Contract):
    """
    CampusChain Study Group Staking
    
    Students stake ALGO as commitment to attend study sessions.
    - Show up to all sessions → get stake back + bonus from no-shows
    - Miss sessions → lose proportional stake
    - Creator marks attendance, attendees confirm
    
    Incentivizes accountability through financial skin-in-the-game.
    """

    topic_hash: Bytes
    stake_amount: UInt64
    session_count: UInt64
    sessions_completed: UInt64
    max_members: UInt64
    current_members: UInt64
    total_staked: UInt64
    creator: Account
    status: UInt64  # 0=accepting, 1=active, 2=completed
    total_forfeited: UInt64

    def __init__(self) -> None:
        # member → staked_amount
        self.member_stake = BoxMap(Account, UInt64, key_prefix=b"st_")
        # member → sessions_attended
        self.member_attendance = BoxMap(Account, UInt64, key_prefix=b"at_")
        # session_{index}_{member} → 1 if attended
        # We'll track via a simpler per-session counter approach

    @abimethod(allow_actions=["NoOp"], create="require")
    def create_group(
        self,
        topic: Bytes,
        stake: UInt64,
        sessions: UInt64,
        max_members: UInt64,
    ) -> UInt64:
        assert stake >= UInt64(100000), "Min stake 0.1 ALGO"
        assert sessions >= UInt64(1), "At least 1 session"
        assert max_members >= UInt64(2), "At least 2 members"

        self.topic_hash = topic
        self.stake_amount = stake
        self.session_count = sessions
        self.sessions_completed = UInt64(0)
        self.max_members = max_members
        self.current_members = UInt64(0)
        self.total_staked = UInt64(0)
        self.creator = Txn.sender
        self.status = UInt64(0)
        self.total_forfeited = UInt64(0)
        return UInt64(1)

    @abimethod()
    def join_group(self, stake_txn: gtxn.PaymentTransaction) -> UInt64:
        """Join study group by staking ALGO."""
        assert self.status == UInt64(0), "Not accepting"
        assert self.current_members < self.max_members, "Group full"
        assert stake_txn.receiver == Global.current_application_address
        assert stake_txn.amount >= self.stake_amount, "Stake too low"

        _existing, already_member = self.member_stake.maybe(Txn.sender)
        assert not already_member, "Already joined"

        self.member_stake[Txn.sender] = stake_txn.amount
        self.member_attendance[Txn.sender] = UInt64(0)
        self.current_members += UInt64(1)
        self.total_staked += stake_txn.amount

        return self.current_members

    @abimethod()
    def start_group(self) -> UInt64:
        """Start the study group. Creator only."""
        assert Txn.sender == self.creator, "Only creator"
        assert self.status == UInt64(0), "Already started"
        assert self.current_members >= UInt64(2), "Need 2+ members"

        self.status = UInt64(1)  # active
        return UInt64(1)

    @abimethod()
    def mark_attendance(self, member: Account) -> UInt64:
        """
        Creator marks a member as attended for current session.
        Returns member's total attendance count.
        """
        assert Txn.sender == self.creator, "Only creator"
        assert self.status == UInt64(1), "Not active"
        assert self.sessions_completed < self.session_count, "All sessions done"

        _stake, is_member = self.member_stake.maybe(member)
        assert is_member, "Not a member"

        current_attendance, _e = self.member_attendance.maybe(member)
        self.member_attendance[member] = current_attendance + UInt64(1)

        return current_attendance + UInt64(1)

    @abimethod()
    def complete_session(self) -> UInt64:
        """Mark current session as complete. Creator only."""
        assert Txn.sender == self.creator, "Only creator"
        assert self.status == UInt64(1), "Not active"
        assert self.sessions_completed < self.session_count, "All done"

        self.sessions_completed += UInt64(1)

        # If all sessions complete, mark group as completed
        if self.sessions_completed == self.session_count:
            self.status = UInt64(2)

        return self.sessions_completed

    @abimethod()
    def claim_stake(self) -> UInt64:
        """
        Member claims their stake back after group completion.
        Full attendance → stake + share of forfeited stakes.
        Partial attendance → proportional stake return.
        """
        assert self.status == UInt64(2), "Group not completed"

        stake, is_member = self.member_stake.maybe(Txn.sender)
        assert is_member, "Not a member"
        assert stake > UInt64(0), "Already claimed"

        attendance, _e = self.member_attendance.maybe(Txn.sender)

        # Calculate return based on attendance ratio
        if attendance == self.session_count:
            # Perfect attendance — get full stake back
            payout = stake
        elif attendance > UInt64(0):
            # Partial — proportional return
            payout = (stake * attendance) // self.session_count
            forfeited = stake - payout
            self.total_forfeited += forfeited
        else:
            # Zero attendance — lose all stake
            self.total_forfeited += stake
            payout = UInt64(0)

        if payout > UInt64(0):
            min_balance = UInt64(100000)
            if Global.current_application_address.balance >= payout + min_balance:
                itxn.Payment(receiver=Txn.sender, amount=payout, fee=0).submit()

        # Mark as claimed
        self.member_stake[Txn.sender] = UInt64(0)
        return payout

    @abimethod()
    def claim_bonus(self) -> UInt64:
        """
        Perfect-attendance members claim their share of forfeited stakes.
        Must be called after all members have claimed their stakes.
        """
        assert self.status == UInt64(2), "Not completed"
        assert self.total_forfeited > UInt64(0), "No bonus pool"

        attendance, _e = self.member_attendance.maybe(Txn.sender)
        assert attendance == self.session_count, "Not perfect attendance"

        # Simple: give proportional share of forfeited pool
        # Each perfect-attendance member gets equal share
        bonus_share = self.total_forfeited // self.current_members
        if bonus_share > UInt64(0):
            min_balance = UInt64(100000)
            if Global.current_application_address.balance >= bonus_share + min_balance:
                itxn.Payment(receiver=Txn.sender, amount=bonus_share, fee=0).submit()

        return bonus_share

    @abimethod()
    def get_group_info(self) -> tuple[UInt64, UInt64, UInt64, UInt64, UInt64, UInt64]:
        """Returns (stake, sessions, sessions_completed, max_members, current_members, status)"""
        return (
            self.stake_amount,
            self.session_count,
            self.sessions_completed,
            self.max_members,
            self.current_members,
            self.status,
        )

    @abimethod(readonly=True)
    def get_member_info(self, member: Account) -> tuple[UInt64, UInt64]:
        """Returns (staked_amount, sessions_attended)"""
        stake, exists = self.member_stake.maybe(member)
        if not exists:
            return (UInt64(0), UInt64(0))
        attendance, _e = self.member_attendance.maybe(member)
        return (stake, attendance)

    @abimethod(readonly=True)
    def get_creator(self) -> Account:
        return self.creator

    @abimethod(readonly=True)
    def get_status(self) -> UInt64:
        return self.status
