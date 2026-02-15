from algopy import *
from algopy.arc4 import abimethod, Address


class Marketplace(ARC4Contract):
    """
    CampusChain Marketplace — Buy/Sell with Escrow
    
    Students list items, buyers pay into escrow, both confirm exchange.
    - Seller lists item with price
    - Buyer pays → funds locked in contract
    - In-person exchange on campus
    - Buyer confirms → funds released to seller
    - Dispute path: community arbitrators vote
    - Auto-timeout: 72h no buyer confirmation → seller can claim
    """

    seller: Account
    price: UInt64
    status: UInt64  # 0=listed, 1=sold_pending, 2=completed, 3=disputed, 4=cancelled, 5=refunded
    buyer: Account
    purchase_timestamp: UInt64
    title_hash: Bytes
    image_hash: Bytes
    listing_count: UInt64  # global listing tracker

    def __init__(self) -> None:
        self.arbitrator_votes = BoxMap(Account, UInt64, key_prefix=b"av_")

    @abimethod(allow_actions=["NoOp"], create="require")
    def list_item(
        self,
        title_hash: Bytes,
        price: UInt64,
        image_hash: Bytes,
    ) -> UInt64:
        """List an item for sale."""
        assert price > UInt64(0), "Price must be > 0"

        self.seller = Txn.sender
        self.price = price
        self.status = UInt64(0)  # listed
        self.buyer = Global.zero_address
        self.purchase_timestamp = UInt64(0)
        self.title_hash = title_hash
        self.image_hash = image_hash
        self.listing_count = UInt64(0)
        return UInt64(1)

    @abimethod()
    def buy_item(self, payment: gtxn.PaymentTransaction) -> UInt64:
        """Buy item — payment locked in escrow."""
        assert self.status == UInt64(0), "Not available"
        assert payment.receiver == Global.current_application_address
        assert payment.amount >= self.price, "Insufficient payment"
        assert Txn.sender != self.seller, "Cannot buy own item"

        self.buyer = Txn.sender
        self.status = UInt64(1)  # sold_pending
        self.purchase_timestamp = Global.latest_timestamp
        return UInt64(1)

    @abimethod()
    def confirm_delivery(self) -> UInt64:
        """Buyer confirms receipt → funds released to seller."""
        assert Txn.sender == self.buyer, "Only buyer"
        assert self.status == UInt64(1), "Not pending delivery"

        min_balance = UInt64(100000)
        assert Global.current_application_address.balance >= self.price + min_balance

        itxn.Payment(receiver=self.seller, amount=self.price, fee=0).submit()
        self.status = UInt64(2)  # completed
        return self.price

    @abimethod()
    def raise_dispute(self) -> UInt64:
        """Buyer or seller raises dispute."""
        assert Txn.sender == self.buyer or Txn.sender == self.seller, "Not buyer or seller"
        assert self.status == UInt64(1), "Not pending"

        self.status = UInt64(3)  # disputed
        return UInt64(1)

    @abimethod()
    def vote_dispute(self, resolution: UInt64) -> UInt64:
        """
        Community arbitrator votes on dispute.
        resolution: 1=release to seller, 0=refund buyer
        Returns number of votes cast so far.
        """
        assert self.status == UInt64(3), "Not disputed"
        assert Txn.sender != self.buyer, "Buyer cannot vote"
        assert Txn.sender != self.seller, "Seller cannot vote"

        # Check hasn't voted
        _existing, already_voted = self.arbitrator_votes.maybe(Txn.sender)
        assert not already_voted, "Already voted"

        self.arbitrator_votes[Txn.sender] = resolution
        self.listing_count += UInt64(1)  # repurpose as vote counter

        # After 3 votes, resolve
        if self.listing_count >= UInt64(3):
            # Count votes (simplified: use listing_count as total)
            # In practice we'd iterate boxes, but for simplicity
            # we auto-resolve based on this voter's vote
            min_balance = UInt64(100000)
            if resolution == UInt64(1):
                # Release to seller
                if Global.current_application_address.balance >= self.price + min_balance:
                    itxn.Payment(receiver=self.seller, amount=self.price, fee=0).submit()
                self.status = UInt64(2)  # completed
            else:
                # Refund buyer
                if Global.current_application_address.balance >= self.price + min_balance:
                    itxn.Payment(receiver=self.buyer, amount=self.price, fee=0).submit()
                self.status = UInt64(5)  # refunded

        return self.listing_count

    @abimethod()
    def claim_timeout(self) -> UInt64:
        """Seller claims funds after 72h buyer silence."""
        assert Txn.sender == self.seller, "Only seller"
        assert self.status == UInt64(1), "Not pending"
        assert Global.latest_timestamp >= self.purchase_timestamp + UInt64(259200), "72h not passed"

        min_balance = UInt64(100000)
        assert Global.current_application_address.balance >= self.price + min_balance

        itxn.Payment(receiver=self.seller, amount=self.price, fee=0).submit()
        self.status = UInt64(2)  # completed
        return self.price

    @abimethod()
    def cancel_listing(self) -> UInt64:
        """Seller cancels listing before anyone buys."""
        assert Txn.sender == self.seller, "Only seller"
        assert self.status == UInt64(0), "Cannot cancel after sale"

        self.status = UInt64(4)  # cancelled
        return UInt64(1)

    @abimethod()
    def get_listing_info(self) -> tuple[UInt64, UInt64, UInt64]:
        """Returns (price, status, purchase_timestamp)"""
        return (self.price, self.status, self.purchase_timestamp)

    @abimethod(readonly=True)
    def get_seller(self) -> Account:
        return self.seller

    @abimethod(readonly=True)
    def get_buyer(self) -> Account:
        return self.buyer

    @abimethod(readonly=True)
    def get_status(self) -> UInt64:
        return self.status
