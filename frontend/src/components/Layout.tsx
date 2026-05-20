import { NavLink, Outlet } from "react-router";
import { LayoutDashboard, Map, Package } from "lucide-react";
import { theme } from "../theme";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/map", icon: Map, label: "Facility Map" },
  { to: "/assets", icon: Package, label: "Assets" },
];

export default function Layout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.bg.primary }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: theme.bg.sidebar,
          borderRight: `1px solid ${theme.bg.border}`,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "20px 16px",
            borderBottom: `1px solid ${theme.bg.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <img
            src="/Vigilance_Logo.png"
            alt="Vigilance"
            style={{ height: 36, width: "auto", objectFit: "contain" }}
          />
          <div>
            <div style={{ color: theme.text.primary, fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>
              VIGILANCE
            </div>
            <div style={{ color: theme.text.muted, fontSize: 11 }}>Asset Tracking v1.0</div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  marginBottom: 4,
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? theme.accent.primary : theme.text.secondary,
                  background: isActive ? theme.accent.primaryDim : "transparent",
                  transition: "all 0.15s",
                })}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* System Status */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${theme.bg.border}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent.primary }} />
          <span style={{ color: theme.text.muted, fontSize: 12 }}>System Online</span>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
