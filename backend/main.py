from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from database import engine, get_db
from models import Base, Asset, Zone
from schemas import AssetResponse, ZoneResponse, AssetMoveRequest, DashboardStats
from seed_data import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = Session(bind=engine)
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Vigilance API",
    description="Real-time operational asset tracking for facility management",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "vigilance-api"}


@app.get("/assets", response_model=list[AssetResponse])
def get_assets(
    status: str | None = Query(None, description="Filter by status: active, inactive, maintenance"),
    category: str | None = Query(None, description="Filter by category"),
    zone_id: int | None = Query(None, description="Filter by zone ID"),
    db: Session = Depends(get_db),
):
    query = db.query(Asset)
    if status:
        query = query.filter(Asset.status == status)
    if category:
        query = query.filter(Asset.category == category)
    if zone_id:
        query = query.filter(Asset.zone_id == zone_id)

    assets = query.all()
    results = []
    for asset in assets:
        data = AssetResponse.model_validate(asset)
        data.zone_name = asset.zone.name
        results.append(data)
    return results


@app.get("/assets/{asset_id}", response_model=AssetResponse)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    data = AssetResponse.model_validate(asset)
    data.zone_name = asset.zone.name
    return data


@app.post("/assets/{asset_id}/move", response_model=AssetResponse)
def move_asset(asset_id: int, request: AssetMoveRequest, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    zone = db.query(Zone).filter(Zone.id == request.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    asset.zone_id = request.zone_id
    db.commit()
    db.refresh(asset)

    data = AssetResponse.model_validate(asset)
    data.zone_name = asset.zone.name
    return data


@app.get("/zones", response_model=list[ZoneResponse])
def get_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    results = []
    for zone in zones:
        data = ZoneResponse.model_validate(zone)
        data.asset_count = db.query(Asset).filter(Asset.zone_id == zone.id).count()
        results.append(data)
    return results


@app.get("/zones/{zone_id}", response_model=ZoneResponse)
def get_zone(zone_id: int, db: Session = Depends(get_db)):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    data = ZoneResponse.model_validate(zone)
    data.asset_count = db.query(Asset).filter(Asset.zone_id == zone.id).count()
    return data


@app.get("/dashboard", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db)):
    total = db.query(Asset).count()
    active = db.query(Asset).filter(Asset.status == "active").count()
    inactive = db.query(Asset).filter(Asset.status == "inactive").count()
    maintenance = db.query(Asset).filter(Asset.status == "maintenance").count()
    compliant = db.query(Asset).filter(Asset.compliant == True).count()

    zones = db.query(Zone).all()
    zone_responses = []
    for zone in zones:
        data = ZoneResponse.model_validate(zone)
        data.asset_count = db.query(Asset).filter(Asset.zone_id == zone.id).count()
        zone_responses.append(data)

    return DashboardStats(
        total_assets=total,
        active_assets=active,
        inactive_assets=inactive,
        maintenance_assets=maintenance,
        compliant_assets=compliant,
        non_compliant_assets=total - compliant,
        zones=zone_responses,
    )
