"""기관·로봇 데이터가 없는 상태에서 웹 계약과 저장 무결성을 검증한다."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from web_api.main import create_app

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def database(tmp_path):
    url = f"sqlite:///{tmp_path / 'test.db'}"
    cfg = Config(str(ROOT / "web-alembic.ini"))
    cfg.attributes["database_url"] = url
    command.upgrade(cfg, "head")
    return url, cfg


@pytest.fixture
def client(database):
    app = create_app(database[0], demo=True)
    with TestClient(app) as c:
        yield c
    app.state.engine.dispose()


@pytest.fixture
def seeded(client):
    assert client.post("/api/admin/demo/seed").status_code == 200
    return client


def test_empty_state_and_explicit_seed(client):
    assert client.get("/api/snapshot").json()["places"] == []
    assert client.post("/api/admin/demo/seed").status_code == 200
    assert client.post("/api/admin/demo/seed").status_code == 409
    snapshot = client.get("/api/snapshot").json()
    assert len(snapshot["places"]) == 6
    assert len(snapshot["programs"]) == 4
    assert "trips" not in snapshot


def test_catalog_roundtrip_and_utc(seeded):
    catalog = seeded.get("/api/admin/catalog").json()
    assert seeded.post("/api/admin/catalog/import", json=catalog).status_code == 200
    assert seeded.get("/api/admin/catalog").json() == catalog
    assert all(p["starts_at"].endswith("Z") for p in catalog["programs"])


def test_import_failure_rolls_back_all_changes(seeded):
    before = seeded.get("/api/admin/catalog").json()
    value = seeded.get("/api/admin/catalog").json()
    value["places"][0]["name"] = "저장되면 안 되는 이름"
    value["programs"][0]["place_id"] = "missing-place"
    assert seeded.post("/api/admin/catalog/import", json=value).status_code == 422
    assert seeded.get("/api/admin/catalog").json() == before


def test_duplicates_invalid_time_and_unknown_fields_rejected(seeded):
    value = seeded.get("/api/admin/catalog").json()
    value["places"].append(value["places"][0])
    assert seeded.post("/api/admin/catalog/import", json=value).status_code == 422
    program = seeded.get("/api/admin/catalog").json()["programs"][0]
    program["ends_at"] = program["starts_at"]
    assert seeded.put("/api/admin/programs", json=program).status_code == 422
    program["unexpected"] = True
    assert seeded.put("/api/admin/programs", json=program).status_code == 422


def test_hidden_places_keep_history_and_in_use_place_cannot_be_hidden(seeded):
    catalog = seeded.get("/api/admin/catalog").json()
    lobby = next(p for p in catalog["places"] if p["id"] == "demo-lobby")
    lobby["is_active"] = False
    assert seeded.put("/api/admin/places", json=lobby).status_code == 422
    office = next(p for p in catalog["places"] if p["id"] == "demo-office")
    office["is_active"] = False
    assert seeded.put("/api/admin/places", json=office).status_code == 200
    assert office["id"] not in [p["id"] for p in seeded.get("/api/snapshot").json()["places"]]
    assert office["id"] in [p["id"] for p in seeded.get("/api/admin/catalog").json()["places"]]


def test_trip_lifecycle_arrival_changes_location_and_return(seeded):
    payload = {"robot_id": "demo-r", "destination_id": "demo-room-a"}
    result = seeded.post("/api/admin/trips", json=payload)
    assert result.status_code == 201
    trip = result.json()
    assert trip["is_simulated"] is True
    assert seeded.post("/api/admin/trips", json=payload).status_code == 409
    path = f"/api/admin/trips/{trip['id']}/demo-state"
    assert seeded.patch(path, json={"status": "arrived"}).status_code == 409
    assert seeded.patch(path, json={"status": "moving"}).status_code == 200
    assert seeded.get("/api/snapshot").json()["robots"][0]["current_place_id"] == "demo-lobby"
    assert seeded.patch(path, json={"status": "arrived"}).status_code == 200
    assert seeded.get("/api/snapshot").json()["robots"][0]["current_place_id"] == "demo-room-a"
    assert seeded.patch(path, json={"status": "moving"}).status_code == 409
    assert seeded.post("/api/admin/trips", json={**payload, "destination_id": "demo-lobby"}).status_code == 201


def test_concurrent_dispatch_has_single_active_trip(seeded):
    payload = {"robot_id": "demo-r", "destination_id": "demo-room-a"}
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(lambda _: seeded.post("/api/admin/trips", json=payload).status_code, range(2)))
    assert sorted(codes) == [201, 409]


def test_attendance_dedup_and_non_demo_code_rejection(seeded):
    payload = {"program_id": "demo-phone", "code": "TEST-001"}
    assert seeded.post("/api/attendance/demo", json=payload).json()["duplicate"] is False
    assert seeded.post("/api/attendance/demo", json=payload).json()["duplicate"] is True
    assert seeded.post("/api/attendance/demo", json={**payload, "code": "real-member"}).status_code == 422


def test_live_mode_requires_staff_and_blocks_unconnected_devices(database):
    app = create_app(database[0], demo=False, admin_key="test-key")
    with TestClient(app) as client:
        assert client.get("/api/snapshot").status_code == 200
        assert client.get("/api/admin/catalog").status_code == 401
        headers = {"X-Admin-Key": "test-key"}
        assert client.get("/api/admin/catalog", headers=headers).status_code == 200
        assert client.post("/api/admin/demo/seed", headers=headers).status_code == 503
        assert client.post("/api/admin/trips", headers=headers, json={"robot_id": "r", "destination_id": "p"}).status_code == 503
        assert client.post("/api/attendance/demo", json={"program_id": "p", "code": "TEST-001"}).status_code == 503
    app.state.engine.dispose()


def test_migration_roundtrip_and_model_alignment(database):
    url, cfg = database
    command.check(cfg)
    command.downgrade(cfg, "base")
    app = create_app(url)
    assert "place" not in inspect(app.state.engine).get_table_names()
    command.upgrade(cfg, "head")
    command.check(cfg)
    assert "place" in inspect(app.state.engine).get_table_names()
    app.state.engine.dispose()
