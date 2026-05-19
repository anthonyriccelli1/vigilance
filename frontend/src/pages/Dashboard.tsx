import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Box, Activity, AlertTriangle, Shield, ChevronRight, MapPin } from "lucide-react";
import { api } from "../api";
import { DashboardStats } from "../types";
import { theme } from "../theme";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.getDashboard().then(setStats);
    const interval = setInterval(() => api.getDashboard().then(setStats), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return (
      <div style={{ padding: 32, color: theme.text.muted }}>Loading dashboard...</div>
    );
  }

  const complianceRate = stats.total_assets > 0
    ? Math.round((stats.compliant_assets / stats.total_assets) * 100)
    : 0;

  const kpiCards = [
    { label: "Total Assets", value: stats.total_assets, icon: Box, color: theme.accent.primary, link: "/assets" },
    { label: "Active", value: stats.active_assets, icon: Activity, color: theme.accent.primary, link: "/assets?status=active" },
    { label: "Maintenance", value: stats.maintenance_assets, icon: AlertTriangle, color: theme.accent.warning, link: "/assets?status=maintenance" },
    { label: "Compliance", value: `${complianceRate}%`, icon: Shield, color: stats.non_compliant_assets > 0 ? theme.accent.warning : theme.accent.primary, link: "/assets" },
  ];

  return (
    <div style={{ padding: 32 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: theme.text.primary, fontSize: 24, fontWeight: 700, margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ color: theme.text.muted, fontSize: 14, marginTop: 4 }}>
          Operational overview — Vigilance facility monitoring
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.link}
              style={{
                background: theme.bg.card,
                borderRadius: 12,
                padding: 20,
                border: `1px solid ${theme.bg.border}`,
                textDecoration: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${card.color}55`;
                e.currentTarget.style.background = theme.bg.cardHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.bg.border;
                e.currentTarget.style.background = theme.bg.card;
              }}
            >
              <ChevronRight
                size={14}
                color={theme.text.muted}
                style={{ position: "absolute", top: 12, right: 12 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ color: theme.text.muted, fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {card.label}
                  </div>
                  <div style={{ color: theme.text.primary, fontSize: 32, fontWeight: 700 }}>
                    {card.value}
                  </div>
                </div>
                <div style={{ background: `${card.color}18`, borderRadius: 10, padding: 10 }}>
                  <Icon size={22} color={card.color} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Two Column: Zone Overview + Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Zone Overview */}
        <div style={{ background: theme.bg.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.bg.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ color: theme.text.primary, fontSize: 16, fontWeight: 600, margin: 0 }}>
              Zone Overview
            </h2>
            <Link to="/map" style={{ color: theme.accent.primary, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              View Map <ChevronRight size={14} />
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stats.zones.map((zone) => (
              <Link
                key={zone.id}
                to={`/map?zone=${zone.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: theme.bg.primary,
                  textDecoration: "none",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = theme.bg.cardHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = theme.bg.primary; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MapPin size={14} color={theme.accent.primary} />
                  <span style={{ color: theme.text.primary, fontSize: 13, fontWeight: 500 }}>
                    {zone.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    background: theme.accent.primaryDim,
                    color: theme.accent.primary,
                    padding: "2px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                  }}>
                    {zone.asset_count}
                  </span>
                  <ChevronRight size={14} color={theme.text.muted} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Non-Compliant Assets Summary */}
        <div style={{ background: theme.bg.card, borderRadius: 12, padding: 20, border: `1px solid ${theme.bg.border}` }}>
          <h2 style={{ color: theme.text.primary, fontSize: 16, fontWeight: 600, margin: "0 0 16px 0" }}>
            Compliance Status
          </h2>
          {/* Compliance bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: theme.text.secondary, fontSize: 13 }}>Compliant</span>
              <span style={{ color: theme.text.primary, fontSize: 13, fontWeight: 600 }}>{stats.compliant_assets} / {stats.total_assets}</span>
            </div>
            <div style={{ background: theme.bg.primary, borderRadius: 6, height: 10, overflow: "hidden" }}>
              <div style={{
                width: `${complianceRate}%`,
                height: "100%",
                background: complianceRate >= 90 ? theme.accent.primary : theme.accent.warning,
                borderRadius: 6,
                transition: "width 0.5s",
              }} />
            </div>
          </div>

          {/* Status breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Active", count: stats.active_assets, color: theme.status.active },
              { label: "Inactive", count: stats.inactive_assets, color: theme.status.inactive },
              { label: "Maintenance", count: stats.maintenance_assets, color: theme.status.maintenance },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />
                  <span style={{ color: theme.text.secondary, fontSize: 13 }}>{item.label}</span>
                </div>
                <span style={{ color: theme.text.primary, fontSize: 14, fontWeight: 600 }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
