/**
 * MovementLog — sliding panel that shows the live RFID event feed.
 *
 * Mimics the "movement audit log" an operator would see in a real facility
 * tracking system.  Each row corresponds to one WebSocket broadcast from the
 * backend (in production: one RFID reader hand-off event).
 */

import { MoveEvent } from "../hooks/useAssetFeed";
import { theme } from "../theme";
import { ArrowRight, Radio } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  active:      theme.accent.primary,
  maintenance: theme.accent.warning,
  inactive:    theme.text.muted,
};

function relativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 5)  return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function MovementLog({
  moves,
  connected,
}: {
  moves: MoveEvent[];
  connected: boolean;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div>
          <h2 style={{ color: theme.text.primary, fontSize: 15, fontWeight: 600, margin: 0 }}>
            Movement Log
          </h2>
          <p style={{ color: theme.text.muted, fontSize: 12, margin: "2px 0 0 0" }}>
            Live RFID event feed
          </p>
        </div>

        {/* Connection indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Radio size={13} color={connected ? theme.accent.primary : theme.accent.danger} />
          <span style={{
            fontSize: 11,
            color: connected ? theme.accent.primary : theme.accent.danger,
          }}>
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </div>
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {moves.length === 0 ? (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: 0.5,
          }}>
            <Radio size={28} color={theme.text.muted} />
            <p style={{ color: theme.text.muted, fontSize: 12, margin: 0, textAlign: "center" }}>
              Waiting for asset movement…<br />
              Events appear here as assets move between zones.
            </p>
          </div>
        ) : (
          moves.map((move, i) => (
            <MoveRow key={`${move.asset_id}-${move.timestamp}-${i}`} move={move} />
          ))
        )}
      </div>
    </div>
  );
}

function MoveRow({ move }: { move: MoveEvent }) {
  const statusColor = STATUS_COLOR[move.asset_status] ?? theme.text.muted;

  return (
    <div style={{
      padding: "9px 11px",
      background: theme.bg.primary,
      borderRadius: 7,
      borderLeft: `3px solid ${statusColor}`,
      animation: "fadeIn 0.3s ease",
    }}>
      {/* Asset name + tag */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
        <span style={{ color: theme.text.primary, fontSize: 12, fontWeight: 600 }}>
          {move.asset_name}
        </span>
        <span style={{ color: theme.text.muted, fontSize: 10, flexShrink: 0, marginLeft: 8 }}>
          {relativeTime(move.timestamp)}
        </span>
      </div>

      {/* Zone movement */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <span style={{ color: theme.text.muted, fontSize: 11 }}>{move.from_zone_name}</span>
        <ArrowRight size={11} color={statusColor} style={{ flexShrink: 0 }} />
        <span style={{ color: theme.text.primary, fontSize: 11, fontWeight: 500 }}>{move.to_zone_name}</span>
      </div>

      {/* Tag */}
      <div style={{ marginTop: 4 }}>
        <span style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: statusColor,
          background: `${statusColor}15`,
          padding: "1px 6px",
          borderRadius: 4,
        }}>
          {move.asset_tag}
        </span>
      </div>
    </div>
  );
}
