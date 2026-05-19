import { Box, Activity, AlertTriangle, Shield } from "lucide-react";
import { DashboardStats } from "../types";

interface StatsBarProps {
  stats: DashboardStats | null;
}

export default function StatsBar({ stats }: StatsBarProps) {
  if (!stats) return null;

  const cards = [
    {
      label: "Total Assets",
      value: stats.total_assets,
      icon: Box,
      color: "#3b82f6",
    },
    {
      label: "Active",
      value: stats.active_assets,
      icon: Activity,
      color: "#22c55e",
    },
    {
      label: "Maintenance",
      value: stats.maintenance_assets,
      icon: AlertTriangle,
      color: "#f59e0b",
    },
    {
      label: "Compliant",
      value: `${stats.total_assets > 0 ? Math.round((stats.compliant_assets / stats.total_assets) * 100) : 0}%`,
      icon: Shield,
      color: stats.non_compliant_assets > 0 ? "#f59e0b" : "#22c55e",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            style={{
              background: "#0f172a",
              borderRadius: 12,
              padding: 16,
              border: "1px solid #1e293b",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {card.label}
                </div>
                <div style={{ color: "#e2e8f0", fontSize: 28, fontWeight: 700 }}>
                  {card.value}
                </div>
              </div>
              <div style={{ background: `${card.color}22`, borderRadius: 8, padding: 8 }}>
                <Icon size={20} color={card.color} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
