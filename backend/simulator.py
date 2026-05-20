"""
simulator.py — RFID Asset Movement Simulator

In production this module would be replaced by a UDP listener service that
receives packets from ceiling-mounted RFID readers and writes asset zone
changes to the database.  Those changes would then be broadcast to connected
WebSocket clients.

For demo purposes we replicate that behaviour with a coroutine that:
  1. Wakes up every 10-25 seconds (randomised so it feels organic)
  2. Picks 1-3 random assets
  3. Moves each one to a different zone (simulating RFID reader hand-offs)
  4. Broadcasts a structured event to every connected WebSocket client

The broadcast payload mirrors what a real UDP→DB→push pipeline would emit.
"""

import asyncio
import json
import logging
import random
from datetime import datetime, timezone
from typing import Set

from fastapi import WebSocket
from database import SessionLocal
from models import Asset, Zone

log = logging.getLogger("vigilance.simulator")


class AssetSimulator:
    """
    Holds the set of live WebSocket connections and drives the simulation loop.

    Attributes
    ----------
    subscribers : set of WebSocket
        Every browser tab that has connected to /ws.  The set shrinks when
        tabs close (WebSocketDisconnect) and grows as new ones connect.
    running : bool
        Controls the simulation loop.  Set to False in the lifespan teardown.
    """

    def __init__(self) -> None:
        self.subscribers: Set[WebSocket] = set()
        self.running = False

    # ── Public API ────────────────────────────────────────────────────────────

    async def start(self) -> None:
        """Drive the simulation loop.  Call this as an asyncio task."""
        self.running = True
        log.info("Asset simulator started — broadcasting moves to WebSocket clients")
        while self.running:
            # Random interval: feels more like real sporadic RFID reads
            await asyncio.sleep(random.uniform(10, 25))
            try:
                await self._move_random_assets()
            except Exception:
                log.exception("Simulator tick failed")

    def stop(self) -> None:
        self.running = False

    def add_subscriber(self, ws: WebSocket) -> None:
        self.subscribers.add(ws)
        log.debug("WebSocket subscriber added — total: %d", len(self.subscribers))

    def remove_subscriber(self, ws: WebSocket) -> None:
        self.subscribers.discard(ws)
        log.debug("WebSocket subscriber removed — total: %d", len(self.subscribers))

    # ── Simulation core ───────────────────────────────────────────────────────

    async def _move_random_assets(self) -> None:
        """
        Pick 1-3 assets at random and move each to a different zone.
        After each move, broadcast an event to all subscribers.
        """
        db = SessionLocal()
        try:
            assets = db.query(Asset).all()
            zones  = db.query(Zone).all()

            if not assets or len(zones) < 2:
                return

            # Move between 1 and 3 assets per tick
            count = random.randint(1, min(3, len(assets)))
            chosen = random.sample(assets, count)

            for asset in chosen:
                other_zones = [z for z in zones if z.id != asset.zone_id]
                if not other_zones:
                    continue

                new_zone  = random.choice(other_zones)
                old_zone  = next((z for z in zones if z.id == asset.zone_id), None)

                event = {
                    "type":           "asset_moved",
                    "asset_id":       asset.id,
                    "asset_tag":      asset.asset_tag,
                    "asset_name":     asset.name,
                    "asset_status":   asset.status,
                    "from_zone_id":   old_zone.id   if old_zone else None,
                    "from_zone_name": old_zone.name if old_zone else "Unknown",
                    "to_zone_id":     new_zone.id,
                    "to_zone_name":   new_zone.name,
                    # ISO-8601 UTC — front-end formats this for the user's locale
                    "timestamp":      datetime.now(timezone.utc).isoformat(),
                }

                # Commit the move to Postgres
                asset.zone_id = new_zone.id
                db.commit()

                log.info(
                    "MOVE  %s  %s → %s",
                    asset.asset_tag,
                    event["from_zone_name"],
                    event["to_zone_name"],
                )

                # Broadcast — don't await each send sequentially; fan-out in parallel
                await self._broadcast(event)

        finally:
            db.close()

    async def _broadcast(self, payload: dict) -> None:
        """
        Send payload to every subscriber.  Remove dead connections silently.
        Uses asyncio.gather so a slow client doesn't block others.
        """
        if not self.subscribers:
            return

        text = json.dumps(payload)
        dead: Set[WebSocket] = set()

        async def _send(ws: WebSocket) -> None:
            try:
                await ws.send_text(text)
            except Exception:
                dead.add(ws)

        await asyncio.gather(*(_send(ws) for ws in self.subscribers))
        self.subscribers -= dead


# Module-level singleton — imported by main.py
simulator = AssetSimulator()
