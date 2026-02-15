from algopy import *
from algopy.arc4 import abimethod, Address


class Ticketing(ARC4Contract):
    """
    Citadel Multi-Organizer Ticketing Contract
    NFT-based event tickets with anti-scalping and entry verification
    Each deployment = one event (fully decentralized)
    Features:
    - Mints NFT ticket on purchase
    - Multi-organizer support (creator can add up to 10 organizers)
    - All organizers can scan tickets and verify entry
    - QR code verification at entry
    - Prevents double entry
    - 110% anti-scalping resale cap enforced on-chain
    """

    ticket_price: UInt64
    max_supply: UInt64
    sold_count: UInt64
    event_date: UInt64
    sale_end_date: UInt64
    is_sale_active: bool
    creator: Account
    unique_buyers: UInt64
    organizer_count: UInt64

    @abimethod(allow_actions=['NoOp'], create='require')
    def create_event(
        self, 
        price: UInt64, 
        supply: UInt64, 
        event_date: UInt64, 
        sale_end_date: UInt64
    ) -> UInt64:
        """
        Create a new ticketed event
        Additional organizers can be added after creation using add_organizer()
        """
        self.ticket_price = price
        self.max_supply = supply
        self.sold_count = UInt64(0)
        self.event_date = event_date
        self.sale_end_date = sale_end_date
        self.creator = Txn.sender
        self.is_sale_active = True
        self.unique_buyers = UInt64(0)
        self.organizer_count = UInt64(0)
        return UInt64(1)
    
    @abimethod()
    def add_organizer(self, organizer_address: Address) -> UInt64:
        """
        Add an organizer who can scan tickets (creator only)
        Stores organizer in box with key "org_{index}"
        Requires box MBR funding before calling (20,100 microAlgos per organizer)
        Returns the organizer index
        """
        assert Txn.sender == self.creator, "Only creator can add organizers"
        assert self.organizer_count < UInt64(10), "Maximum 10 organizers allowed"
        
        # Create box key from current count
        current_index = self.organizer_count
        box_key = b"org_" + op.itob(current_index)
        
        # Create box (32 bytes for address) and store organizer
        # Box MBR: 2500 + 400 * (12 + 32) = 20,100 microAlgos
        assert op.Box.create(box_key, 32), "Failed to create organizer box"
        op.Box.put(box_key, organizer_address.bytes)
        
        self.organizer_count += UInt64(1)
        return current_index

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
        Verify ticket at event entry (called by creator or any organizer)
        Checks NFT ownership and check-in status
        All organizers have permission to scan and verify tickets
        """
        # Check if sender is creator or one of the organizers
        sender = Txn.sender
        is_authorized = sender == self.creator
        
        # Check organizers from box storage
        if not is_authorized:
            for i in urange(self.organizer_count):
                box_key = b"org_" + op.itob(i)
                organizer_bytes, exists = op.Box.get(box_key)
                if exists:
                    organizer = Account(organizer_bytes)
                    if sender == organizer:
                        is_authorized = True
                        break
        
        assert is_authorized, "Only creator or organizers can verify"
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
        """Toggle ticket sales on/off (creator or organizers only)"""
        # Check if sender is creator or one of the organizers
        sender = Txn.sender
        is_authorized = sender == self.creator
        
        # Check organizers from box storage
        if not is_authorized:
            for i in urange(self.organizer_count):
                box_key = b"org_" + op.itob(i)
                organizer_bytes, exists = op.Box.get(box_key)
                if exists:
                    organizer = Account(organizer_bytes)
                    if sender == organizer:
                        is_authorized = True
                        break
        
        assert is_authorized, "Only creator or organizers can toggle"
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
        """Get event creator address (main organizer)"""
        return self.creator
    
    @abimethod(readonly=True)
    def get_organizer_by_index(self, index: UInt64) -> Address:
        """
        Get organizer address by index
        Returns zero address if index is out of bounds
        """
        if index >= self.organizer_count:
            return Address()  # Return zero address
        
        box_key = b"org_" + op.itob(index)
        organizer_bytes, exists = op.Box.get(box_key)
        
        if exists:
            return Address(organizer_bytes)
        return Address()  # Return zero address if not found
    
    @abimethod(readonly=True)
    def get_organizer_count(self) -> UInt64:
        """Get the number of additional organizers"""
        return self.organizer_count
    
    @abimethod(readonly=True)
    def is_organizer(self, address: Address) -> bool:
        """Check if an address is an organizer"""
        account = address.native
        
        if account == self.creator:
            return True
        
        # Check organizers from box storage
        for i in urange(self.organizer_count):
            box_key = b"org_" + op.itob(i)
            organizer_bytes, exists = op.Box.get(box_key)
            if exists:
                organizer = Account(organizer_bytes)
                if account == organizer:
                    return True
        
        return False

    # ── Anti-Scalping Resale Methods ──────────────────────────────────────

    @abimethod()
    def transfer_ticket(
        self,
        ticket_asset_id: UInt64,
        new_owner: Account,
        sale_price: UInt64,
        payment: gtxn.PaymentTransaction,
    ) -> bool:
        """
        Transfer (resell) a ticket to a new owner with 110% anti-scalping cap.
        The seller calls this method; the grouped payment goes to the seller.
        The contract enforces that sale_price <= 110% of original ticket_price.
        Uses clawback to move the NFT from seller to buyer.
        Records the transfer in box storage for provenance tracking.
        """
        # ── Price cap: max resale = ticket_price + ticket_price / 10 (110%) ──
        max_resale = self.ticket_price + self.ticket_price // UInt64(10)
        assert sale_price <= max_resale, "Resale price exceeds 110% cap"

        # ── Verify payment matches the sale_price and goes to seller ──
        assert payment.amount >= sale_price, "Payment less than sale price"
        assert payment.receiver == Txn.sender, "Payment must go to seller"

        # ── Verify seller actually holds the ticket NFT ──
        seller_balance, seller_opted = op.AssetHoldingGet.asset_balance(
            Txn.sender, ticket_asset_id
        )
        assert seller_opted and seller_balance == UInt64(1), "Seller does not hold ticket"

        # ── Verify buyer has opted into the asset ──
        buyer_balance, buyer_opted = op.AssetHoldingGet.asset_balance(
            new_owner, ticket_asset_id
        )
        assert buyer_opted, "Buyer must opt-in to asset first"

        # ── Verify ticket has NOT already been used for entry ──
        checkin_key = op.itob(ticket_asset_id)
        checkin_status, checkin_exists = op.Box.get(checkin_key)
        if checkin_exists:
            assert op.extract_uint64(checkin_status, 0) == UInt64(0), "Ticket already used"

        # ── Clawback-transfer NFT from seller → buyer ──
        itxn.AssetTransfer(
            asset_sender=Txn.sender,
            asset_receiver=new_owner,
            asset_amount=1,
            xfer_asset=ticket_asset_id,
        ).submit()

        # ── Update the reserve field to reflect new owner ──
        itxn.AssetConfig(
            config_asset=ticket_asset_id,
            manager=Global.current_application_address,
            reserve=new_owner,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
        ).submit()

        # ── Record sale in box storage for history / provenance ──
        # Box key: "sale_" + itob(ticket_asset_id) + itob(transfer_count)
        history_count_key = b"xfr_" + op.itob(ticket_asset_id)
        count_bytes, count_exists = op.Box.get(history_count_key)
        transfer_index = UInt64(0)
        if count_exists:
            transfer_index = op.extract_uint64(count_bytes, 0)

        # Create the history entry box: seller(32) + buyer(32) + price(8) + timestamp(8) = 80 bytes
        history_key = b"sh_" + op.itob(ticket_asset_id) + op.itob(transfer_index)
        assert op.Box.create(history_key, 80), "Failed to create history box"
        op.Box.replace(history_key, 0, Txn.sender.bytes)
        op.Box.replace(history_key, 32, new_owner.bytes)
        op.Box.replace(history_key, 64, op.itob(sale_price))
        op.Box.replace(history_key, 72, op.itob(Global.latest_timestamp))

        # Increment transfer counter
        if count_exists:
            op.Box.put(history_count_key, op.itob(transfer_index + UInt64(1)))
        else:
            assert op.Box.create(history_count_key, 8), "Failed to create counter box"
            op.Box.put(history_count_key, op.itob(UInt64(1)))

        return True

    @abimethod(readonly=True)
    def get_max_resale_price(self) -> UInt64:
        """
        Returns the maximum allowed resale price (110% of original ticket price).
        This is enforced on-chain in transfer_ticket.
        """
        return self.ticket_price + self.ticket_price // UInt64(10)

    @abimethod(readonly=True)
    def get_transfer_count(self, ticket_asset_id: UInt64) -> UInt64:
        """Get the number of times a ticket has been resold"""
        history_count_key = b"xfr_" + op.itob(ticket_asset_id)
        count_bytes, count_exists = op.Box.get(history_count_key)
        if count_exists:
            return op.extract_uint64(count_bytes, 0)
        return UInt64(0)

    @abimethod(readonly=True)
    def get_sale_history(
        self, ticket_asset_id: UInt64, index: UInt64
    ) -> tuple[Address, Address, UInt64, UInt64]:
        """
        Get a specific sale history entry for a ticket.
        Returns (seller, buyer, price, timestamp).
        """
        history_key = b"sh_" + op.itob(ticket_asset_id) + op.itob(index)
        history_bytes, exists = op.Box.get(history_key)
        assert exists, "History entry not found"

        seller = Address(op.extract(history_bytes, 0, 32))
        buyer = Address(op.extract(history_bytes, 32, 32))
        price = op.extract_uint64(history_bytes, 64)
        timestamp = op.extract_uint64(history_bytes, 72)

        return seller, buyer, price, timestamp
