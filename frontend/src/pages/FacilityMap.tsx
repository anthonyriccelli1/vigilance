import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router";
import {
  ArrowLeft, ChevronRight, Upload, Pencil, X, Check,
  ImageOff, Plus, ChevronDown, Layers, Crosshair, Radio, List,
} from "lucide-react";
import { api } from "../api";
import { Zone, Asset } from "../types";
import { theme } from "../theme";
import { useFacilityMap, MapZone, Building, Floor, Point } from "../facilityMapStore";
import { useAssetFeed } from "../hooks/useAssetFeed";
import MovementLog from "../components/MovementLog";

// ─── Constants ────────────────────────────────────────────────────────────────

const SVG_W = 840;
const SVG_H = 500;

const STATUS_COLOR: Record<string, string> = {
  active:      theme.accent.primary,
  maintenance: theme.accent.warning,
  inactive:    theme.text.muted,
};

const ZONE_PALETTE = [
  "#10b981", "#06b6d4", "#f59e0b", "#8b5cf6",
  "#ef4444", "#ec4899", "#f97316", "#14b8a6",
];

function zoneColor(idx: number) { return ZONE_PALETTE[idx % ZONE_PALETTE.length]; }

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function centroid(pts: Point[]): Point {
  return pts.reduce(
    ([ax, ay], [x, y]) => [ax + x / pts.length, ay + y / pts.length],
    [0, 0] as Point,
  );
}

function polyStr(pts: Point[]) { return pts.map((p) => p.join(",")).join(" "); }

/** Spread up to N dots in a grid around a centre point inside the polygon. */
function dotPositions(cx: number, cy: number, count: number): Point[] {
  const cols = Math.ceil(Math.sqrt(count));
  return Array.from({ length: count }, (_, i): Point => [
    cx + (i % cols - (cols - 1) / 2) * 13,
    cy + 22 + Math.floor(i / cols) * 13,
  ]);
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function btnStyle(bg: string, border: string, color: string): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 13px", borderRadius: 7,
    background: bg, border: `1px solid ${border}`,
    color, fontSize: 13, cursor: "pointer", fontWeight: 500,
    transition: "all 0.15s", whiteSpace: "nowrap",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw state machine
//
// idle     → user enters draw mode, clicks on map
// drawing  → points are accumulating on the canvas
// naming   → polygon closed, right panel shows "Name this zone" form
// ─────────────────────────────────────────────────────────────────────────────

type DrawState =
  | { phase: "idle" }
  | { phase: "drawing"; points: Point[] }
  | { phase: "naming"; points: Point[]; name: string; backendZoneId: number | "" };

// ─────────────────────────────────────────────────────────────────────────────
// BuildingDropdown
// ─────────────────────────────────────────────────────────────────────────────

function BuildingDropdown({ buildings, activeBuildingId, onSelect, onAdd, onRename, onDelete }: {
  buildings: Building[]; activeBuildingId: string;
  onSelect: (id: string) => void; onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen]             = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState("");
  const [addingNew, setAddingNew]   = useState(false);
  const [newName, setNewName]       = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const active = buildings.find((b) => b.id === activeBuildingId);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setRenamingId(null); setAddingNew(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const commitRename = (id: string) => {
    const n = renameVal.trim(); if (n) onRename(id, n); setRenamingId(null);
  };
  const commitAdd = () => {
    const n = newName.trim(); if (n) { onAdd(n); setOpen(false); }
    setAddingNew(false); setNewName("");
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 8,
        background: theme.bg.card,
        border: `1px solid ${open ? theme.accent.primary + "66" : theme.bg.border}`,
        color: theme.text.primary, fontSize: 14, fontWeight: 600,
        cursor: "pointer", minWidth: 180, transition: "border-color 0.15s",
      }}>
        <span style={{ flex: 1, textAlign: "left" }}>{active?.name ?? "—"}</span>
        <ChevronDown size={14} color={theme.text.muted}
          style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      <button
        onClick={() => { setOpen(true); setAddingNew(true); }}
        title="Add new facility"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, background: theme.bg.card, border: `1px solid ${theme.bg.border}`, color: theme.text.muted, cursor: "pointer", transition: "all 0.15s" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.accent.primary + "66"; e.currentTarget.style.color = theme.accent.primary; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.bg.border; e.currentTarget.style.color = theme.text.muted; }}
      ><Plus size={14} /></button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: 240, zIndex: 200, background: theme.bg.card, border: `1px solid ${theme.bg.border}`, borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}>
          {buildings.map((b) => {
            const isActive = b.id === activeBuildingId;
            const isRen    = renamingId === b.id;
            return (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: isActive ? theme.accent.primaryDim : "transparent", borderBottom: `1px solid ${theme.bg.border}` }}>
                {isRen
                  ? <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitRename(b.id); if (e.key === "Escape") setRenamingId(null); }}
                      onBlur={() => commitRename(b.id)}
                      style={{ flex: 1, background: theme.bg.input, border: `1px solid ${theme.accent.primary}66`, borderRadius: 5, padding: "3px 8px", color: theme.text.primary, fontSize: 13, outline: "none" }} />
                  : <span onClick={() => { onSelect(b.id); setOpen(false); }}
                      onDoubleClick={() => { setRenamingId(b.id); setRenameVal(b.name); }}
                      title="Double-click to rename"
                      style={{ flex: 1, color: isActive ? theme.accent.primary : theme.text.primary, fontSize: 13, fontWeight: isActive ? 600 : 400, cursor: "pointer", userSelect: "none" }}>
                      {b.name}
                    </span>
                }
                {buildings.length > 1 && !isRen && (
                  <button onClick={(e) => { e.stopPropagation(); onDelete(b.id); }}
                    style={{ background: "none", border: "none", color: theme.text.muted, cursor: "pointer", padding: 2, lineHeight: 1 }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
          {addingNew
            ? <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px" }}>
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); } }}
                  placeholder="e.g. Hangar Alpha"
                  style={{ flex: 1, background: theme.bg.input, border: `1px solid ${theme.accent.primary}66`, borderRadius: 5, padding: "4px 9px", color: theme.text.primary, fontSize: 13, outline: "none" }} />
                <button onClick={commitAdd} style={{ background: theme.accent.primary, border: "none", borderRadius: 5, padding: "4px 10px", color: "#fff", fontSize: 12, cursor: "pointer" }}>Add</button>
              </div>
            : <button onClick={() => setAddingNew(true)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", background: "transparent", border: "none", color: theme.text.muted, fontSize: 13, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = theme.bg.primary; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <Plus size={13} color={theme.accent.primary} />
                <span style={{ color: theme.accent.primary }}>Add Facility</span>
              </button>
          }
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FloorPills
// ─────────────────────────────────────────────────────────────────────────────

