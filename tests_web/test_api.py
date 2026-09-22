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
    assert len(snapshot["sessions"]) == 6
    assert "trips" not in snapshot


def test_repeating_program_is_one_program_with_many_sessions(seeded):
    """회차를 나눈 이유. 매주 반복이 프로그램 4개가 아니라 1개 + 회차 3개여야 한다."""
    snapshot = seeded.get("/api/snapshot").json()
    stretch = [s for s in snapshot["sessions"] if s["program_id"] == "demo-stretch"]
    assert len(stretch) == 3
    assert len({s["program_id"] for s in snapshot["sessions"]}) == 4
    # 목록에 같은 이름이 세 번 뜨면 안 된다
    assert len([p for p in snapshot["programs"] if p["id"] == "demo-stretch"]) == 1
    # 회차는 서버가 시간순으로 정렬해 준다
    assert [s["starts_at"] for s in stretch] == sorted(s["starts_at"] for s in stretch)


def test_catalog_roundtrip_and_utc(seeded):
    catalog = seeded.get("/api/admin/catalog").json()
    assert catalog["version"] == 2
    assert seeded.post("/api/admin/catalog/import", json=catalog).status_code == 200
    assert seeded.get("/api/admin/catalog").json() == catalog
    sessions = [s for p in catalog["programs"] for s in p["sessions"]]
    assert len(sessions) == 6
    assert all(s["starts_at"].endswith("Z") and s["ends_at"].endswith("Z") for s in sessions)


def test_catalog_version_1_still_imports_as_one_session(client):
    """옛 양식이 기관에 이미 나갔을 수 있다. 프로그램에 붙은 시각을 회차 1개로 읽는다."""
    old = {"version": 1,
           "places": [{"id": "p1", "name": "1층 로비", "floor": 1, "category": "안내"}],
           "programs": [{"id": "old-prog", "title": "옛 양식 강좌", "category": "건강", "place_id": "p1",
                         "starts_at": "2026-09-17T09:30:00+09:00", "ends_at": "2026-09-17T10:30:00+09:00"}]}
    assert client.post("/api/admin/catalog/import", json=old).json() == {"places": 1, "programs": 1, "sessions": 1}
    catalog = client.get("/api/admin/catalog").json()
    assert catalog["version"] == 2
    session = catalog["programs"][0]["sessions"][0]
    assert session["id"] == "old-prog-1"
    assert session["starts_at"] == "2026-09-17T00:30:00.000Z"  # KST 09:30 == UTC 00:30
    assert session["place_id"] == "p1"  # 회차가 비어 있으면 프로그램 기본 장소를 쓴다


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
    sessions = program.pop("sessions")
    program_id = program["id"]
    assert seeded.put("/api/admin/programs", json=program).status_code == 200
    program["unexpected"] = True
    assert seeded.put("/api/admin/programs", json=program).status_code == 422
    # 시각 검사는 이제 회차가 한다
    bad = {**sessions[0], "program_id": program_id, "ends_at": sessions[0]["starts_at"]}
    assert seeded.put("/api/admin/sessions", json=bad).status_code == 422


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
    payload = {"program_session_id": "demo-phone-1", "code": "TEST-001"}
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
        assert client.post("/api/attendance/demo", json={"program_session_id": "p", "code": "TEST-001"}).status_code == 503
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
    for group in ("places", "programs", "robots", "sessions"):
        for row in snapshot[group]:
            stamps[f"{group}.{row['id']}.created_at"] = row["created_at"]
    for row in snapshot["sessions"]:
        stamps[f"sessions.{row['id']}.starts_at"] = row["starts_at"]
        stamps[f"sessions.{row['id']}.ends_at"] = row["ends_at"]
    for program in catalog["programs"]:
        for item in program["sessions"]:
            stamps[f"catalog.{item['id']}.starts_at"] = item["starts_at"]
            stamps[f"catalog.{item['id']}.ends_at"] = item["ends_at"]
    for trip in seeded.get("/api/admin/trips").json():
        stamps[f"trip.{trip['id']}.created_at"] = trip["created_at"]
        stamps[f"trip.{trip['id']}.updated_at"] = trip["updated_at"]

    assert stamps, "검사할 시각이 하나도 없다면 이 테스트가 아무것도 지키지 못한다"
    wrong = {key: value for key, value in stamps.items() if not ISO_Z.match(value)}
    assert not wrong, f"형식이 다른 시각: {wrong}"


