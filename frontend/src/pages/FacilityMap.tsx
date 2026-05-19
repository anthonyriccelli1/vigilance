import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router";
import { ArrowLeft, Package, ChevronRight } from "lucide-react";
import { api } from "../api";
import { Zone, Asset } from "../types";
import { theme } from "../theme";

const ZONE_LAYOUT: Record<number, { x: number; y: number; w: number; h: number }> = {
  1: { x: 20, y: 20, w: 280, h: 180 },
  2: { x: 320, y: 20, w: 280, h: 180 },
  3: { x: 620, y: 20, w: 200, h: 180 },
  4: { x: 620, y: 220, w: 200, h: 180 },
  5: { x: 20, y: 220, w: 280, h: 180 },
  6: { x: 320, y: 220, w: 280, h: 80 },
  7: { x: 320, y: 320, w: 280, h: 80 },
  8: { x: 20, y: 420, w: 800, h: 60 },
};

const ZONE_COLORS: Record<string, string> = {
  maintenance: "#10b981",
  storage: "#06b6d4",
  operations: "#f59e0b",
  admin: "#8b5cf6",
  transit: "#71717a",
};

export default function FacilityMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [zoneAssets, setZoneAssets] = useState<Asset[]>([]);

  const selectedZoneId = searchParams.get("zone") ? Number(searchParams.get("zone")) : null;

  useEffect(() => {
    api.getZones().then(setZones);
  }, []);

  useEffect(() => {
    if (selectedZoneId) {
      const zone = zones.find((z) => z.id === selectedZoneId);
      setSelectedZone(zone || null);
      api.getAssets({ zone_id: selectedZoneId }).then(setZoneAssets);
    } else {
      setSelectedZone(null);
      setZoneAssets([]);
    }
  }, [selectedZoneId, zones]);

  const handleZoneClick = (zoneId: number) => {
    if (selectedZoneId === zoneId) {
      setSearchParams({});
    } else {
      setSearchParams({ zone: String(zoneId) });
    }
  };

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: theme.text.primary, fontSize: 24, fontWeight: 700, margin: 0 }}>
          Facility Map
        </h1>
        <p style={{ color: theme.text.muted, fontSize: 14, marginTop: 4 }}>
          Interactive zone layout — click a zone to view assets
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, flex: 1, minHeight: 0 }}>
        {/* Map */}
        <div style={{ background: theme.bg.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.bg.border}` }}>
          <svg viewBox="0 0 840 500" style={{ width: "100%", height: "auto" }}>
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke={theme.bg.border} strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="840" height="500" fill={theme.bg.primary} rx="8" />
            <rect width="840" height="500" fill="url(#grid)" rx="8" />

            {zones.map((zone) => {
              const layout = ZONE_LAYOUT[zone.id];
              if (!layout) return null;
              const color = ZONE_COLORS[zone.zone_type || ""] || "#71717a";
              const isSelected = zone.id === selectedZoneId;

              return (
                <g key={zone.id} onClick={() => handleZoneClick(zone.id)} style={{ cursor: "pointer" }}>
                  <rect
                    x={layout.x}
                    y={layout.y}
                    width={layout.w}
                    height={layout.h}
                    rx={6}
                    fill={isSelected ? `${color}30` : `${color}12`}
                    stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1}
                    strokeDasharray={isSelected ? "none" : "4 2"}
                  />
                  <text
                    x={layout.x + layout.w / 2}
                    y={layout.y + layout.h / 2 - 10}
                    textAnchor="middle"
                    fill={theme.text.primary}
                    fontSize={12}
                    fontWeight={600}
                    fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                  >
                    {zone.name}
                  </text>
                  <text
                    x={layout.x + layout.w / 2}
                    y={layout.y + layout.h / 2 + 14}
                    textAnchor="middle"
                    fill={color}
                    fontSize={24}
                    fontWeight={700}
                    fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                  >
                    {zone.asset_count}
                  </text>
                  <text
                    x={layout.x + layout.w / 2}
                    y={layout.y + layout.h / 2 + 32}
                    textAnchor="middle"
                    fill={theme.text.muted}
                    fontSize={10}
                    fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
                  >
                    assets
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
            {Object.entries(ZONE_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
                <span style={{ color: theme.text.muted, fontSize: 12, textTransform: "capitalize" }}>{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Zone Detail or Zone List */}
        <div style={{ background: theme.bg.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.bg.border}`, overflow: "auto" }}>
          {selectedZone ? (
            <>
              <button
                onClick={() => setSearchParams({})}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  color: theme.accent.primary,
                  cursor: "pointer",
                  fontSize: 13,
                  padding: 0,
                  marginBottom: 16,
                }}
              >
                <ArrowLeft size={14} /> Back to all zones
              </button>

              <h2 style={{ color: theme.text.primary, fontSize: 18, fontWeight: 600, margin: "0 0 4px 0" }}>
                {selectedZone.name}
              </h2>
              <p style={{ color: theme.text.muted, fontSize: 13, margin: "0 0 20px 0" }}>
                {selectedZone.description}
              </p>

              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{ background: theme.bg.primary, borderRadius: 8, padding: "10px 16px", flex: 1, textAlign: "center" }}>
                  <div style={{ color: theme.text.muted, fontSize: 11, textTransform: "uppercase" }}>Assets</div>
                  <div style={{ color: theme.accent.primary, fontSize: 24, fontWeight: 700 }}>{selectedZone.asset_count}</div>
                </div>
                <div style={{ background: theme.bg.primary, borderRadius: 8, padding: "10px 16px", flex: 1, textAlign: "center" }}>
                  <div style={{ color: theme.text.muted, fontSize: 11, textTransform: "uppercase" }}>Type</div>
                  <div style={{ color: theme.text.primary, fontSize: 14, fontWeight: 600, marginTop: 4, textTransform: "capitalize" }}>{selectedZone.zone_type}</div>
                </div>
              </div>

              <h3 style={{ color: theme.text.secondary, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px 0" }}>
                Assets in Zone
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {zoneAssets.map((asset) => (
                  <Link
                    key={asset.id}
                    to={`/assets?id=${asset.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: theme.bg.primary,
                      textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = theme.bg.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = theme.bg.primary; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: theme.status[asset.status as keyof typeof theme.status] || theme.text.muted,
                      }} />
                      <div>
                        <div style={{ color: theme.text.primary, fontSize: 13, fontWeight: 500 }}>{asset.name}</div>
                        <div style={{ color: theme.text.muted, fontSize: 11 }}>{asset.asset_tag}</div>
                      </div>
                    </div>
                    <ChevronRight size={14} color={theme.text.muted} />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 style={{ color: theme.text.primary, fontSize: 16, fontWeight: 600, margin: "0 0 4px 0" }}>
                Zones
              </h2>
              <p style={{ color: theme.text.muted, fontSize: 13, margin: "0 0 16px 0" }}>
                Select a zone on the map or below
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {zones.map((zone) => {
                  const color = ZONE_COLORS[zone.zone_type || ""] || "#71717a";
                  return (
                    <div
                      key={zone.id}
                      onClick={() => handleZoneClick(zone.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: theme.bg.primary,
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = theme.bg.cardHover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = theme.bg.primary; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Package size={14} color={color} />
                        <span style={{ color: theme.text.primary, fontSize: 13, fontWeight: 500 }}>{zone.name}</span>
                      </div>
                      <span style={{
                        background: `${color}22`,
                        color: color,
                        padding: "2px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {zone.asset_count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
