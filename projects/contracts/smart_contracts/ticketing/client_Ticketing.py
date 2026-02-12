# This file is auto-generated, do not modify
# flake8: noqa
# fmt: off
import typing

import algopy


class Ticketing(algopy.arc4.ARC4Client, typing.Protocol):
    """

        CampusChain Ticketing Contract
        NFT-based event tickets with anti-scalping and entry verification
        Each deployment = one event (fully decentralized)
        Features:
        - Mints NFT ticket on purchase
        - QR code verification at entry
        - Prevents double entry
    
    """
    @algopy.arc4.abimethod(create='require')
    def create_event(
        self,
        price: algopy.arc4.UIntN[typing.Literal[64]],
        supply: algopy.arc4.UIntN[typing.Literal[64]],
        event_date: algopy.arc4.UIntN[typing.Literal[64]],
        sale_end_date: algopy.arc4.UIntN[typing.Literal[64]],
    ) -> algopy.arc4.UIntN[typing.Literal[64]]:
        """
        Create a new ticketed event (called during contract creation)
        """

    @algopy.arc4.abimethod
    def buy_ticket(
        self,
        payment: algopy.gtxn.PaymentTransaction,
    ) -> algopy.arc4.UIntN[typing.Literal[64]]:
        """
        Purchase an event ticket - Mints NFT to buyer
        Returns the NFT Asset ID
        """

    @algopy.arc4.abimethod
    def verify_entry(
        self,
        ticket_holder: algopy.Account,
        ticket_asset_id: algopy.arc4.UIntN[typing.Literal[64]],
    ) -> algopy.arc4.Bool:
        """
        Verify ticket at event entry (called by organizer/staff)
        Checks NFT ownership and check-in status
        """

    @algopy.arc4.abimethod(readonly=True)
    def is_checked_in(
        self,
        ticket_asset_id: algopy.arc4.UIntN[typing.Literal[64]],
    ) -> algopy.arc4.Bool:
        """
        Check if a ticket has been used for entry
        """

    @algopy.arc4.abimethod
    def toggle_sale(
        self,
    ) -> algopy.arc4.Bool:
        """
        Toggle ticket sales on/off (organizer only)
        """

    @algopy.arc4.abimethod
    def get_event_info(
        self,
    ) -> algopy.arc4.Tuple[algopy.arc4.UIntN[typing.Literal[64]], algopy.arc4.UIntN[typing.Literal[64]], algopy.arc4.UIntN[typing.Literal[64]], algopy.arc4.UIntN[typing.Literal[64]], algopy.arc4.UIntN[typing.Literal[64]], algopy.arc4.UIntN[typing.Literal[64]], algopy.arc4.Bool]:
        """
        Get event information
        """

    @algopy.arc4.abimethod(readonly=True)
    def get_organizer(
        self,
    ) -> algopy.arc4.Address:
        """
        Get event organizer address
        """
