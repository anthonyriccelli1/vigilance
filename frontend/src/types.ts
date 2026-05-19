export interface Zone {
  id: number;
  name: string;
  description: string | null;
  zone_type: string | null;
  asset_count: number;
}

export interface Asset {
  id: number;
  asset_tag: string;
  name: string;
  category: string;
  status: "active" | "inactive" | "maintenance";
  owner: string | null;
  last_seen: string;
  compliant: boolean;
  compliance_type: string | null;
  notes: string | null;
  zone_id: number;
  zone_name: string | null;
}

export interface DashboardStats {
  total_assets: number;
  active_assets: number;
  inactive_assets: number;
  maintenance_assets: number;
  compliant_assets: number;
  non_compliant_assets: number;
  zones: Zone[];
}
