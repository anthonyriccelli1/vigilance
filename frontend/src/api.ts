import { Asset, Zone, DashboardStats } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  getDashboard: () => request<DashboardStats>("/dashboard"),

  getAssets: (params?: { status?: string; zone_id?: number }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.zone_id) search.set("zone_id", String(params.zone_id));
    const query = search.toString();
    return request<Asset[]>(`/assets${query ? `?${query}` : ""}`);
  },

  getAsset: (id: number) => request<Asset>(`/assets/${id}`),

  moveAsset: (id: number, zoneId: number) =>
    request<Asset>(`/assets/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ zone_id: zoneId }),
    }),

  getZones: () => request<Zone[]>("/zones"),
};
