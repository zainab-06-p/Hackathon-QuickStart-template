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

from algopy import ARC4Contract, UInt64, BoxRef, Txn, op
from algopy.arc4 import abimethod, UInt64 as ARC4UInt64, DynamicArray


class CampusChainRegistry(ARC4Contract):
    """
    Registry contract storing app IDs for fundraising campaigns and ticketing events.
    Uses box storage to handle large lists (>128 items).
    """

    @abimethod(create="require")
    def create_registry(self) -> None:
        """Initialize the registry with empty lists"""
        # Initialize box storage for fundraiser and ticketing app IDs
        # Box names: 'fundraisers' and 'ticketing'
        fundraiser_box = BoxRef(key=b"fundraisers")
        ticketing_box = BoxRef(key=b"ticketing")
        
        # Create empty dynamic arrays (stored as ARC4 encoded bytes)
        empty_fundraisers = DynamicArray[ARC4UInt64]()
        empty_ticketing = DynamicArray[ARC4UInt64]()
        
        # Store in boxes (create boxes with initial empty arrays)
        fundraiser_box.create(size=8192)  # 8KB box (can hold ~1000 uint64s)
        ticketing_box.create(size=8192)
        
        fundraiser_box.put(empty_fundraisers.bytes)
        ticketing_box.put(empty_ticketing.bytes)

    @abimethod
    def register_fundraiser(self, app_id: UInt64) -> None:
        """
        Register a new fundraising campaign app ID.
        Can only be called by the app creator (prevents spam).
        """
        # Load existing fundraiser list from box
        fundraiser_box = BoxRef(key=b"fundraisers")
        existing_bytes = fundraiser_box.get()
        
        fundraiser_list = DynamicArray[ARC4UInt64].from_bytes(existing_bytes)
        
        # Add new app ID (prevent duplicates)
        app_id_arc4 = ARC4UInt64(app_id)
        
        # Check if already registered (linear search - acceptable for moderate lists)
        already_registered = False
        for i in range(fundraiser_list.length):
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
        # Load existing ticketing list from box
        ticketing_box = BoxRef(key=b"ticketing")
        existing_bytes = ticketing_box.get()
        
        ticketing_list = DynamicArray[ARC4UInt64].from_bytes(existing_bytes)
        
        # Add new app ID (prevent duplicates)
        app_id_arc4 = ARC4UInt64(app_id)
        
        # Check if already registered
        already_registered = False
        for i in range(ticketing_list.length):
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
        existing_bytes = fundraiser_box.get()
        return DynamicArray[ARC4UInt64].from_bytes(existing_bytes)

    @abimethod(readonly=True)
    def get_ticketing(self) -> DynamicArray[ARC4UInt64]:
        """
        Get all registered ticketing event app IDs.
        Frontend calls this to discover all events.
        """
        ticketing_box = BoxRef(key=b"ticketing")
        existing_bytes = ticketing_box.get()
        return DynamicArray[ARC4UInt64].from_bytes(existing_bytes)

    @abimethod(readonly=True)
    def get_total_counts(self) -> tuple[UInt64, UInt64]:
        """
        Get total count of registered fundraisers and events.
        Useful for debugging and statistics.
        """
        fundraiser_box = BoxRef(key=b"fundraisers")
        ticketing_box = BoxRef(key=b"ticketing")
        
        fundraiser_list = DynamicArray[ARC4UInt64].from_bytes(fundraiser_box.get())
        ticketing_list = DynamicArray[ARC4UInt64].from_bytes(ticketing_box.get())
        
        return (fundraiser_list.length, ticketing_list.length)
