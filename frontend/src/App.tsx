import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { Asset, DashboardStats } from "./types";
import StatsBar from "./components/StatsBar";
import FloorMap from "./components/FloorMap";
import ZonePanel from "./components/ZonePanel";
import AssetList from "./components/AssetList";
import { Radar } from "lucide-react";

export default function App() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [dashboardData, assetsData] = await Promise.all([
        api.getDashboard(),
        selectedZoneId
          ? api.getAssets({ zone_id: selectedZoneId })
          : api.getAssets(),
      ]);
      setStats(dashboardData);
      setAssets(assetsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [selectedZoneId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (error) {
    return (
      <div style={{ background: "#020617", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#ef4444", textAlign: "center" }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Connection Error</p>
          <p style={{ color: "#64748b", fontSize: 14 }}>{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchData(); }}
            style={{ marginTop: 16, padding: "8px 16px", background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 6, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#020617", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Radar size={24} color="#3b82f6" />
          <span style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>
            VIGILANCE
          </span>
          <span style={{ color: "#64748b", fontSize: 13, marginLeft: 4 }}>
            Operational Asset Tracking
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ color: "#64748b", fontSize: 13 }}>System Online</span>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        {/* Stats Row */}
        <div style={{ marginBottom: 24 }}>
          <StatsBar stats={stats} />
        </div>

        {/* Floor Map + Zone Panel Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, marginBottom: 24 }}>
          <FloorMap
            zones={stats?.zones || []}
            selectedZoneId={selectedZoneId}
            onZoneClick={setSelectedZoneId}
          />
          <ZonePanel
            zones={stats?.zones || []}
            selectedZoneId={selectedZoneId}
            onZoneClick={setSelectedZoneId}
          />
        </div>

        {/* Asset Table */}
        <AssetList assets={assets} loading={loading} />
      </div>
    </div>
  );
}