def test_program_order_is_chronological_as_string(seeded):
    # 문자열 정렬 결과가 곧 시간순이어야 한다 (형식이 하나여야 성립한다)
    sessions = seeded.get("/api/snapshot").json()["sessions"]
    starts = [s["starts_at"] for s in sessions]
    assert starts == sorted(starts)
    assert [datetime.fromisoformat(s.replace("Z", "+00:00")) for s in starts] == sorted(
        datetime.fromisoformat(s.replace("Z", "+00:00")) for s in starts)


def test_session_day_kst_is_korean_date_not_utc(client):
    """저장은 UTC, 날짜 판정은 KST. 이 둘을 섞으면 새벽 일정이 전날로 밀린다."""
    assert client.post("/api/admin/catalog/import", json={
        "version": 2,
        "places": [{"id": "p1", "name": "로비", "floor": 1, "category": "안내"}],
        "programs": [{"id": "night", "title": "새벽 강좌", "category": "건강", "place_id": "p1",
                      "sessions": [{"id": "night-1", "starts_at": "2026-09-18T00:30:00+09:00",
                                    "ends_at": "2026-09-18T01:30:00+09:00"}]}]}).status_code == 200
    row = client.get("/api/snapshot").json()["sessions"][0]
    assert row["starts_at"] == "2026-09-17T15:30:00.000Z"  # UTC 로는 전날 저녁
    assert row["session_day_kst"] == "2026-09-18"          # 한국 날짜로는 다음 날


def test_session_can_override_place_while_program_keeps_default(seeded):
    """회차마다 강의실이 바뀔 수 있다. 그래서 장소가 회차에 있다."""
    catalog = seeded.get("/api/admin/catalog").json()
    stretch = next(p for p in catalog["programs"] if p["id"] == "demo-stretch")
    assert stretch["place_id"] == "demo-room-b"
    moved = {**stretch["sessions"][1], "program_id": "demo-stretch", "place_id": "demo-hall"}
    assert seeded.put("/api/admin/sessions", json=moved).status_code == 200
    rows = {s["id"]: s for s in seeded.get("/api/snapshot").json()["sessions"]}
    assert rows["demo-stretch-2"]["place_id"] == "demo-hall"
    assert rows["demo-stretch-1"]["place_id"] == "demo-room-b"


def test_canceled_session_needs_reason_stays_visible_and_blocks_attendance(seeded):
    catalog = seeded.get("/api/admin/catalog").json()
    phone = next(p for p in catalog["programs"] if p["id"] == "demo-phone")
    today = {**phone["sessions"][0], "program_id": "demo-phone"}
    # 사유 없는 휴강은 나중에 아무도 이유를 모른다
    assert seeded.put("/api/admin/sessions", json={**today, "status": "canceled"}).status_code == 422
    assert seeded.put("/api/admin/sessions",
                      json={**today, "status": "canceled", "cancel_reason": "강사 사정"}).status_code == 200
    # 지우지 않고 남긴다 — 키오스크가 "휴강" 으로 보여줘야 한다
    rows = {s["id"]: s for s in seeded.get("/api/snapshot").json()["sessions"]}
    assert rows["demo-phone-1"]["status"] == "canceled"
    assert rows["demo-phone-1"]["cancel_reason"] == "강사 사정"
    assert seeded.post("/api/attendance/demo",
                       json={"program_session_id": "demo-phone-1", "code": "TEST-001"}).status_code == 422


def test_attendance_only_for_todays_session(seeded):
    # 다음 주 회차로는 출석할 수 없다
    assert seeded.post("/api/attendance/demo",
                       json={"program_session_id": "demo-stretch-2", "code": "TEST-001"}).status_code == 422
    assert seeded.post("/api/attendance/demo",
                       json={"program_session_id": "demo-stretch-1", "code": "TEST-001"}).json()["duplicate"] is False


def test_session_batch_is_all_or_nothing(seeded):
    """반복 생성. 절반만 들어가면 직원이 무엇이 빠졌는지 알 수 없다."""
    before = len(seeded.get("/api/snapshot").json()["sessions"])
    good = {"id": "batch-1", "program_id": "demo-phone",
            "starts_at": "2026-12-01T10:00:00+09:00", "ends_at": "2026-12-01T11:00:00+09:00"}
    assert seeded.post("/api/admin/sessions/batch",
                       json={"sessions": [good, {**good, "id": "batch-2", "program_id": "없는프로그램"}]}
                       ).status_code == 422
    assert len(seeded.get("/api/snapshot").json()["sessions"]) == before
    assert seeded.post("/api/admin/sessions/batch",
                       json={"sessions": [good, {**good, "id": "batch-2"}]}).json() == {"sessions": 2}
    assert len(seeded.get("/api/snapshot").json()["sessions"]) == before + 2
