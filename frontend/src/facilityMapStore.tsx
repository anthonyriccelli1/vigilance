/**
 * facilityMapStore.tsx
 *
 * Lives above the router so state survives page navigation.
 *
 * KEY CONCEPTS:
 * - MapZone: a user-drawn polygon with a free-form name.  These are the
 *   "visual zones" on the floor plan.  They optionally link to a backend
 *   zone (via backendZoneId) so asset counts / lists can be pulled from
 *   the API for that zone.
 * - Per-floor: each building floor has its own set of MapZones and its own
 *   background image (CAD drawing / facility photo).
 * - Images live in React state (never localStorage) so they survive
 *   navigation.  localStorage is a best-effort persistence layer for small
 *   files only.
 */

import { createContext, useContext, useState, ReactNode } from "react";

// ─── Core types ───────────────────────────────────────────────────────────────

export type Point = [number, number];

export interface MapZone {
  id: string;          // local uuid
  name: string;        // user-typed — completely free-form
  polygon: Point[];
  /**
   * Optional link to a backend Zone (by its DB id).
   * When set, asset counts and asset lists for that backend zone
   * are shown inside this drawn polygon.
   */
  backendZoneId?: number;
}

export interface Floor {
  id: string;
  name: string;
}

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const BUILDINGS_KEY = "vigilance_buildings";
const zonesKey = (b: string, f: string) => `vigilance_zones_${b}_${f}`;
const imageKey = (b: string, f: string) => `vigilance_img_${b}_${f}`;

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* quota — in-memory is source of truth */ }
}
function lsRemove(k: string) {
  try { localStorage.removeItem(k); } catch { /* ignore */ }
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_BUILDINGS: Building[] = [
  { id: "b1", name: "Main Facility", floors: [{ id: "f1", name: "Ground Floor" }] },
];

function loadBuildings(): Building[] {
  try { const r = lsGet(BUILDINGS_KEY); return r ? JSON.parse(r) : DEFAULT_BUILDINGS; }
  catch { return DEFAULT_BUILDINGS; }
}

function loadZones(b: string, f: string): MapZone[] {
  try { const r = lsGet(zonesKey(b, f)); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

function loadAllZones(buildings: Building[]): Record<string, MapZone[]> {
  const out: Record<string, MapZone[]> = {};
  for (const b of buildings)
    for (const f of b.floors)
      out[`${b.id}_${f.id}`] = loadZones(b.id, f.id);
  return out;
}

function loadAllImages(buildings: Building[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of buildings)
    for (const f of b.floors) {
      const v = lsGet(imageKey(b.id, f.id));
      if (v) out[`${b.id}_${f.id}`] = v;
    }
  return out;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Context shape ────────────────────────────────────────────────────────────

interface FacilityMapStore {
  buildings:        Building[];
  activeBuildingId: string;
  activeFloorId:    string;
  images:           Record<string, string>;
  zones:            Record<string, MapZone[]>;  // keyed by "bId_fId"

  // Derived
  activeKey:      string;
  activeBuilding: Building | undefined;
  activeImage:    string | null;
  activeZones:    MapZone[];

  // Building actions
  selectBuilding: (id: string) => void;
  addBuilding:    (name: string) => void;
  renameBuilding: (id: string, name: string) => void;
  deleteBuilding: (id: string) => void;

  // Floor actions
  selectFloor: (id: string) => void;
  addFloor:    (name: string) => void;
  renameFloor: (id: string, name: string) => void;
  deleteFloor: (id: string) => void;

  // Image actions
  setImage:   (dataUrl: string) => void;
  clearImage: () => void;

  // Zone actions
  addZone:    (zone: MapZone) => void;
  updateZone: (id: string, patch: Partial<MapZone>) => void;
  deleteZone: (id: string) => void;
}

const Ctx = createContext<FacilityMapStore>(null!);
export function useFacilityMap() { return useContext(Ctx); }

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FacilityMapProvider({ children }: { children: ReactNode }) {
  const [buildings, setBuildings] = useState<Building[]>(loadBuildings);
  const [activeBuildingId, setActiveBuildingId] = useState(
    () => loadBuildings()[0]?.id ?? "b1",
  );
  const [activeFloorId, setActiveFloorId] = useState(
    () => loadBuildings()[0]?.floors[0]?.id ?? "f1",
  );
  const [images, setImages] = useState<Record<string, string>>(
    () => loadAllImages(loadBuildings()),
  );
  const [zones, setAllZones] = useState<Record<string, MapZone[]>>(
    () => loadAllZones(loadBuildings()),
  );

  const activeKey      = `${activeBuildingId}_${activeFloorId}`;
  const activeBuilding = buildings.find((b) => b.id === activeBuildingId);
  const activeImage    = images[activeKey] ?? null;
  const activeZones    = zones[activeKey] ?? [];

  // ── Helpers ──────────────────────────────────────────────────────────────

  const saveBuildings = (b: Building[]) => {
    setBuildings(b);
    lsSet(BUILDINGS_KEY, JSON.stringify(b));
  };

  const saveZones = (key: string, z: MapZone[]) => {
    setAllZones((prev) => ({ ...prev, [key]: z }));
    const [bId, fId] = key.split("_");
    lsSet(zonesKey(bId, fId), JSON.stringify(z));
  };

  // ── Building actions ──────────────────────────────────────────────────────

  const selectBuilding = (id: string) => {
    const b = buildings.find((x) => x.id === id);
    if (!b) return;
    setActiveBuildingId(id);
    setActiveFloorId(b.floors[0]?.id ?? "");
  };

  const addBuilding = (name: string) => {
    const bId = uid(), fId = uid();
    saveBuildings([...buildings, { id: bId, name, floors: [{ id: fId, name: "Ground Floor" }] }]);
    setActiveBuildingId(bId);
    setActiveFloorId(fId);
  };

  const renameBuilding = (id: string, name: string) =>
    saveBuildings(buildings.map((b) => b.id === id ? { ...b, name } : b));

  const deleteBuilding = (id: string) => {
    const updated = buildings.filter((b) => b.id !== id);
    if (!updated.length) return;
    saveBuildings(updated);
    if (activeBuildingId === id) {
      setActiveBuildingId(updated[0].id);
      setActiveFloorId(updated[0].floors[0]?.id ?? "");
    }
  };

  // ── Floor actions ─────────────────────────────────────────────────────────

  const selectFloor = (id: string) => setActiveFloorId(id);

  const addFloor = (name: string) => {
    const fId = uid();
    saveBuildings(buildings.map((b) =>
      b.id === activeBuildingId ? { ...b, floors: [...b.floors, { id: fId, name }] } : b,
    ));
    setActiveFloorId(fId);
  };

  const renameFloor = (id: string, name: string) =>
    saveBuildings(buildings.map((b) =>
      b.id === activeBuildingId
        ? { ...b, floors: b.floors.map((f) => f.id === id ? { ...f, name } : f) }
        : b,
    ));

  const deleteFloor = (id: string) => {
    const building = buildings.find((b) => b.id === activeBuildingId);
    if (!building || building.floors.length <= 1) return;
    const k = `${activeBuildingId}_${id}`;
    setImages((prev) => { const n = { ...prev }; delete n[k]; return n; });
    lsRemove(imageKey(activeBuildingId, id));
    lsRemove(zonesKey(activeBuildingId, id));
    saveBuildings(buildings.map((b) =>
      b.id === activeBuildingId ? { ...b, floors: b.floors.filter((f) => f.id !== id) } : b,
    ));
    if (activeFloorId === id) {
      const remaining = buildings.find((b) => b.id === activeBuildingId)
        ?.floors.find((f) => f.id !== id);
      if (remaining) setActiveFloorId(remaining.id);
    }
  };

  // ── Image actions ─────────────────────────────────────────────────────────

  const setImage = (dataUrl: string) => {
    setImages((prev) => ({ ...prev, [activeKey]: dataUrl }));
    lsSet(imageKey(activeBuildingId, activeFloorId), dataUrl);
  };

  const clearImage = () => {
    setImages((prev) => { const n = { ...prev }; delete n[activeKey]; return n; });
    lsRemove(imageKey(activeBuildingId, activeFloorId));
  };

  // ── Zone actions ──────────────────────────────────────────────────────────

  const addZone = (zone: MapZone) => saveZones(activeKey, [...activeZones, zone]);

  const updateZone = (id: string, patch: Partial<MapZone>) =>
    saveZones(activeKey, activeZones.map((z) => z.id === id ? { ...z, ...patch } : z));

  const deleteZone = (id: string) =>
    saveZones(activeKey, activeZones.filter((z) => z.id !== id));

  // ── Context value ─────────────────────────────────────────────────────────

  return (
    <Ctx.Provider value={{
      buildings, activeBuildingId, activeFloorId, images, zones,
      activeKey, activeBuilding, activeImage, activeZones,
      selectBuilding, addBuilding, renameBuilding, deleteBuilding,
      selectFloor, addFloor, renameFloor, deleteFloor,
      setImage, clearImage,
      addZone, updateZone, deleteZone,
    }}>
      {children}
    </Ctx.Provider>
  );
}
