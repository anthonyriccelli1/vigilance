/**
 * SystemHealth.tsx — Real-time infrastructure monitoring page.
 *
 * Monitors three layers of the stack:
 *   1. API availability — is the backend reachable?
 *   2. Database connectivity — is RDS responding?
 *   3. WebSocket connection — is the real-time feed live?
 *
 * This mirrors the observability pattern used with tools like
 * Datadog or Prometheus in production environments.
 */

import { useEffect, useState } from "react";
import { theme } from "../theme";
import { Activity, Database, Globe, Radio, Clock } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface DetailedHealth {
  api:            string;
  database:       string;
  db_latency_ms:  number | null;
}

interface CheckResult {
  status:        "healthy" | "degraded" | "unreachable" | "checking";
  latencyMs:     number | null;
  lastChecked:   Date | null;
}

function useWebSocketCheck() {
  const [wsStatus, setWsStatus] = useState<"healthy" | "unreachable" | "checking">("checking");
  const [eventCount, setEventCount] = useState(0);
  const WS_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/^http/, "ws") + "/ws";

  useEffect(() => {
    let ws: WebSocket;
    let cancelled = false;

    try {
      ws = new WebSocket(WS_URL);
      ws.onopen  = () => { if (!cancelled) setWsStatus("healthy"); };
      ws.onmessage = () => { if (!cancelled) setEventCount(c => c + 1); };
      ws.onerror = () => { if (!cancelled) setWsStatus("unreachable"); };
      ws.onclose = () => { if (!cancelled) setWsStatus("unreachable"); };
    } catch {
      setWsStatus("unreachable");
    }

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, []);

  return { wsStatus, eventCount };
}

function useHealthCheck() {
  const [api, setApi]      = useState<CheckResult>({ status: "checking", latencyMs: null, lastChecked: null });
  const [db, setDb]        = useState<CheckResult>({ status: "checking", latencyMs: null, lastChecked: null });
  const [uptimeStart]      = useState<Date>(new Date());

  const runCheck = async () => {
    const start = performance.now();
    try {
      const res  = await fetch(`${API_BASE}/health/detailed`);
      const elapsed = Math.round(performance.now() - start);
      if (!res.ok) throw new Error("non-200");
      const data: DetailedHealth = await res.json();

      setApi({
        status:      "healthy",
        latencyMs:   elapsed,
        lastChecked: new Date(),
      });

      setDb({
        status:      data.database === "healthy" ? "healthy" : "unreachable",
        latencyMs:   data.db_latency_ms,
        lastChecked: new Date(),
      });
    } catch {
      const elapsed = Math.round(performance.now() - start);
      setApi({ status: "unreachable", latencyMs: elapsed, lastChecked: new Date() });
      setDb({ status: "unreachable", latencyMs: null, lastChecked: new Date() });
    }
  };

  useEffect(() => {
    runCheck();
    const interval = setInterval(runCheck, 30_000); // re-check every 30s
    return () => clearInterval(interval);
  }, []);

  return { api, db, uptimeStart };
}

function useUptime(start: Date) {
  const [uptime, setUptime] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = Math.floor((Date.now() - start.getTime()) / 1000);
      const h    = Math.floor(diff / 3600);
      const m    = Math.floor((diff % 3600) / 60);
      const s    = diff % 60;
      setUptime(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);

  return uptime;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: CheckResult["status"] }) {
  const color =
    status === "healthy"     ? theme.accent.primary  :
    status === "degraded"    ? theme.accent.warning  :
    status === "unreachable" ? theme.accent.danger   :
    theme.text.muted;

  return (
    <span style={{
      display:      "inline-block",
      width:        10,
      height:       10,
      borderRadius: "50%",
      background:   color,
      boxShadow:    status === "healthy" ? `0 0 6px ${color}` : "none",
    }} />
  );
}

