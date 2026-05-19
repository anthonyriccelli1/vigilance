from datetime import datetime
from pydantic import BaseModel


class ZoneBase(BaseModel):
    name: str
    description: str | None = None
    zone_type: str | None = None


class ZoneResponse(ZoneBase):
    id: int
    asset_count: int = 0

    model_config = {"from_attributes": True}


class AssetBase(BaseModel):
    name: str
    category: str
    status: str = "active"
    owner: str | None = None
    compliant: bool = True
    compliance_type: str | None = None
    notes: str | None = None


class AssetResponse(AssetBase):
    id: int
    asset_tag: str
    last_seen: datetime
    zone_id: int
    zone_name: str | None = None

    model_config = {"from_attributes": True}


class AssetMoveRequest(BaseModel):
    zone_id: int


class DashboardStats(BaseModel):
    total_assets: int
    active_assets: int
    inactive_assets: int
    maintenance_assets: int
    compliant_assets: int
    non_compliant_assets: int
    zones: list[ZoneResponse]
