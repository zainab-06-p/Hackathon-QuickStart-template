from algopy import *
from algopy.arc4 import abimethod


class Ticketing(ARC4Contract):
    """
    CampusChain Ticketing Contract
    NFT-based event tickets with anti-scalping
    """

    ticket_price: UInt64
    max_supply: UInt64
    sold_count: UInt64
    is_sale_active: bool
    organizer: Account

    def __init__(self) -> None:
        self.ticket_price = UInt64(0)
        self.max_supply = UInt64(0)
        self.sold_count = UInt64(0)
        self.is_sale_active = False
        self.organizer = Txn.sender

    @abimethod()
    def create_event(self, price: UInt64, supply: UInt64) -> UInt64:
        """Create a new ticketed event"""
        assert not self.ticket_price, "Event already created"
        self.ticket_price = price
        self.max_supply = supply
        self.organizer = Txn.sender
        self.is_sale_active = True
        return UInt64(1)

    @abimethod()
    def buy_ticket(self, payment: gtxn.PaymentTransaction) -> UInt64:
        """Purchase an event ticket"""
        assert self.is_sale_active, "Sale not active"
        assert self.sold_count < self.max_supply, "Sold out"
        assert payment.receiver == Global.current_application_address
        assert payment.amount >= self.ticket_price, "Insufficient payment"
        
        self.sold_count += UInt64(1)
        return self.sold_count

    @abimethod()
    def toggle_sale(self) -> bool:
        """Toggle ticket sales on/off (organizer only)"""
        assert Txn.sender == self.organizer, "Only organizer can toggle"
        self.is_sale_active = not self.is_sale_active
        return self.is_sale_active

    @abimethod()
    def get_event_info(self) -> tuple[UInt64, UInt64, UInt64, bool]:
        """Get event information"""
        return self.ticket_price, self.max_supply, self.sold_count, self.is_sale_active