function HealthCard({
  icon,
  label,
  result,
  detail,
}: {
  icon:   React.ReactNode;
  label:  string;
  result: CheckResult;
  detail?: string;
}) {
  const statusLabel =
    result.status === "checking"   ? "Checking…"   :
    result.status === "healthy"    ? "Healthy"      :
    result.status === "degraded"   ? "Degraded"     :
    "Unreachable";

  const statusColor =
    result.status === "healthy"    ? theme.accent.primary  :
    result.status === "degraded"   ? theme.accent.warning  :
    result.status === "unreachable"? theme.accent.danger   :
    theme.text.muted;

  return (
    <div style={{
      background:   theme.bg.card,
      border:       `1px solid ${theme.bg.border}`,
      borderRadius: 12,
      padding:      24,
      display:      "flex",
      flexDirection:"column",
      gap:          16,
    }}>
      {/* Icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          background:   theme.bg.primary,
          borderRadius: 8,
          padding:      8,
          display:      "flex",
        }}>
          {icon}
        </div>
        <span style={{ color: theme.text.secondary, fontSize: 13, fontWeight: 500 }}>
          {label}
        </span>
      </div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusDot status={result.status} />
        <span style={{ color: statusColor, fontSize: 20, fontWeight: 700 }}>
          {statusLabel}
        </span>
      </div>

      {/* Latency */}
      {result.latencyMs !== null && (
        <div style={{ color: theme.text.muted, fontSize: 12 }}>
          Response time: <span style={{ color: theme.text.secondary }}>{result.latencyMs}ms</span>
        </div>
      )}

      {/* Detail */}
      {detail && (
        <div style={{ color: theme.text.muted, fontSize: 12 }}>{detail}</div>
      )}

      {/* Last checked */}
      {result.lastChecked && (
        <div style={{ color: theme.text.muted, fontSize: 11, marginTop: "auto" }}>
          Last checked: {result.lastChecked.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SystemHealth() {
  const { api, db, uptimeStart } = useHealthCheck();
  const { wsStatus, eventCount } = useWebSocketCheck();
  const uptime                   = useUptime(uptimeStart);

  const wsResult: CheckResult = {
    status:      wsStatus,
    latencyMs:   null,
    lastChecked: new Date(),
  };

  const allHealthy = api.status === "healthy" && db.status === "healthy" && wsStatus === "healthy";

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: theme.text.primary, fontSize: 22, fontWeight: 700, margin: 0 }}>
          System Health
        </h1>
        <p style={{ color: theme.text.muted, fontSize: 13, margin: "4px 0 0 0" }}>
          Real-time infrastructure monitoring — checks run every 30 seconds
        </p>
      </div>

      {/* Overall status banner */}
      <div style={{
        background:   allHealthy ? `${theme.accent.primary}15` : `${theme.accent.danger}15`,
        border:       `1px solid ${allHealthy ? theme.accent.primary : theme.accent.danger}44`,
        borderRadius: 10,
        padding:      "14px 20px",
        marginBottom: 28,
        display:      "flex",
        alignItems:   "center",
        gap:          10,
      }}>
        <Activity size={18} color={allHealthy ? theme.accent.primary : theme.accent.danger} />
        <span style={{ color: allHealthy ? theme.accent.primary : theme.accent.danger, fontWeight: 600, fontSize: 14 }}>
          {allHealthy ? "All systems operational" : "One or more systems degraded — check below"}
        </span>
      </div>

      {/* Health cards */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap:                 16,
        marginBottom:        32,
      }}>
        <HealthCard
          icon={<Globe size={16} color={theme.accent.primary} />}
          label="API Service"
          result={api}
          detail="FastAPI backend on ECS Fargate"
        />
        <HealthCard
          icon={<Database size={16} color={theme.accent.primary} />}
          label="Database"
          result={db}
          detail="PostgreSQL on Amazon RDS"
        />
        <HealthCard
          icon={<Radio size={16} color={theme.accent.primary} />}
          label="WebSocket Feed"
          result={wsResult}
          detail={`${eventCount} events received this session`}
        />
      </div>

      {/* Uptime */}
      <div style={{
        background:   theme.bg.card,
        border:       `1px solid ${theme.bg.border}`,
        borderRadius: 12,
        padding:      24,
        display:      "flex",
        alignItems:   "center",
        gap:          14,
      }}>
        <Clock size={20} color={theme.accent.primary} />
        <div>
          <div style={{ color: theme.text.muted, fontSize: 12, marginBottom: 2 }}>
            Session uptime
          </div>
          <div style={{ color: theme.text.primary, fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>
            {uptime}
          </div>
        </div>
      </div>
    </div>
  );
}
