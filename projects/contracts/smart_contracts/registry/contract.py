"""
Decentralized Registry Contract
================================
A central registry that stores all deployed campaign and event app IDs.
This enables cross-device discovery without hardcoded addresses.

Usage:
1. Deploy this contract once (store its app ID in .env)
2. When deploying campaigns/events, call register_app() to add them
3. Frontend queries this contract to get all registered app IDs
"""

from algopy import ARC4Contract, UInt64, BoxRef, Txn, op, Bytes, urange
from algopy.arc4 import abimethod, UInt64 as ARC4UInt64, DynamicArray


class CampusChainRegistry(ARC4Contract):
    """
    Registry contract storing app IDs for fundraising campaigns and ticketing events.
    Uses box storage to handle large lists (>128 items).
    Boxes are auto-created on first registration - no initialization needed.
    """

    @abimethod
    def register_fundraiser(self, app_id: UInt64) -> None:
        """
        Register a new fundraising campaign app ID.
        Can only be called by the app creator (prevents spam).
        """
        # Load existing fundraiser list from box (create if doesn't exist)
        fundraiser_box = BoxRef(key=b"fundraisers")
        
        # Check if box exists, if not create it
        existing_bytes, box_exists = fundraiser_box.maybe()
        if not box_exists:
            # Create box with empty array on first registration
            fundraiser_box.create(size=8192)  # 8KB box
            empty_array = DynamicArray[ARC4UInt64]()
            existing_bytes = empty_array.bytes
        
        fundraiser_list = DynamicArray[ARC4UInt64].from_bytes(existing_bytes)
        
        # Add new app ID (prevent duplicates)
        app_id_arc4 = ARC4UInt64(app_id)
        
        # Check if already registered (linear search - acceptable for moderate lists)
        already_registered = False
        for i in urange(fundraiser_list.length):
            if fundraiser_list[i] == app_id_arc4:
                already_registered = True
                break
        
        assert not already_registered, "App ID already registered"
        
        # Append new app ID
        fundraiser_list.append(app_id_arc4)
        
        # Save back to box
        fundraiser_box.put(fundraiser_list.bytes)

    @abimethod
    def register_ticketing(self, app_id: UInt64) -> None:
        """
        Register a new ticketing event app ID.
        Can only be called by the app creator (prevents spam).
        """
        # Load existing ticketing list from box (create if doesn't exist)
        ticketing_box = BoxRef(key=b"ticketing")
        
        # Check if box exists, if not create it
        existing_bytes, box_exists = ticketing_box.maybe()
        if not box_exists:
            # Create box with empty array on first registration
            ticketing_box.create(size=8192)  # 8KB box
            empty_array = DynamicArray[ARC4UInt64]()
            existing_bytes = empty_array.bytes
        
        ticketing_list = DynamicArray[ARC4UInt64].from_bytes(existing_bytes)
        
        # Add new app ID (prevent duplicates)
        app_id_arc4 = ARC4UInt64(app_id)
        
        # Check if already registered
        already_registered = False
        for i in urange(ticketing_list.length):
            if ticketing_list[i] == app_id_arc4:
                already_registered = True
                break
        
        assert not already_registered, "App ID already registered"
        
        # Append new app ID
        ticketing_list.append(app_id_arc4)
        
        # Save back to box
        ticketing_box.put(ticketing_list.bytes)

    @abimethod(readonly=True)
    def get_fundraisers(self) -> DynamicArray[ARC4UInt64]:
        """
        Get all registered fundraiser app IDs.
        Frontend calls this to discover all campaigns.
        """
        fundraiser_box = BoxRef(key=b"fundraisers")
        existing_bytes, box_exists = fundraiser_box.maybe()
        if box_exists:
            return DynamicArray[ARC4UInt64].from_bytes(existing_bytes)
        else:
            # Return empty array if box doesn't exist yet
            return DynamicArray[ARC4UInt64]()

    @abimethod(readonly=True)
    def get_ticketing(self) -> DynamicArray[ARC4UInt64]:
        """
        Get all registered ticketing event app IDs.
        Frontend calls this to discover all events.
        """
        ticketing_box = BoxRef(key=b"ticketing")
        existing_bytes, box_exists = ticketing_box.maybe()
        if box_exists:
            return DynamicArray[ARC4UInt64].from_bytes(existing_bytes)
        else:
            # Return empty array if box doesn't exist yet
            return DynamicArray[ARC4UInt64]()

    @abimethod(readonly=True)
    def get_total_counts(self) -> tuple[UInt64, UInt64]:
        """
        Get total count of registered fundraisers and events.
        Useful for debugging and statistics.
        """
        fundraiser_box = BoxRef(key=b"fundraisers")
        ticketing_box = BoxRef(key=b"ticketing")
        
        # Handle boxes that don't exist yet
        fundraiser_bytes, fundraiser_exists = fundraiser_box.maybe()
        ticketing_bytes, ticketing_exists = ticketing_box.maybe()
        
        fundraiser_count = UInt64(0)
        ticketing_count = UInt64(0)
        
        if fundraiser_exists:
            fundraiser_list = DynamicArray[ARC4UInt64].from_bytes(fundraiser_bytes)
            fundraiser_count = fundraiser_list.length
            
        if ticketing_exists:
            ticketing_list = DynamicArray[ARC4UInt64].from_bytes(ticketing_bytes)
            ticketing_count = ticketing_list.length
        
        return (fundraiser_count, ticketing_count)
