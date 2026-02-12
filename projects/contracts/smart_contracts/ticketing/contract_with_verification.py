from algopy import *
from algopy.arc4 import abimethod


class TicketingWithVerification(ARC4Contract):
    """
    Enhanced Ticketing Contract with NFT-based Verification
    Each ticket = unique NFT for entry verification
    """

    ticket_price: UInt64
    max_supply: UInt64
    sold_count: UInt64
    event_date: UInt64
    is_sale_active: bool
    organizer: Account
    unique_buyers: UInt64

    @abimethod(allow_actions=['NoOp'], create='require')
    def create_event(self, price: UInt64, supply: UInt64, event_date: UInt64) -> UInt64:
        """Create a new ticketed event"""
        self.ticket_price = price
        self.max_supply = supply
        self.sold_count = UInt64(0)
        self.event_date = event_date
        self.organizer = Txn.sender
        self.is_sale_active = True
        self.unique_buyers = UInt64(0)
        return UInt64(1)

    @abimethod()
    def buy_ticket(self, payment: gtxn.PaymentTransaction) -> UInt64:
        """Purchase ticket - mints NFT to buyer"""
        assert self.is_sale_active, "Sale not active"
        assert self.sold_count < self.max_supply, "Sold out"
        assert payment.receiver == Global.current_application_address
        assert payment.amount >= self.ticket_price
        
        # TODO: Mint unique NFT to buyer (Asset ID = ticket ID)
        # NFT metadata includes: event_id, seat_number, purchase_time
        # Buyer receives NFT to their wallet automatically
        
        self.sold_count += UInt64(1)
        self.unique_buyers += UInt64(1)
        return self.sold_count

    @abimethod()
    def verify_entry(self, ticket_holder: Account, ticket_asset_id: UInt64) -> bool:
        """Verify ticket ownership for entry (called by event staff)"""
        # Check if ticket_holder owns the NFT (ticket_asset_id)
        # Check if ticket hasn't been used (not checked-in yet)
        # Mark ticket as "checked-in" to prevent reuse
        
        assert Txn.sender == self.organizer, "Only organizer can verify"
        assert Global.latest_timestamp <= self.event_date + UInt64(86400), "Event ended"
        
        # TODO: Query ticket_holder's asset holdings
        # TODO: Verify ticket_asset_id belongs to this event
        # TODO: Mark as checked-in (store in box storage)
        
        return True

    @abimethod()
    def is_checked_in(self, ticket_asset_id: UInt64) -> bool:
        """Check if ticket has already been used for entry"""
        # TODO: Query box storage for checked-in status
        return False

    @abimethod(readonly=True)
    def get_event_info(self) -> tuple[UInt64, UInt64, UInt64, bool]:
        """Get event information"""
        return (self.ticket_price, self.max_supply, self.sold_count, self.is_sale_active)
