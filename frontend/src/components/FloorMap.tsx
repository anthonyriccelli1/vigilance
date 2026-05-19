import { Zone } from "../types";

interface FloorMapProps {
  zones: Zone[];
  selectedZoneId: number | null;
  onZoneClick: (zoneId: number) => void;
}

const ZONE_LAYOUT: Record<number, { x: number; y: number; w: number; h: number; color: string }> = {
  1: { x: 20, y: 20, w: 280, h: 180, color: "#3b82f6" },
  2: { x: 320, y: 20, w: 280, h: 180, color: "#6366f1" },
  3: { x: 620, y: 20, w: 200, h: 180, color: "#8b5cf6" },
  4: { x: 620, y: 220, w: 200, h: 180, color: "#a855f7" },
  5: { x: 20, y: 220, w: 280, h: 180, color: "#ec4899" },
  6: { x: 320, y: 220, w: 280, h: 80, color: "#f59e0b" },
  7: { x: 320, y: 320, w: 280, h: 80, color: "#10b981" },
  8: { x: 20, y: 420, w: 800, h: 60, color: "#64748b" },
};

export default function FloorMap({ zones, selectedZoneId, onZoneClick }: FloorMapProps) {
  return (
    <div style={{ background: "#0f172a", borderRadius: 12, padding: 16 }}>
      <h2 style={{ color: "#e2e8f0", margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
        Facility Floor Map
      </h2>
      <svg viewBox="0 0 840 500" style={{ width: "100%", height: "auto" }}>
        {zones.map((zone) => {
          const layout = ZONE_LAYOUT[zone.id];
          if (!layout) return null;
          const isSelected = zone.id === selectedZoneId;

          return (
            <g
              key={zone.id}
              onClick={() => onZoneClick(zone.id)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={layout.x}
                y={layout.y}
                width={layout.w}
                height={layout.h}
                rx={8}
                fill={isSelected ? layout.color : `${layout.color}33`}
                stroke={layout.color}
                strokeWidth={isSelected ? 3 : 1.5}
              />
              <text
                x={layout.x + layout.w / 2}
                y={layout.y + layout.h / 2 - 10}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize={13}
                fontWeight={600}
              >
                {zone.name}
              </text>
              <text
                x={layout.x + layout.w / 2}
                y={layout.y + layout.h / 2 + 12}
                textAnchor="middle"
                fill={layout.color}
                fontSize={22}
                fontWeight={700}
              >
                {zone.asset_count}
              </text>
              <text
                x={layout.x + layout.w / 2}
                y={layout.y + layout.h / 2 + 30}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={11}
              >
                assets
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
