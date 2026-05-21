import asyncio
from contextlib import asynccontextmanager

import anthropic
from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import engine, get_db
from models import Base, Asset, Zone
from schemas import AssetResponse, ZoneResponse, AssetMoveRequest, DashboardStats
from seed_data import seed_database
from simulator import simulator


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Boot DB and seed
    Base.metadata.create_all(bind=engine)
    db = Session(bind=engine)
    try:
        seed_database(db)
    finally:
        db.close()

    # Start the asset movement simulator as a background task.
    # In production this slot would be filled by a UDP listener that receives
    # packets from ceiling-mounted RFID readers and writes zone changes to Postgres.
    sim_task = asyncio.create_task(simulator.start())

    yield

    # Graceful shutdown
    simulator.stop()
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Vigilance API",
    description="Real-time operational asset tracking for facility management",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://vigilance-frontend.s3-website-us-east-1.amazonaws.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "vigilance-api"}


@app.get("/health/detailed")
def health_detailed(db: Session = Depends(get_db)):
    """
    Deep health check — verifies API is up AND database is reachable.
    Returns response time for the DB query so the frontend can display latency.
    """
    import time

    # Measure how long a simple DB query takes
    db_start = time.monotonic()
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_latency_ms = round((time.monotonic() - db_start) * 1000, 1)
        db_status = "healthy"
    except Exception as e:
        db_latency_ms = None
        db_status = f"unreachable: {str(e)}"

    return {
        "api":      "healthy",
        "database": db_status,
        "db_latency_ms": db_latency_ms,
        "service":  "vigilance-api",
    }


@app.websocket("/ws")
async def websocket_feed(websocket: WebSocket):
    """
    Persistent WebSocket feed for real-time asset movement events.

    The client connects once on page load and stays connected.  When the
    simulator (or, in production, the UDP listener) moves an asset it calls
    simulator.broadcast(), which pushes a JSON event to every subscriber here.

    Event shape:
        {
            "type":           "asset_moved",
            "asset_id":       5,
            "asset_tag":      "A-042",
            "asset_name":     "Torque Wrench Set",
            "asset_status":   "active",
            "from_zone_id":   2,
            "from_zone_name": "Parts Storage",
            "to_zone_id":     1,
            "to_zone_name":   "Maintenance Bay A",
            "timestamp":      "2026-05-20T14:32:07.123456+00:00"
        }
    """
    await websocket.accept()
    simulator.add_subscriber(websocket)
    try:
        # Keep the connection alive — we only send, never expect client messages,
        # but receive_text() lets us detect disconnects cleanly.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        simulator.remove_subscriber(websocket)


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


# ─────────────────────────────────────────
# AI CHATBOT ENDPOINT
# ─────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    AI assistant endpoint. Fetches live data from the database,
    injects it into the system prompt, then asks Claude to answer
    the user's question based on that real data.

    This is the RAG-adjacent pattern — grounding the AI in real data
    so it never hallucinates asset counts or zone assignments.
    """

    # Step 1: Fetch live data from the database
    total = db.query(Asset).count()
    active = db.query(Asset).filter(Asset.status == "active").count()
    inactive = db.query(Asset).filter(Asset.status == "inactive").count()
    maintenance = db.query(Asset).filter(Asset.status == "maintenance").count()
    non_compliant = db.query(Asset).filter(Asset.compliant == False).count()

    zones = db.query(Zone).all()
    zone_summary = "\n".join([
        f"  - {zone.name} ({zone.zone_type}): "
        f"{db.query(Asset).filter(Asset.zone_id == zone.id).count()} assets"
        for zone in zones
    ])

    # Step 2: Fetch non-compliant assets for context
    non_compliant_assets = db.query(Asset).filter(Asset.compliant == False).all()
    non_compliant_list = "\n".join([
        f"  - {a.asset_tag} {a.name} in {a.zone.name} ({a.compliance_type})"
        for a in non_compliant_assets[:10]  # cap at 10 to keep prompt lean
    ])

    # Step 3: Fetch maintenance assets
    maintenance_assets = db.query(Asset).filter(Asset.status == "maintenance").all()
    maintenance_list = "\n".join([
        f"  - {a.asset_tag} {a.name} in {a.zone.name}"
        for a in maintenance_assets[:10]
    ])

    # Step 4: Build the system prompt with injected real data
    # This is the key technique — the AI knows your actual data, not guesses
    system_prompt = f"""You are Vigil, the AI assistant for the Vigilance facility asset tracking system.
You were built to help facility operators monitor assets, track compliance, and manage zones in real time.
Always refer to yourself as Vigil. Be concise, professional, and direct — operators are working, not chatting.
You have access to real-time data from the facility database. Answer questions concisely and accurately.

CURRENT FACILITY STATUS:
- Total assets: {total}
- Active: {active}
- Inactive: {inactive}
- Under maintenance: {maintenance}
- Non-compliant: {non_compliant}

ZONE BREAKDOWN:
{zone_summary}

NON-COMPLIANT ASSETS ({non_compliant} total, showing up to 10):
{non_compliant_list if non_compliant_list else "  None — all assets compliant"}

ASSETS UNDER MAINTENANCE ({maintenance} total, showing up to 10):
{maintenance_list if maintenance_list else "  None currently under maintenance"}

Answer the operator's question using only this data. Be direct and specific.
If asked something outside this data, say you don't have that information.
Keep responses brief — operators are working, not reading essays."""

    # Step 5: Call the Anthropic API
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    message = client.messages.create(
        model="claude-haiku-4-5",  # Fast + cheap — perfect for a chatbot
        max_tokens=512,
        system=system_prompt,
        messages=[
            {"role": "user", "content": request.message}
        ],
    )

    return ChatResponse(reply=message.content[0].text)
