import { MapPin } from "lucide-react";
import { Zone } from "../types";

interface ZonePanelProps {
  zones: Zone[];
  selectedZoneId: number | null;
  onZoneClick: (zoneId: number | null) => void;
}

const ZONE_COLORS: Record<string, string> = {
  maintenance: "#3b82f6",
  storage: "#8b5cf6",
  operations: "#ec4899",
  admin: "#f59e0b",
  transit: "#64748b",
};

export default function ZonePanel({ zones, selectedZoneId, onZoneClick }: ZonePanelProps) {
  const totalAssets = zones.reduce((sum, z) => sum + z.asset_count, 0);

  return (
    <div style={{ background: "#0f172a", borderRadius: 12, padding: 16, height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: 16, fontWeight: 600 }}>Zones</h2>
        <span style={{ color: "#64748b", fontSize: 13 }}>{totalAssets} total assets</span>
      </div>

      {selectedZoneId && (
        <button
          onClick={() => onZoneClick(null)}
          style={{
            width: "100%",
            padding: "6px 12px",
            marginBottom: 12,
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 6,
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Clear filter
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {zones.map((zone) => {
          const color = ZONE_COLORS[zone.zone_type || ""] || "#64748b";
          const isSelected = zone.id === selectedZoneId;

          return (
            <div
              key={zone.id}
              onClick={() => onZoneClick(zone.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: isSelected ? `${color}22` : "#1e293b",
                border: `1px solid ${isSelected ? color : "#334155"}`,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MapPin size={14} color={color} />
                  <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>
                    {zone.name}
                  </span>
                </div>
                <span
                  style={{
                    background: `${color}33`,
                    color: color,
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {zone.asset_count}
                </span>
              </div>
              <div style={{ color: "#64748b", fontSize: 11, marginTop: 4, marginLeft: 22 }}>
                {zone.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
