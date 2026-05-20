"""
Tests for the Vigilance API.

These run in CI before every deployment. If any test fails,
the pipeline stops and nothing gets deployed.
"""


def test_health_check(client):
    """The health endpoint must always return 200. AWS ECS uses this."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "vigilance-api"


def test_get_all_assets(client):
    """Should return all 75 seeded assets."""
    response = client.get("/assets")
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) == 75


def test_asset_has_required_fields(client):
    """Every asset must have the fields the frontend depends on."""
    response = client.get("/assets")
    assert response.status_code == 200
    asset = response.json()[0]
    assert "id" in asset
    assert "asset_tag" in asset
    assert "name" in asset
    assert "status" in asset
    assert "zone_id" in asset
    assert "compliant" in asset


def test_filter_assets_by_status(client):
    """Status filter must return only assets with that status."""
    response = client.get("/assets?status=active")
    assert response.status_code == 200
    assets = response.json()
    assert len(assets) > 0
    for asset in assets:
        assert asset["status"] == "active"


def test_filter_assets_invalid_status_returns_empty(client):
    """An unknown status should return empty list, not an error."""
    response = client.get("/assets?status=nonexistent")
    assert response.status_code == 200
    assert response.json() == []


def test_get_single_asset(client):
    """Should return one asset by ID."""
    response = client.get("/assets/1")
    assert response.status_code == 200
    asset = response.json()
    assert asset["id"] == 1
    assert "asset_tag" in asset


def test_get_asset_not_found(client):
    """Requesting a non-existent asset should return 404."""
    response = client.get("/assets/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_get_all_zones(client):
    """Should return all 8 zones."""
    response = client.get("/zones")
    assert response.status_code == 200
    zones = response.json()
    assert len(zones) == 8


def test_zone_has_asset_count(client):
    """Every zone response must include an asset_count field."""
    response = client.get("/zones")
    assert response.status_code == 200
    for zone in response.json():
        assert "asset_count" in zone
        assert zone["asset_count"] >= 0


def test_get_dashboard(client):
    """Dashboard must return correct totals."""
    response = client.get("/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["total_assets"] == 75
    assert data["active_assets"] + data["inactive_assets"] + data["maintenance_assets"] == 75
    assert data["compliant_assets"] + data["non_compliant_assets"] == 75
    assert len(data["zones"]) == 8


def test_move_asset(client):
    """Moving an asset should update its zone_id."""
    # Get asset 1's current zone
    original = client.get("/assets/1").json()
    original_zone = original["zone_id"]

    # Find a different zone to move it to
    zones = client.get("/zones").json()
    target_zone = next(z for z in zones if z["id"] != original_zone)

    # Move the asset
    response = client.post(f"/assets/1/move", json={"zone_id": target_zone["id"]})
    assert response.status_code == 200
    updated = response.json()
    assert updated["zone_id"] == target_zone["id"]


def test_move_asset_invalid_zone(client):
    """Moving an asset to a non-existent zone should return 404."""
    response = client.post("/assets/1/move", json={"zone_id": 99999})
    assert response.status_code == 404
