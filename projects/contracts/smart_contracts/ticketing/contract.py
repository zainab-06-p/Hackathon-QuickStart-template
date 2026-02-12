from algopy import *
from algopy.arc4 import abimethod


class Ticketing(ARC4Contract):
    """
    CampusChain Ticketing Contract
    NFT-based event tickets with anti-scalping and entry verification
    Each deployment = one event (fully decentralized)
    Features:
    - Mints NFT ticket on purchase
    - QR code verification at entry
    - Prevents double entry
    """

    ticket_price: UInt64
    max_supply: UInt64
    sold_count: UInt64
    event_date: UInt64
    sale_end_date: UInt64  # NEW: Separate date when ticket sales stop
    is_sale_active: bool
    organizer: Account
    unique_buyers: UInt64

    @abimethod(allow_actions=['NoOp'], create='require')
    def create_event(self, price: UInt64, supply: UInt64, event_date: UInt64, sale_end_date: UInt64) -> UInt64:
        """Create a new ticketed event (called during contract creation)"""
        self.ticket_price = price
        self.max_supply = supply
        self.sold_count = UInt64(0)
        self.event_date = event_date
        self.sale_end_date = sale_end_date  # Store sale end date
        self.organizer = Txn.sender
        self.is_sale_active = True
        self.unique_buyers = UInt64(0)
        return UInt64(1)

    @abimethod()
    def buy_ticket(self, payment: gtxn.PaymentTransaction) -> UInt64:
        """
        Purchase an event ticket - Mints NFT to buyer
        Returns the NFT Asset ID
        """
        assert self.is_sale_active, "Sale not active"
        assert self.sold_count < self.max_supply, "Sold out"
        assert Global.latest_timestamp < self.sale_end_date, "Ticket sales have ended"
        assert Global.latest_timestamp < self.event_date, "Event has passed"
        assert payment.receiver == Global.current_application_address
        assert payment.amount >= self.ticket_price, "Insufficient payment"
        
        # Increment ticket counter
        self.sold_count += UInt64(1)
        self.unique_buyers += UInt64(1)
        
        # Mint NFT ticket - keep in contract until buyer opts in
        ticket_asset_id = itxn.AssetConfig(
            total=1,  # NFT (1 unit only)
            decimals=0,
            asset_name=b"Event Ticket",
            unit_name=b"TIX",
            url=b"ipfs://campus-ticket",
            manager=Global.current_application_address,
            reserve=payment.sender,  # Mark the buyer in reserve field
            freeze=Global.current_application_address,
            clawback=Global.current_application_address
        ).submit().created_asset.id
        
        # NFT stays with contract - buyer must opt-in then call claim_ticket
        # Check-in box will be created later during verify_entry
        return ticket_asset_id

    @abimethod()
    def claim_ticket(self, ticket_asset_id: UInt64) -> None:
        """
        Claim your purchased ticket NFT after opting in to the asset.
        Uses asset reserve field to verify the rightful buyer.
        """
        # Verify this asset was created by this contract and buyer is marked
        reserve_addr, reserve_exists = op.AssetParamsGet.asset_reserve(ticket_asset_id)
        assert reserve_exists, "Asset not found"
        assert reserve_addr == Txn.sender, "Not your ticket"
        
        # Verify buyer has opted into the asset
        buyer_balance, buyer_opted_in = op.AssetHoldingGet.asset_balance(Txn.sender, ticket_asset_id)
        assert buyer_opted_in, "Must opt-in to asset first"
        
        # Transfer using clawback
        itxn.AssetTransfer(
            asset_sender=Global.current_application_address,
            asset_receiver=Txn.sender,
            asset_amount=1,
            xfer_asset=ticket_asset_id
        ).submit()

    @abimethod()
    def verify_entry(self, ticket_holder: Account, ticket_asset_id: UInt64) -> bool:
        """
        Verify ticket at event entry (called by organizer/staff)
        Checks NFT ownership and check-in status
        """
        assert Txn.sender == self.organizer, "Only organizer can verify"
        assert Global.latest_timestamp <= self.event_date + UInt64(86400), "Event verification period ended"
        
        # Check ticket_holder owns the NFT
        holder_balance, holder_exists = op.AssetHoldingGet.asset_balance(ticket_holder, ticket_asset_id)
        assert holder_exists and holder_balance == UInt64(1), "Ticket not owned by holder"
        
        # Check ticket hasn't been used (create box if first time)
        box_key = op.itob(ticket_asset_id)
        ticket_status, box_exists = op.Box.get(box_key)
        
        if box_exists:
            # Box exists - check if already used
            assert op.extract_uint64(ticket_status, 0) == UInt64(0), "Ticket already used"
        
        # Mark as checked-in (creates box if doesn't exist)
        op.Box.put(box_key, op.itob(UInt64(1)))
        
        return True

    @abimethod(readonly=True)
    def is_checked_in(self, ticket_asset_id: UInt64) -> bool:
        """Check if a ticket has been used for entry"""
        box_key = op.itob(ticket_asset_id)
        ticket_status, box_exists = op.Box.get(box_key)
        
        if not box_exists:
            return False
        
        return op.extract_uint64(ticket_status, 0) == UInt64(1)

    @abimethod()
    def toggle_sale(self) -> bool:
        """Toggle ticket sales on/off (organizer only)"""
        assert Txn.sender == self.organizer, "Only organizer can toggle"
        self.is_sale_active = not self.is_sale_active
        return self.is_sale_active

    @abimethod()
    def get_event_info(self) -> tuple[UInt64, UInt64, UInt64, UInt64, UInt64, UInt64, bool]:
        """Get event information"""
        return (
            self.ticket_price,
            self.max_supply,
            self.sold_count,
            self.event_date,
            self.sale_end_date,
            self.unique_buyers,
            self.is_sale_active
        )
    
    @abimethod(readonly=True)
    def get_organizer(self) -> Account:
        """Get event organizer address"""
        return self.organizer
