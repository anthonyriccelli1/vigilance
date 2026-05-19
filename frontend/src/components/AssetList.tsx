import { Shield, ShieldOff, Wrench, CircleDot, CircleOff } from "lucide-react";
import { Asset } from "../types";

interface AssetListProps {
  assets: Asset[];
  loading: boolean;
}

const STATUS_CONFIG: Record<string, { icon: typeof CircleDot; color: string; label: string }> = {
  active: { icon: CircleDot, color: "#22c55e", label: "Active" },
  inactive: { icon: CircleOff, color: "#64748b", label: "Inactive" },
  maintenance: { icon: Wrench, color: "#f59e0b", label: "Maintenance" },
};

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

export default function AssetList({ assets, loading }: AssetListProps) {
  if (loading) {
    return (
      <div style={{ background: "#0f172a", borderRadius: 12, padding: 16 }}>
        <h2 style={{ color: "#e2e8f0", margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
          Assets
        </h2>
        <div style={{ color: "#64748b", textAlign: "center", padding: 40 }}>Loading assets...</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#0f172a", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: 16, fontWeight: 600 }}>Assets</h2>
        <span style={{ color: "#64748b", fontSize: 13 }}>{assets.length} items</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b" }}>
              {["Tag", "Name", "Category", "Zone", "Status", "Compliant", "Last Seen"].map(
                (header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      color: "#64748b",
                      fontSize: 12,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const statusCfg = STATUS_CONFIG[asset.status] || STATUS_CONFIG.active;
              const StatusIcon = statusCfg.icon;

              return (
                <tr
                  key={asset.id}
                  style={{ borderBottom: "1px solid #1e293b" }}
                >
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 13, fontFamily: "monospace" }}>
                    {asset.asset_tag}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>
                    {asset.name}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 13 }}>
                    {asset.category}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 13 }}>
                    {asset.zone_name}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <StatusIcon size={14} color={statusCfg.color} />
                      <span style={{ color: statusCfg.color, fontSize: 13 }}>{statusCfg.label}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {asset.compliant ? (
                      <Shield size={16} color="#22c55e" />
                    ) : (
                      <ShieldOff size={16} color="#ef4444" />
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 13 }}>
                    {timeAgo(asset.last_seen)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
