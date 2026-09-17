"""기관·로봇 데이터가 없는 상태에서 웹 계약과 저장 무결성을 검증한다."""
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from web_api.main import create_app
from web_api.models import iso_z

ROOT = Path(__file__).resolve().parent.parent
# 2026-09-17T00:30:00.000Z — 항상 24자, 항상 UTC, 항상 Z
ISO_Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


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


def test_iso_z_normalizes_timezone_and_truncates_microseconds():
    # 다른 시간대로 들어와도 UTC 로 바꿔 저장한다. KST 09:30 == UTC 00:30
    kst = timezone(timedelta(hours=9))
    assert iso_z(datetime(2026, 9, 17, 9, 30, tzinfo=kst)) == "2026-09-17T00:30:00.000Z"
    # 마이크로초는 버리고 밀리초 3자리로 자른다 (자릿수가 값마다 달라지면 안 된다)
    assert iso_z(datetime(2026, 9, 17, 0, 30, 0, 123456, tzinfo=timezone.utc)) == "2026-09-17T00:30:00.123Z"
    assert iso_z(datetime(2026, 9, 17, 0, 30, 0, 999, tzinfo=timezone.utc)) == "2026-09-17T00:30:00.000Z"


def test_every_stored_timestamp_uses_one_format(seeded):
    """시각 문자열이 섞이면 정렬이 시간순이 아니게 된다.

    SQLite 에 날짜 타입이 없어 비교가 문자열 비교인데, `+00:00` 은 `Z` 보다
    사전순으로 앞이다. 한 컬럼에 두 형식이 섞이면 `ORDER BY starts_at` 이 조용히 틀린다.
    """
    assert seeded.post("/api/admin/trips",
                       json={"robot_id": "demo-r", "destination_id": "demo-room-a"}).status_code == 201
    snapshot = seeded.get("/api/snapshot").json()
    catalog = seeded.get("/api/admin/catalog").json()

    stamps = {}
    for group in ("places", "programs", "robots"):
        for row in snapshot[group]:
            stamps[f"{group}.{row['id']}.created_at"] = row["created_at"]
    for program in catalog["programs"]:
        stamps[f"catalog.{program['id']}.starts_at"] = program["starts_at"]
        stamps[f"catalog.{program['id']}.ends_at"] = program["ends_at"]
    for trip in seeded.get("/api/admin/trips").json():
        stamps[f"trip.{trip['id']}.created_at"] = trip["created_at"]
        stamps[f"trip.{trip['id']}.updated_at"] = trip["updated_at"]

    assert stamps, "검사할 시각이 하나도 없다면 이 테스트가 아무것도 지키지 못한다"
    wrong = {key: value for key, value in stamps.items() if not ISO_Z.match(value)}
    assert not wrong, f"형식이 다른 시각: {wrong}"


def test_program_order_is_chronological_as_string(seeded):
    # 문자열 정렬 결과가 곧 시간순이어야 한다 (형식이 하나여야 성립한다)
    programs = seeded.get("/api/snapshot").json()["programs"]
    starts = [p["starts_at"] for p in programs]
    assert starts == sorted(starts)
    assert [datetime.fromisoformat(s.replace("Z", "+00:00")) for s in starts] == sorted(
        datetime.fromisoformat(s.replace("Z", "+00:00")) for s in starts)
