/**
 * useAssetFeed.ts
 *
 * Maintains a persistent WebSocket connection to the backend /ws endpoint.
 * When an "asset_moved" event arrives the hook updates the local asset list
 * in-place (no full re-fetch needed) and appends to a movement log.
 *
 * Usage
 * -----
 *   const { assets, moves, connected } = useAssetFeed(initialAssets);
 *
 * The caller provides the initial asset list (fetched via REST on page load).
 * After that the WebSocket keeps the list current without any polling.
 *
 * Why WebSocket instead of polling?
 * ----------------------------------
 * Polling every N seconds introduces up to N seconds of lag and hammers the
 * server with constant HTTP requests.  A WebSocket is a single persistent TCP
 * connection — when the backend broadcasts a move event it arrives at the
 * browser in milliseconds.  This mirrors how a real RFID system works: the
 * reader emits a UDP packet, the listener writes to Postgres and pushes the
 * change to connected clients instantly.
 */

import { useEffect, useRef, useState } from "react";
import { Asset } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoveEvent {
  type:           "asset_moved";
  asset_id:       number;
  asset_tag:      string;
  asset_name:     string;
  asset_status:   string;
  from_zone_id:   number | null;
  from_zone_name: string;
  to_zone_id:     number;
  to_zone_name:   string;
  timestamp:      string;   // ISO-8601 UTC
}

interface FeedState {
  assets:    Asset[];
  moves:     MoveEvent[];   // most-recent first, capped at 50
  connected: boolean;
}

const WS_URL      = "ws://localhost:8000/ws";
const MAX_LOG     = 50;      // keep the last 50 movements in memory
const RECONNECT_MS = 3000;   // retry delay after unexpected disconnect

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAssetFeed(initialAssets: Asset[]): FeedState {
  const [assets, setAssets]       = useState<Asset[]>(initialAssets);
  const [moves, setMoves]         = useState<MoveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  // Keep a ref so the effect closure always sees the latest initialAssets
  // without needing to re-run the effect (which would reconnect the socket).
  const initialRef = useRef(initialAssets);

  // Sync the assets list when the parent re-fetches (e.g. after page reload)
  useEffect(() => {
    initialRef.current = initialAssets;
    setAssets(initialAssets);
  }, [initialAssets]);

  useEffect(() => {
    let ws: WebSocket;
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      if (cancelled) return;

      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (!cancelled) setConnected(true);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (cancelled) return;
        try {
          const data: MoveEvent = JSON.parse(event.data as string);

          if (data.type === "asset_moved") {
            // Update the local asset list — no round-trip to the server needed
            setAssets((prev) =>
              prev.map((a) =>
                a.id === data.asset_id
                  ? { ...a, zone_id: data.to_zone_id, zone_name: data.to_zone_name }
                  : a,
              ),
            );

            // Prepend to movement log, cap at MAX_LOG
            setMoves((prev) => [data, ...prev].slice(0, MAX_LOG));
          }
        } catch {
          // Malformed message — ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          // Auto-reconnect after a short delay.
          // In production you would use exponential back-off.
          retryTimeout = setTimeout(connect, RECONNECT_MS);
        }
      };

      ws.onerror = () => {
        ws.close(); // triggers onclose → reconnect
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      ws?.close();
    };
  }, []); // deliberately empty — connect once, reconnect internally

  return { assets, moves, connected };
}