function FloorPills({ floors, activeFloorId, onSelect, onAdd, onRename, onDelete }: {
  floors: Floor[]; activeFloorId: string;
  onSelect: (id: string) => void; onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState("");
  const [addingNew, setAddingNew]   = useState(false);
  const [newName, setNewName]       = useState("");

  const commitRename = (id: string) => {
    const n = renameVal.trim(); if (n) onRename(id, n); setRenamingId(null);
  };
  const commitAdd = () => {
    const n = newName.trim(); if (n) onAdd(n); setAddingNew(false); setNewName("");
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Layers size={14} color={theme.text.muted} style={{ flexShrink: 0 }} />
      {floors.map((floor) => {
        const isActive = floor.id === activeFloorId;
        const isRen    = renamingId === floor.id;
        if (isRen) return (
          <input key={floor.id} autoFocus value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitRename(floor.id); if (e.key === "Escape") setRenamingId(null); }}
            onBlur={() => commitRename(floor.id)}
            style={{ background: theme.bg.input, border: `1px solid ${theme.accent.primary}66`, borderRadius: 6, padding: "3px 10px", color: theme.text.primary, fontSize: 12, outline: "none", width: 120 }} />
        );
        return (
          <div key={floor.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <span onClick={() => onSelect(floor.id)}
              onDoubleClick={() => { setRenamingId(floor.id); setRenameVal(floor.name); }}
              title="Double-click to rename"
              style={{ padding: "4px 12px", borderRadius: 6, background: isActive ? theme.accent.primaryDim : theme.bg.card, border: `1px solid ${isActive ? theme.accent.primary + "55" : theme.bg.border}`, color: isActive ? theme.accent.primary : theme.text.secondary, fontSize: 12, fontWeight: isActive ? 600 : 400, cursor: "pointer", userSelect: "none", transition: "all 0.15s" }}>
              {floor.name}
            </span>
            {floors.length > 1 && (
              <button onClick={() => onDelete(floor.id)}
                style={{ background: "none", border: "none", color: theme.text.muted, cursor: "pointer", padding: "1px 3px", lineHeight: 1 }}>
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}
      {addingNew
        ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); } }}
              onBlur={commitAdd} placeholder="e.g. 1st Floor"
              style={{ background: theme.bg.input, border: `1px solid ${theme.accent.primary}66`, borderRadius: 6, padding: "3px 10px", color: theme.text.primary, fontSize: 12, outline: "none", width: 120 }} />
            <button onClick={commitAdd} style={{ background: theme.accent.primary, border: "none", borderRadius: 5, padding: "3px 9px", color: "#fff", fontSize: 12, cursor: "pointer" }}>Add</button>
          </div>
        : <button onClick={() => setAddingNew(true)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, background: "transparent", border: `1px dashed ${theme.bg.border}`, color: theme.text.muted, fontSize: 12, cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.accent.primary + "66"; e.currentTarget.style.color = theme.accent.primary; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.bg.border; e.currentTarget.style.color = theme.text.muted; }}>
            <Plus size={11} /> Add Floor
          </button>
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function FacilityMap() {
  const map = useFacilityMap();
  const [searchParams, setSearchParams] = useSearchParams();

  // Backend zone metadata (names, types) — fetched once, doesn't change often
  const [backendZones, setBackendZones]   = useState<Zone[]>([]);
  const [initialAssets, setInitialAssets] = useState<Asset[]>([]);
  const [selectedZone, setSelectedZone]   = useState<MapZone | null>(null);

  // Right-panel tab: "zones" | "log"
  const [rightTab, setRightTab] = useState<"zones" | "log">("zones");

  // Draw state machine
  const [drawMode, setDrawMode]     = useState(false);
  const [draw, setDraw]             = useState<DrawState>({ phase: "idle" });
  const [mousePos, setMousePos]     = useState<Point | null>(null);
  const [hoveredDot, setHoveredDot] = useState<Asset | null>(null);

  const svgRef       = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const selectedZoneId = searchParams.get("zone") ?? null;

  // Initial REST load — gives us the full asset list to seed the WebSocket hook
  useEffect(() => { api.getZones().then(setBackendZones); }, []);
  useEffect(() => { api.getAssets({}).then(setInitialAssets); }, []);

  // Live feed — WebSocket keeps allAssets current after initial load
  // moves = ordered list of recent asset movements for the activity log
  const { assets: allAssets, moves, connected } = useAssetFeed(initialAssets);

  // Focus name input when naming phase starts
  useEffect(() => {
    if (draw.phase === "naming") setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [draw.phase]);

  // Clear selected zone when map zone is deleted
  useEffect(() => {
    if (selectedZone && !map.activeZones.find((z) => z.id === selectedZone.id)) {
      setSelectedZone(null);
      setSearchParams({});
    }
  }, [map.activeZones]);

  // ── Image upload ──────────────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => map.setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── SVG coordinate conversion ─────────────────────────────────────────────

  const toSVGPoint = useCallback((e: React.MouseEvent<SVGSVGElement>): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width)  * SVG_W,
      ((e.clientY - rect.top)  / rect.height) * SVG_H,
    ];
  }, []);

  // ── SVG events ────────────────────────────────────────────────────────────

  const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (drawMode) setMousePos(toSVGPoint(e));
  };

  const handleSVGClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawMode || e.detail === 2) return;
    const pt = toSVGPoint(e);
    setDraw((prev) => {
      if (prev.phase === "idle")    return { phase: "drawing", points: [pt] };
      if (prev.phase === "drawing") return { ...prev, points: [...prev.points, pt] };
      return prev;
    });
  };

  const handleSVGDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!drawMode) return;
    setDraw((prev) => {
      if (prev.phase !== "drawing" || prev.points.length < 3) return prev;
      return { phase: "naming", points: prev.points, name: "", backendZoneId: "" };
    });
    setMousePos(null);
  };

  // Snap-to-close
  const nearStart = draw.phase === "drawing" && draw.points.length >= 3 && mousePos !== null &&
    Math.hypot(mousePos[0] - draw.points[0][0], mousePos[1] - draw.points[0][1]) < 14;

  // ── Zone naming / save ────────────────────────────────────────────────────

  const saveZone = () => {
    if (draw.phase !== "naming" || !draw.name.trim()) return;
    map.addZone({
      id: uid(),
      name: draw.name.trim(),
      polygon: draw.points,
      backendZoneId: draw.backendZoneId !== "" ? draw.backendZoneId : undefined,
    });
    setDraw({ phase: "idle" });
  };

  const cancelDraw = () => {
    setDrawMode(false);
    setDraw({ phase: "idle" });
    setMousePos(null);
  };

  // ── Zone selection ────────────────────────────────────────────────────────

  const handleZoneClick = (zone: MapZone) => {
    if (drawMode) return;
    if (selectedZone?.id === zone.id) {
      setSelectedZone(null);
      setSearchParams({});
    } else {
      setSelectedZone(zone);
      setSearchParams({ zone: zone.id });
    }
  };

  // ── Asset helpers ─────────────────────────────────────────────────────────

  const assetsInZone = (zone: MapZone): Asset[] => {
    if (!zone.backendZoneId) return [];
    return allAssets.filter((a) => a.zone_id === zone.backendZoneId);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", height: "100vh", gap: 10 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ color: theme.text.primary, fontSize: 24, fontWeight: 700, margin: 0 }}>
            Facility Map
          </h1>
          <p style={{ color: theme.text.muted, fontSize: 14, marginTop: 4 }}>
            {drawMode
              ? draw.phase === "naming"
                ? "Name your zone and optionally link it to a tracking group"
                : "Click to place vertices · double-click to close the zone"
              : "Click a zone to inspect its assets"}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => fileInputRef.current?.click()}
            style={btnStyle(theme.bg.card, theme.bg.border, theme.text.secondary)}>
            <Upload size={14} /> Add Floor Plan
          </button>
          {map.activeImage && (
            <button onClick={map.clearImage} title="Remove floor plan"
              style={btnStyle(theme.bg.card, theme.bg.border, theme.text.muted)}>
              <ImageOff size={14} />
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />

          {drawMode ? (
            <button onClick={cancelDraw}
              style={btnStyle(theme.accent.danger + "18", theme.accent.danger + "55", theme.accent.danger)}>
              <X size={14} /> Cancel
            </button>
          ) : (
            <button onClick={() => { setDrawMode(true); setSelectedZone(null); setSearchParams({}); }}
              style={btnStyle(theme.accent.primaryDim, theme.accent.primary + "55", theme.accent.primary)}>
              <Pencil size={14} /> Draw Zone
            </button>
          )}
        </div>
      </div>

      {/* ── Building + Floor selectors ──────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 10, borderBottom: `1px solid ${theme.bg.border}`, flexWrap: "wrap" }}>
        <BuildingDropdown
          buildings={map.buildings} activeBuildingId={map.activeBuildingId}
          onSelect={map.selectBuilding} onAdd={map.addBuilding}
          onRename={map.renameBuilding} onDelete={map.deleteBuilding}
        />
        <div style={{ width: 1, height: 24, background: theme.bg.border, flexShrink: 0 }} />
        <FloorPills
          floors={map.activeBuilding?.floors ?? []} activeFloorId={map.activeFloorId}
          onSelect={map.selectFloor} onAdd={map.addFloor}
          onRename={map.renameFloor} onDelete={map.deleteFloor}
        />
      </div>

      {/* ── Canvas + right panel ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, flex: 1, minHeight: 0 }}>

        {/* SVG canvas */}
        <div style={{ background: theme.bg.card, borderRadius: 12, padding: 14, border: `1px solid ${theme.bg.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{
              width: "100%", flex: 1, borderRadius: 8, userSelect: "none",
              cursor: drawMode
                ? (draw.phase === "naming" ? "default" : "crosshair")
                : "default",
            }}
            onClick={handleSVGClick}
            onMouseMove={handleSVGMouseMove}
            onDoubleClick={handleSVGDoubleClick}
            onMouseLeave={() => setMousePos(null)}
          >
            {/* Background */}
            {map.activeImage ? (
              <>
                <image href={map.activeImage} x="0" y="0" width={SVG_W} height={SVG_H} preserveAspectRatio="xMidYMid slice" />
                <rect width={SVG_W} height={SVG_H} fill="rgba(0,0,0,0.38)" />
              </>
            ) : (
              <>
                <rect width={SVG_W} height={SVG_H} fill={theme.bg.primary} rx="8" />
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke={theme.bg.border} strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width={SVG_W} height={SVG_H} fill="url(#grid)" rx="8" />
                <text x={SVG_W / 2} y={SVG_H / 2 - 10} textAnchor="middle"
                  fill={theme.text.muted} fontSize={14} fontFamily="-apple-system, sans-serif">
                  Click "Add Floor Plan" to upload a CAD drawing or facility photo
                </text>
                <text x={SVG_W / 2} y={SVG_H / 2 + 12} textAnchor="middle"
                  fill={theme.text.muted} fontSize={12} fontFamily="-apple-system, sans-serif">
                  Then use "Draw Zone" to outline areas and assign names
                </text>
              </>
            )}

            {/* ── Saved map zones ───────────────────────────────────────────── */}
            {map.activeZones.map((zone, idx) => {
              if (zone.polygon.length < 3) return null;
              const color    = zoneColor(idx);
              const isSel    = selectedZone?.id === zone.id;
              const [cx, cy] = centroid(zone.polygon);
              const assets   = assetsInZone(zone);
              const dots     = dotPositions(cx, cy, assets.length);

              return (
                <g key={zone.id} onClick={() => handleZoneClick(zone)}
                  style={{ cursor: drawMode ? "default" : "pointer" }}>
                  <polygon points={polyStr(zone.polygon)}
                    fill={isSel ? `${color}40` : `${color}1e`}
                    stroke={color}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    strokeLinejoin="round" />

                  {/* Zone name */}
                  <text x={cx} y={cy - 12} textAnchor="middle"
                    fill="#fff" fontSize={11} fontWeight={700}
                    fontFamily="-apple-system, sans-serif"
                    style={{ pointerEvents: "none" }}>
                    {zone.name}
                  </text>

                  {/* Asset count badge */}
                  {zone.backendZoneId && (
                    <text x={cx} y={cy + 4} textAnchor="middle"
                      fill={color} fontSize={16} fontWeight={700}
                      fontFamily="-apple-system, sans-serif"
                      style={{ pointerEvents: "none" }}>
                      {assets.length}
                      <tspan fill="rgba(255,255,255,0.45)" fontSize={9} fontWeight={400}> assets</tspan>
                    </text>
                  )}

                  {/* Asset dots */}
                  {assets.map((asset, di) => (
                    <g key={asset.id}>
                      <circle
                        cx={dots[di]?.[0] ?? cx} cy={dots[di]?.[1] ?? cy + 20}
                        r={5}
                        fill={STATUS_COLOR[asset.status] ?? theme.text.muted}
                        stroke="rgba(0,0,0,0.4)" strokeWidth={1}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={() => setHoveredDot(asset)}
                        onMouseLeave={() => setHoveredDot(null)}
                      />
                      {hoveredDot?.id === asset.id && (
                        <g style={{ pointerEvents: "none" }}>
                          <rect
                            x={(dots[di]?.[0] ?? cx) + 8}
                            y={(dots[di]?.[1] ?? cy + 20) - 16}
                            width={130} height={32} rx={4}
                            fill="rgba(0,0,0,0.85)"
                            stroke={theme.bg.border}
                            strokeWidth={1}
                          />
                          <text
                            x={(dots[di]?.[0] ?? cx) + 14}
                            y={(dots[di]?.[1] ?? cy + 20) - 4}
                            fill="#fff" fontSize={10} fontWeight={600}
                            fontFamily="-apple-system, sans-serif">
                            {asset.name}
                          </text>
                          <text
                            x={(dots[di]?.[0] ?? cx) + 14}
                            y={(dots[di]?.[1] ?? cy + 20) + 9}
                            fill={STATUS_COLOR[asset.status]} fontSize={9}
                            fontFamily="-apple-system, sans-serif">
                            {asset.asset_tag} · {asset.status}
                          </text>
                        </g>
                      )}
                    </g>
                  ))}
                </g>
              );
            })}

            {/* ── Active drawing overlay ─────────────────────────────────────── */}
            {draw.phase === "drawing" && draw.points.length > 0 && (
              <g style={{ pointerEvents: "none" }}>
                {draw.points.length >= 3 && (
                  <polygon points={polyStr(draw.points)} fill={`${theme.accent.primary}15`} stroke="none" />
                )}
                {draw.points.map((pt, i) => i === 0 ? null : (
                  <line key={i}
                    x1={draw.points[i - 1][0]} y1={draw.points[i - 1][1]}
                    x2={pt[0]} y2={pt[1]}
                    stroke={theme.accent.primary} strokeWidth={2} />
                ))}
                {mousePos && (
                  <line
                    x1={draw.points[draw.points.length - 1][0]}
                    y1={draw.points[draw.points.length - 1][1]}
                    x2={nearStart ? draw.points[0][0] : mousePos[0]}
                    y2={nearStart ? draw.points[0][1] : mousePos[1]}
                    stroke={theme.accent.primary} strokeWidth={1.5}
                    strokeDasharray="5 3" opacity={0.6} />
                )}
                {draw.points.map((pt, i) => {
                  const snap = i === 0 && nearStart;
                  return (
                    <circle key={i} cx={pt[0]} cy={pt[1]}
                      r={snap ? 9 : (i === 0 ? 5 : 4)}
                      fill={i === 0 ? (snap ? theme.accent.primary : "#fff") : theme.accent.primary}
                      stroke={theme.accent.primary} strokeWidth={2} />
                  );
                })}
                {nearStart && (
                  <text x={draw.points[0][0] + 13} y={draw.points[0][1] - 8}
                    fill="#fff" fontSize={10} fontFamily="-apple-system, sans-serif">
                    double-click to close
                  </text>
                )}
              </g>
            )}

            {/* Greyed preview polygon during naming phase */}
            {draw.phase === "naming" && (
              <polygon points={polyStr(draw.points)}
                fill={`${theme.accent.primary}20`}
                stroke={theme.accent.primary}
                strokeWidth={2} strokeDasharray="6 3" strokeLinejoin="round" />
            )}
          </svg>

          {/* Legend */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: theme.text.muted, fontSize: 11 }}>Asset status:</span>
            {Object.entries(STATUS_COLOR).map(([s, c]) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                <span style={{ color: theme.text.muted, fontSize: 11, textTransform: "capitalize" }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────────── */}
        <div style={{ background: theme.bg.card, borderRadius: 12, border: `1px solid ${theme.bg.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Tab bar — only show when not in draw/naming mode */}
          {!drawMode && draw.phase !== "naming" && !selectedZone && (
            <div style={{ display: "flex", borderBottom: `1px solid ${theme.bg.border}`, flexShrink: 0 }}>
              {([
                { id: "zones", label: "Zones",   icon: <List size={13} /> },
                { id: "log",   label: "Activity", icon: <Radio size={13} color={connected ? theme.accent.primary : theme.text.muted} /> },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "10px 0", background: "transparent", border: "none",
                    borderBottom: `2px solid ${rightTab === tab.id ? theme.accent.primary : "transparent"}`,
                    color: rightTab === tab.id ? theme.accent.primary : theme.text.muted,
                    fontSize: 12, fontWeight: rightTab === tab.id ? 600 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {tab.icon} {tab.label}
                  {tab.id === "log" && moves.length > 0 && (
                    <span style={{ background: theme.accent.primary, color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 8, marginLeft: 2 }}>
                      {moves.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
            {draw.phase === "naming" ? (
              <NamingPanel
                ref={nameInputRef}
                draw={draw}
                backendZones={backendZones}
                onChange={(patch) => setDraw((prev) => prev.phase === "naming" ? { ...prev, ...patch } : prev)}
                onSave={saveZone}
                onCancel={() => setDraw({ phase: "idle" })}
              />
            ) : drawMode ? (
              <DrawHintPanel pointCount={draw.phase === "drawing" ? draw.points.length : 0} />
            ) : selectedZone ? (
              <ZoneDetailPanel
                zone={selectedZone}
                assets={assetsInZone(selectedZone)}
                backendZone={backendZones.find((z) => z.id === selectedZone.backendZoneId)}
                onBack={() => { setSelectedZone(null); setSearchParams({}); }}
                onDelete={() => { map.deleteZone(selectedZone.id); setSelectedZone(null); setSearchParams({}); }}
              />
            ) : rightTab === "log" ? (
              <MovementLog moves={moves} connected={connected} />
            ) : (
              <ZoneListPanel
                zones={map.activeZones}
                allAssets={allAssets}
                selectedZoneId={selectedZone?.id ?? null}
                onSelect={handleZoneClick}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NamingPanel — shown in right panel after polygon is closed
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";

const NamingPanel = React.forwardRef<
  HTMLInputElement,
  {
    draw: Extract<DrawState, { phase: "naming" }>;
    backendZones: Zone[];
    onChange: (patch: Partial<Extract<DrawState, { phase: "naming" }>>) => void;
    onSave: () => void;
    onCancel: () => void;
  }
>(({ draw, backendZones, onChange, onSave, onCancel }, ref) => (
  <div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: theme.accent.primaryDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Crosshair size={16} color={theme.accent.primary} />
      </div>
      <div>
        <div style={{ color: theme.text.primary, fontSize: 14, fontWeight: 600 }}>Name this zone</div>
        <div style={{ color: theme.text.muted, fontSize: 12 }}>{draw.points.length} vertices drawn</div>
      </div>
    </div>

    <div style={{ marginBottom: 14 }}>
      <label style={{ color: theme.text.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
        Zone name
      </label>
      <input
        ref={ref}
        value={draw.name}
        onChange={(e) => onChange({ name: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        placeholder="e.g. Tool Crib Alpha, Bay 3, Engine Stand Row B…"
        style={{
          width: "100%", boxSizing: "border-box",
          background: theme.bg.primary, border: `1px solid ${theme.bg.border}`,
          borderRadius: 7, padding: "9px 12px",
          color: theme.text.primary, fontSize: 13, outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => { e.target.style.borderColor = theme.accent.primary + "66"; }}
        onBlur={(e) => { e.target.style.borderColor = theme.bg.border; }}
      />
    </div>

    <div style={{ marginBottom: 20 }}>
      <label style={{ color: theme.text.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
        Link to tracking group <span style={{ textTransform: "none", color: theme.text.muted }}>(optional)</span>
      </label>
      <select
        value={draw.backendZoneId}
        onChange={(e) => onChange({ backendZoneId: e.target.value === "" ? "" : Number(e.target.value) })}
        style={{
          width: "100%", boxSizing: "border-box",
          background: theme.bg.primary, border: `1px solid ${theme.bg.border}`,
          borderRadius: 7, padding: "8px 12px",
          color: theme.text.primary, fontSize: 13, outline: "none",
        }}
      >
        <option value="">— none —</option>
        {backendZones.map((z) => (
          <option key={z.id} value={z.id}>{z.name} ({z.asset_count} assets)</option>
        ))}
      </select>
      <p style={{ color: theme.text.muted, fontSize: 11, margin: "6px 0 0 0", lineHeight: 1.5 }}>
        Linking shows live asset dots inside this zone pulled from the tracking system.
      </p>
    </div>

    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={onSave}
        disabled={!draw.name.trim()}
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "9px 0", borderRadius: 7,
          background: draw.name.trim() ? theme.accent.primary : theme.bg.border,
          border: "none", color: draw.name.trim() ? "#fff" : theme.text.muted,
          fontSize: 13, fontWeight: 600, cursor: draw.name.trim() ? "pointer" : "not-allowed",
          transition: "background 0.15s",
        }}
      >
        <Check size={14} /> Save Zone
      </button>
      <button onClick={onCancel}
        style={{ padding: "9px 14px", borderRadius: 7, background: theme.bg.primary, border: `1px solid ${theme.bg.border}`, color: theme.text.secondary, fontSize: 13, cursor: "pointer" }}>
        Cancel
      </button>
    </div>
  </div>
));

// ─────────────────────────────────────────────────────────────────────────────
// DrawHintPanel — shown while drawing (before polygon closed)
// ─────────────────────────────────────────────────────────────────────────────

function DrawHintPanel({ pointCount }: { pointCount: number }) {
  return (
    <div>
      <h2 style={{ color: theme.text.primary, fontSize: 15, fontWeight: 600, margin: "0 0 4px 0" }}>
        Drawing a zone
      </h2>
      <p style={{ color: theme.text.muted, fontSize: 13, margin: "0 0 20px 0" }}>
        {pointCount === 0
          ? "Click anywhere on the floor plan to start"
          : `${pointCount} point${pointCount === 1 ? "" : "s"} placed${pointCount >= 3 ? " — double-click to close" : ""}`}
      </p>
      <div style={{ padding: 14, background: theme.bg.primary, borderRadius: 8 }}>
        <p style={{ color: theme.text.muted, fontSize: 12, margin: 0, lineHeight: 1.8 }}>
          <strong style={{ color: theme.text.secondary }}>Controls</strong><br />
          Click → place a vertex<br />
          Double-click → close the shape<br />
          Hover near first point → snap-to-close<br />
          Cancel → discard current drawing
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ZoneDetailPanel
// ─────────────────────────────────────────────────────────────────────────────

function ZoneDetailPanel({ zone, assets, backendZone, onBack, onDelete }: {
  zone: MapZone; assets: Asset[]; backendZone: Zone | undefined;
  onBack: () => void; onDelete: () => void;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: theme.accent.primary, cursor: "pointer", fontSize: 13, padding: 0 }}>
          <ArrowLeft size={14} /> All zones
        </button>
        <button onClick={onDelete} title="Delete this zone"
          style={{ background: "none", border: "none", color: theme.text.muted, cursor: "pointer", padding: 4 }}>
          <X size={15} />
        </button>
      </div>

      <h2 style={{ color: theme.text.primary, fontSize: 17, fontWeight: 600, margin: "0 0 4px 0" }}>{zone.name}</h2>
      {backendZone && (
        <p style={{ color: theme.text.muted, fontSize: 12, margin: "0 0 16px 0" }}>
          Linked to tracking group: <span style={{ color: theme.accent.primary }}>{backendZone.name}</span>
        </p>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <div style={{ background: theme.bg.primary, borderRadius: 8, padding: "10px 14px", flex: 1, textAlign: "center" }}>
          <div style={{ color: theme.text.muted, fontSize: 10, textTransform: "uppercase" }}>Assets here</div>
          <div style={{ color: theme.accent.primary, fontSize: 22, fontWeight: 700 }}>{assets.length}</div>
        </div>
        <div style={{ background: theme.bg.primary, borderRadius: 8, padding: "10px 14px", flex: 1, textAlign: "center" }}>
          <div style={{ color: theme.text.muted, fontSize: 10, textTransform: "uppercase" }}>Active</div>
          <div style={{ color: theme.accent.primary, fontSize: 22, fontWeight: 700 }}>
            {assets.filter((a) => a.status === "active").length}
          </div>
        </div>
      </div>

      {assets.length === 0 && (
        <p style={{ color: theme.text.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>
          {zone.backendZoneId
            ? "No assets currently in this zone"
            : "Link this zone to a tracking group to see live assets"}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {assets.map((asset) => (
          <Link key={asset.id} to={`/assets?id=${asset.id}`}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderRadius: 6, background: theme.bg.primary, textDecoration: "none", transition: "background 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = theme.bg.cardHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = theme.bg.primary; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[asset.status] ?? theme.text.muted }} />
              <div>
                <div style={{ color: theme.text.primary, fontSize: 13, fontWeight: 500 }}>{asset.name}</div>
                <div style={{ color: theme.text.muted, fontSize: 11 }}>{asset.asset_tag} · {asset.status}</div>
              </div>
            </div>
            <ChevronRight size={13} color={theme.text.muted} />
          </Link>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ZoneListPanel
// ─────────────────────────────────────────────────────────────────────────────

function ZoneListPanel({ zones, allAssets, selectedZoneId, onSelect }: {
  zones: MapZone[]; allAssets: Asset[]; selectedZoneId: string | null; onSelect: (z: MapZone) => void;
}) {
  return (
    <>
      <h2 style={{ color: theme.text.primary, fontSize: 15, fontWeight: 600, margin: "0 0 4px 0" }}>Zones</h2>
      <p style={{ color: theme.text.muted, fontSize: 12, margin: "0 0 14px 0" }}>
        {zones.length === 0
          ? 'No zones drawn yet — click "Draw Zone" to get started'
          : `${zones.length} zone${zones.length === 1 ? "" : "s"} on this floor`}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {zones.map((zone, idx) => {
          const color     = zoneColor(idx);
          const assets    = zone.backendZoneId
            ? allAssets.filter((a) => a.zone_id === zone.backendZoneId)
            : [];
          const isSel     = zone.id === selectedZoneId;
          return (
            <div key={zone.id} onClick={() => onSelect(zone)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 7, cursor: "pointer", background: isSel ? `${color}18` : theme.bg.primary, border: `1px solid ${isSel ? color + "66" : "transparent"}`, transition: "background 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isSel ? `${color}18` : theme.bg.cardHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? `${color}18` : theme.bg.primary; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                <div>
                  <div style={{ color: theme.text.primary, fontSize: 13, fontWeight: 500 }}>{zone.name}</div>
                  {!zone.backendZoneId && (
                    <div style={{ color: theme.text.muted, fontSize: 11 }}>not linked to tracking</div>
                  )}
                </div>
              </div>
              {zone.backendZoneId ? (
                <span style={{ background: `${color}22`, color, padding: "2px 9px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                  {assets.length}
                </span>
              ) : (
                <span style={{ color: theme.text.muted, fontSize: 11 }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
