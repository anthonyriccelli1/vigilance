import { NavLink, Outlet, useLocation } from "react-router";
import { LayoutDashboard, Map, Package, Activity, Radio } from "lucide-react";
import { theme } from "../theme";
import ChatWidget from "./ChatWidget";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { to: "/",       icon: LayoutDashboard, label: "Operations Center" },
  { to: "/map",    icon: Map,             label: "Zone Map"          },
  { to: "/assets", icon: Package,         label: "Asset Registry"    },
  { to: "/health", icon: Activity,        label: "Infrastructure"    },
];

// Page title map for the header
const PAGE_TITLES: Record<string, string> = {
  "/":       "Operations Center",
  "/map":    "Zone Map",
  "/assets": "Asset Registry",
  "/health": "Infrastructure",
};

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function Layout() {
  const location = useLocation();
  const time     = useClock();

  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)
  )?.[1] ?? "Vigilance";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: theme.bg.primary }}>

      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <header style={{
        height:           48,
        background:       theme.bg.sidebar,
        borderBottom:     `1px solid ${theme.bg.border}`,
        display:          "flex",
        alignItems:       "center",
        justifyContent:   "space-between",
        padding:          "0 20px 0 0",
        flexShrink:       0,
        zIndex:           100,
      }}>
        {/* Left — logo area (same width as sidebar so content aligns) */}
        <div style={{
          width:        220,
          flexShrink:   0,
          display:      "flex",
          alignItems:   "center",
          gap:          10,
          padding:      "0 16px",
          borderRight:  `1px solid ${theme.bg.border}`,
          height:       "100%",
        }}>
          <img
            src="/Vigilance_Logo.png"
            alt="Vigilance"
            style={{ height: 28, width: "auto", objectFit: "contain" }}
          />
          <span style={{ color: theme.text.primary, fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>
            VIGILANCE
          </span>
        </div>

        {/* Center — current page title */}
        <div style={{ flex: 1, paddingLeft: 24 }}>
          <span style={{ color: theme.text.secondary, fontSize: 13, fontWeight: 500 }}>
            {pageTitle}
          </span>
        </div>

        {/* Right — live clock + WS status */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Radio size={13} color={theme.accent.primary} />
            <span style={{ color: theme.accent.primary, fontSize: 12 }}>Live</span>
          </div>
          <span style={{ color: theme.text.muted, fontSize: 12, fontFamily: "monospace" }}>
            {time.toLocaleTimeString()}
          </span>
          <span style={{ color: theme.text.muted, fontSize: 12 }}>
            {time.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </header>

      {/* ── Body (sidebar + main) ──────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <aside style={{
          width:        220,
          background:   theme.bg.sidebar,
          borderRight:  `1px solid ${theme.bg.border}`,
          display:      "flex",
          flexDirection:"column",
          flexShrink:   0,
          // Accent bar on left edge
          borderLeft:   `3px solid ${theme.accent.primary}`,
        }}>

          {/* Navigation */}
          <nav style={{ padding: "16px 8px", flex: 1 }}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  style={({ isActive }) => ({
                    display:        "flex",
                    alignItems:     "center",
                    gap:            10,
                    padding:        "9px 12px",
                    borderRadius:   6,
                    marginBottom:   2,
                    textDecoration: "none",
                    fontSize:       13,
                    fontWeight:     500,
                    color:          isActive ? theme.accent.primary : theme.text.secondary,
                    background:     isActive ? theme.accent.primaryDim : "transparent",
                    borderRight:    isActive ? `2px solid ${theme.accent.primary}` : "2px solid transparent",
                    transition:     "all 0.15s",
                  })}
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom status */}
          <div style={{
            padding:    "12px 16px",
            borderTop:  `1px solid ${theme.bg.border}`,
            display:    "flex",
            alignItems: "center",
            gap:        8,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: theme.accent.primary, boxShadow: `0 0 6px ${theme.accent.primary}` }} />
            <span style={{ color: theme.text.muted, fontSize: 11 }}>All Systems Operational</span>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ flex: 1, overflow: "auto" }}>
          <Outlet />
        </main>
      </div>

      {/* AI Chat Widget */}
      <ChatWidget />
    </div>
  );
}
