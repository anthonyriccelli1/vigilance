import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Shield, ShieldOff, Wrench, CircleDot, CircleOff, X, MapPin } from "lucide-react";
import { api } from "../api";
import { Asset } from "../types";
import { theme } from "../theme";

const STATUS_CONFIG: Record<string, { icon: typeof CircleDot; color: string; label: string }> = {
  active: { icon: CircleDot, color: theme.status.active, label: "Active" },
  inactive: { icon: CircleOff, color: theme.status.inactive, label: "Inactive" },
  maintenance: { icon: Wrench, color: theme.status.maintenance, label: "Maintenance" },
};

const FILTER_PILLS = [
  { value: null, label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "maintenance", label: "Maintenance" },
];

function timeAgo(dateString: string): string {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function Assets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const statusFilter = searchParams.get("status");
  const assetIdParam = searchParams.get("id");

  useEffect(() => {
    setLoading(true);
    const params: { status?: string } = {};
    if (statusFilter) params.status = statusFilter;
    api.getAssets(params).then((data) => {
      setAssets(data);
      setLoading(false);
      if (assetIdParam) {
        const found = data.find((a) => a.id === Number(assetIdParam));
        if (found) setSelectedAsset(found);
      }
    });
  }, [statusFilter, assetIdParam]);

  const handleFilterClick = (value: string | null) => {
    const params: Record<string, string> = {};
    if (value) params.status = value;
    setSearchParams(params);
    setSelectedAsset(null);
  };

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: theme.text.primary, fontSize: 24, fontWeight: 700, margin: 0 }}>
          Asset Tracking
        </h1>
        <p style={{ color: theme.text.muted, fontSize: 14, marginTop: 4 }}>
          {assets.length} assets {statusFilter ? `— filtered by ${statusFilter}` : "— all statuses"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedAsset ? "1fr 360px" : "1fr", gap: 24, flex: 1, minHeight: 0 }}>
        {/* Table Panel */}
        <div style={{ background: theme.bg.card, borderRadius: 12, border: `1px solid ${theme.bg.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Filter Bar */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${theme.bg.border}`, display: "flex", gap: 8 }}>
            {FILTER_PILLS.map((pill) => (
              <button
                key={pill.label}
                onClick={() => handleFilterClick(pill.value)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  background: (statusFilter === pill.value || (!statusFilter && !pill.value))
                    ? theme.accent.primaryDim
                    : theme.bg.primary,
                  color: (statusFilter === pill.value || (!statusFilter && !pill.value))
                    ? theme.accent.primary
                    : theme.text.secondary,
                  transition: "all 0.15s",
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={{ overflow: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ color: theme.text.muted, textAlign: "center", padding: 40 }}>Loading...</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Tag", "Name", "Category", "Zone", "Status", "Compliant", "Last Seen"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left",
                        padding: "10px 14px",
                        color: theme.text.muted,
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: `1px solid ${theme.bg.border}`,
                        position: "sticky",
                        top: 0,
                        background: theme.bg.card,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const cfg = STATUS_CONFIG[asset.status] || STATUS_CONFIG.active;
                    const Icon = cfg.icon;
                    const isSelected = selectedAsset?.id === asset.id;

                    return (
                      <tr
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset)}
                        style={{
                          borderBottom: `1px solid ${theme.bg.border}`,
                          borderLeft: `3px solid ${cfg.color}`,
                          cursor: "pointer",
                          background: isSelected ? theme.bg.cardHover : "transparent",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = `${theme.bg.cardHover}88`; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                      >
                        <td style={{ padding: "10px 14px", color: theme.text.muted, fontSize: 13, fontFamily: "monospace" }}>{asset.asset_tag}</td>
                        <td style={{ padding: "10px 14px", color: theme.text.primary, fontSize: 13, fontWeight: 500 }}>{asset.name}</td>
                        <td style={{ padding: "10px 14px", color: theme.text.secondary, fontSize: 13 }}>{asset.category}</td>
                        <td style={{ padding: "10px 14px", color: theme.text.secondary, fontSize: 13 }}>{asset.zone_name}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Icon size={14} color={cfg.color} />
                            <span style={{ color: cfg.color, fontSize: 13 }}>{cfg.label}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {asset.compliant
                            ? <Shield size={16} color={theme.accent.primary} />
                            : <ShieldOff size={16} color={theme.accent.danger} />}
                        </td>
                        <td style={{ padding: "10px 14px", color: theme.text.muted, fontSize: 13 }}>{timeAgo(asset.last_seen)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail Drawer */}
        {selectedAsset && (
          <div style={{ background: theme.bg.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.bg.border}`, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: theme.text.primary, fontSize: 18, fontWeight: 600, margin: 0 }}>
                Asset Detail
              </h2>
              <button
                onClick={() => setSelectedAsset(null)}
                style={{ background: "none", border: "none", color: theme.text.muted, cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Asset Tag */}
              <div style={{ background: theme.bg.primary, borderRadius: 8, padding: 16, textAlign: "center" }}>
                <div style={{ color: theme.text.muted, fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Asset Tag</div>
                <div style={{ color: theme.accent.primary, fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>{selectedAsset.asset_tag}</div>
              </div>

              {/* Info Fields */}
              {[
                { label: "Name", value: selectedAsset.name },
                { label: "Category", value: selectedAsset.category },
                { label: "Owner", value: selectedAsset.owner || "Unassigned" },
                { label: "Status", value: selectedAsset.status, color: theme.status[selectedAsset.status as keyof typeof theme.status] },
                { label: "Zone", value: selectedAsset.zone_name || `Zone ${selectedAsset.zone_id}` },
                { label: "Compliance Type", value: selectedAsset.compliance_type || "N/A" },
                { label: "Last Seen", value: timeAgo(selectedAsset.last_seen) },
              ].map((field) => (
                <div key={field.label}>
                  <div style={{ color: theme.text.muted, fontSize: 11, textTransform: "uppercase", marginBottom: 2 }}>{field.label}</div>
                  <div style={{ color: field.color || theme.text.primary, fontSize: 14, fontWeight: 500, textTransform: "capitalize" }}>{field.value}</div>
                </div>
              ))}

              {/* Compliance Badge */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 8,
                background: selectedAsset.compliant ? `${theme.accent.primary}15` : `${theme.accent.danger}15`,
                border: `1px solid ${selectedAsset.compliant ? `${theme.accent.primary}33` : `${theme.accent.danger}33`}`,
              }}>
                {selectedAsset.compliant
                  ? <Shield size={16} color={theme.accent.primary} />
                  : <ShieldOff size={16} color={theme.accent.danger} />}
                <span style={{ color: selectedAsset.compliant ? theme.accent.primary : theme.accent.danger, fontSize: 13, fontWeight: 500 }}>
                  {selectedAsset.compliant ? "Compliant" : "Non-Compliant"}
                </span>
              </div>

              {/* Notes */}
              {selectedAsset.notes && (
                <div>
                  <div style={{ color: theme.text.muted, fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
                  <div style={{ color: theme.text.secondary, fontSize: 13, background: theme.bg.primary, padding: 10, borderRadius: 6 }}>
                    {selectedAsset.notes}
                  </div>
                </div>
              )}

              {/* View on Map link */}
              <a
                href={`/map?zone=${selectedAsset.zone_id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: theme.accent.primary,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                <MapPin size={14} /> View on Map
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
