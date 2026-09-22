"""새 계획용 로컬 웹 API. 실장치 연동은 아직 제공하지 않는다."""
import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import make_engine
from .models import KST, Attendance, Place, Program, ProgramSession, Robot, Trip, day_kst, iso_z, utc_now
from .schemas import (AttendanceIn, CatalogIn, PlaceIn, ProgramIn, ProgramSessionIn, SessionBatchIn,
                      TripIn, TripState)

ROOT = Path(__file__).resolve().parent.parent


def record(row):
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def create_app(database_url: str | None = None, demo: bool | None = None, admin_key: str | None = None):
    database_url = database_url or os.getenv("WEB_DATABASE_URL", "sqlite:///./web-data.db")
    demo = demo if demo is not None else os.getenv("WEB_DEMO", "true").lower() == "true"
    admin_key = admin_key if admin_key is not None else os.getenv("WEB_ADMIN_KEY", "")
    engine = make_engine(database_url)
    app = FastAPI(title="Subject R · 이동형 키오스크 웹 API", version="0.1.0")
    app.state.engine = engine

    def db():
        with Session(engine) as session:
            yield session

    def staff(x_admin_key: str = Header(default="")):
        if not demo and (not admin_key or not secrets.compare_digest(x_admin_key, admin_key)):
            raise HTTPException(401, "직원 연결 키를 확인해 주세요.")

    def require_demo():
        if not demo:
            raise HTTPException(503, "실장치 연동 준비 중입니다. 데모 기능은 사용할 수 없습니다.")

    def require_place(session, place_id):
        place = session.get(Place, place_id)
        if not place or not place.is_active:
            raise HTTPException(422, "사용 가능한 장소를 선택해 주세요.")
        return place

    def put_place(session, value):
        row = session.get(Place, value.id)
        if row is None:
            row = Place(**value.model_dump())
            session.add(row)
        else:
            for key, val in value.model_dump().items():
                setattr(row, key, val)

    def put_program(session, value):
        require_place(session, value.place_id)
        # 카탈로그로 들어오면 sessions 가 붙어 있다. Program 컬럼만 골라낸다.
        values = {key: getattr(value, key) for key in ProgramIn.model_fields}
        row = session.get(Program, value.id)
        if row is None:
            session.add(Program(**values))
        else:
            for key, val in values.items():
                setattr(row, key, val)

    def put_session(session, value, program_id, default_place_id=None):
        """회차 1건 저장. 장소를 비워두면 프로그램의 기본 장소를 쓴다."""
        program = session.get(Program, program_id)
        if program is None:
            raise HTTPException(422, "등록된 프로그램을 선택해 주세요.")
        place_id = value.place_id or default_place_id or program.place_id
        require_place(session, place_id)
        # Pydantic 의 datetime 직렬화는 마이크로초 자릿수가 값마다 달라진다.
        # 저장 형식은 iso_z 하나로만 정한다 (models.iso_z 주석 참고).
        values = {"program_id": program_id, "place_id": place_id,
                  "starts_at": iso_z(value.starts_at), "ends_at": iso_z(value.ends_at),
                  "session_day_kst": day_kst(value.starts_at),
                  "status": value.status, "cancel_reason": value.cancel_reason}
        row = session.get(ProgramSession, value.id)
        if row is None:
            session.add(ProgramSession(id=value.id, **values))
        else:
            for key, val in values.items():
                setattr(row, key, val)
            row.updated_at = utc_now()

    def validate_catalog(session):
        # 비활성 장소를 프로그램이나 로봇이 계속 사용하는 변경은 원자적으로 거부한다.
        for program in session.scalars(select(Program).where(Program.is_active.is_(True))):
            require_place(session, program.place_id)
        # 휴강된 회차는 이미 지나간 일이라 장소가 닫혀도 막지 않는다.
        live = (select(ProgramSession).join(Program)
                .where(Program.is_active.is_(True), ProgramSession.status == "scheduled"))
        for row in session.scalars(live):
            require_place(session, row.place_id)
        for robot in session.scalars(select(Robot)):
            require_place(session, robot.home_place_id)
            require_place(session, robot.current_place_id)
        for trip in session.scalars(select(Trip).where(Trip.status.in_(["requested", "moving"]))):
            require_place(session, trip.destination_id)

    @app.get("/api/health")
    def health(session: Session = Depends(db)):
        session.execute(select(Place.id).limit(1))
        return {"status": "ok", "database": "sqlite", "demo": demo}

    @app.get("/api/snapshot")
    def snapshot(session: Session = Depends(db)):
        places = list(session.scalars(select(Place).where(Place.is_active.is_(True)).order_by(Place.floor, Place.name)))
        programs = list(session.scalars(select(Program).where(Program.is_active.is_(True)).order_by(Program.title)))
        # 회차는 평면 배열로, 서버에서 시간순 정렬해 준다. 화면은 훑기만 하면 된다.
        # 휴강도 내려보낸다 — 키오스크가 "휴강" 으로 보여줘야 하기 때문이다.
        sessions = list(session.scalars(
            select(ProgramSession).join(Program)
            .where(Program.is_active.is_(True)).order_by(ProgramSession.starts_at)))
        robots = list(session.scalars(select(Robot)))
        # 직원 이력·출결 기록은 공개 키오스크 응답에 포함하지 않는다.
        return {"demo": demo, "places": [record(p) for p in places],
                "programs": [record(p) for p in programs], "sessions": [record(s) for s in sessions],
                "robots": [record(r) for r in robots],
                "integrations": {"robot": "미연결", "attendance": "미연결", "map": "미제공", "printer": "브라우저 인쇄"}}

    @app.get("/api/admin/trips", dependencies=[Depends(staff)])
    def trips(session: Session = Depends(db)):
        return [record(t) for t in session.scalars(select(Trip).order_by(Trip.created_at.desc()).limit(50))]

    @app.get("/api/admin/catalog", dependencies=[Depends(staff)])
    def catalog(session: Session = Depends(db)):
        return {"version": 2, **export_rows(session)}

    def export_rows(session):
        # 사람이 읽고 고치는 문서라 회차를 프로그램 안에 중첩해 내보낸다.
        # (화면이 훑는 /api/snapshot 은 반대로 평면이다.)
        # 생성 시각은 가져오기 규격에 없으므로 명시된 필드만 내보낸다.
        by_program = {}
        for row in session.scalars(select(ProgramSession).order_by(ProgramSession.starts_at)):
            by_program.setdefault(row.program_id, []).append(
                {"id": row.id, "place_id": row.place_id, "starts_at": row.starts_at, "ends_at": row.ends_at,
                 "status": row.status, "cancel_reason": row.cancel_reason})
        return {"places": [{k: getattr(p, k) for k in PlaceIn.model_fields} for p in session.scalars(select(Place))],
                "programs": [{**{k: getattr(p, k) for k in ProgramIn.model_fields},
                              "sessions": by_program.get(p.id, [])}
                             for p in session.scalars(select(Program))]}

    @app.put("/api/admin/places", dependencies=[Depends(staff)])
    def save_place(value: PlaceIn, session: Session = Depends(db)):
        put_place(session, value)
        session.flush()
        validate_catalog(session)
        session.commit()
        return {"saved": value.id}

    @app.put("/api/admin/programs", dependencies=[Depends(staff)])
    def save_program(value: ProgramIn, session: Session = Depends(db)):
        put_program(session, value)
        session.commit()
        return {"saved": value.id}

    @app.put("/api/admin/sessions", dependencies=[Depends(staff)])
    def save_session(value: ProgramSessionIn, session: Session = Depends(db)):
        put_session(session, value, value.program_id)
        session.flush()
        validate_catalog(session)
        session.commit()
        return {"saved": value.id}

    @app.post("/api/admin/sessions/batch", dependencies=[Depends(staff)])
    def save_sessions(value: SessionBatchIn, session: Session = Depends(db)):
        """반복 생성용. 하나라도 어긋나면 전부 저장하지 않는다."""
        for item in value.sessions:
            put_session(session, item, item.program_id)
        session.flush()
        validate_catalog(session)
        session.commit()
        return {"sessions": len(value.sessions)}

    @app.post("/api/admin/catalog/import", dependencies=[Depends(staff)])
    def import_catalog(value: CatalogIn, session: Session = Depends(db)):
        for place in value.places:
            put_place(session, place)
        session.flush()
        for program in value.programs:
            put_program(session, program)
        session.flush()
        count = 0
        for program in value.programs:
            for item in program.sessions:
                put_session(session, item, program.id, program.place_id)
                count += 1
        session.flush()
        validate_catalog(session)
        session.commit()
        return {"places": len(value.places), "programs": len(value.programs), "sessions": count}

    @app.post("/api/admin/demo/seed", dependencies=[Depends(staff), Depends(require_demo)])
    def seed(session: Session = Depends(db)):
        if session.scalar(select(Place.id).limit(1)) or session.scalar(select(Program.id).limit(1)):
            raise HTTPException(409, "데이터가 이미 있습니다. 기존 내용을 보호하기 위해 예시를 덮어쓰지 않습니다.")
        data = json.loads((ROOT / "web_api" / "demo-catalog.json").read_text(encoding="utf-8"))
        rows = [item for program in data["programs"] for item in program.get("sessions", [])]
        if rows:
            # 파일 안의 날짜 간격은 유지한 채 첫 회차를 오늘로 당긴다.
            # 그래야 "매주 반복" 예시가 오늘·다음 주·다다음 주로 제대로 보인다.
            base = min(datetime.fromisoformat(item["starts_at"]).astimezone(KST).date() for item in rows)
            shift = timedelta(days=(datetime.now(KST).date() - base).days)
            for item in rows:
                for key in ("starts_at", "ends_at"):
                    item[key] = (datetime.fromisoformat(item[key]).astimezone(KST) + shift).isoformat()
        value = CatalogIn.model_validate(data)
        for place in value.places:
            put_place(session, place)
        session.flush()
        for program in value.programs:
            put_program(session, program)
        session.flush()
        for program in value.programs:
            for item in program.sessions:
                put_session(session, item, program.id, program.place_id)
        session.add(Robot(id="demo-r", name="Subject R", home_place_id="demo-lobby", current_place_id="demo-lobby"))
        session.commit()
        return {"message": "예시 데이터를 불러왔습니다. 실제 기관 정보가 아닙니다."}

    @app.post("/api/admin/trips", dependencies=[Depends(staff), Depends(require_demo)], status_code=201)
    def create_trip(value: TripIn, session: Session = Depends(db)):
        robot = session.get(Robot, value.robot_id)
        if not robot:
            raise HTTPException(404, "등록된 데모 로봇이 없습니다.")
        require_place(session, value.destination_id)
        if value.destination_id == robot.current_place_id:
            raise HTTPException(409, "현재 위치와 목적지가 같습니다.")
        row = Trip(id=str(uuid4()), **value.model_dump(), is_simulated=True)
        session.add(row)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(409, "진행 중인 이동 요청이 있습니다.")
        return record(row)

    @app.patch("/api/admin/trips/{trip_id}/demo-state", dependencies=[Depends(staff), Depends(require_demo)])
    def demo_state(trip_id: str, value: TripState, session: Session = Depends(db)):
        row = session.get(Trip, trip_id)
        if not row:
            raise HTTPException(404, "이동 요청을 찾을 수 없습니다.")
        allowed = {"requested": {"moving", "canceled", "failed"}, "moving": {"arrived", "canceled", "failed"}}
        old_status = row.status
        if value.status not in allowed.get(old_status, set()):
            raise HTTPException(409, "현재 상태에서 바꿀 수 없는 이동 상태입니다.")
        changed = session.execute(update(Trip).where(Trip.id == trip_id, Trip.status == old_status)
                                  .values(status=value.status, updated_at=utc_now()))
        if changed.rowcount != 1:
            raise HTTPException(409, "다른 화면에서 상태가 바뀌었습니다. 새로고침해 주세요.")
        if value.status == "arrived":
            session.get(Robot, row.robot_id).current_place_id = row.destination_id
        session.commit()
        session.refresh(row)
        return record(row)

    @app.post("/api/attendance/demo", dependencies=[Depends(require_demo)])
    def attendance(value: AttendanceIn, session: Session = Depends(db)):
        row = session.get(ProgramSession, value.program_session_id)
        if not row:
            raise HTTPException(422, "프로그램 회차를 선택해 주세요.")
        program = session.get(Program, row.program_id)
        if not program or not program.is_active:
            raise HTTPException(422, "프로그램을 선택해 주세요.")
        if row.status == "canceled":
            raise HTTPException(422, "휴강된 회차입니다. 직원에게 문의해 주세요.")
        require_place(session, row.place_id)
        if value.code != "TEST-001":
            raise HTTPException(422, "연동 전에는 예시 코드 TEST-001만 사용할 수 있습니다.")
        today = datetime.now(KST).date().isoformat()
        # 회차가 한국 날짜를 이미 갖고 있어 문자열 비교 한 번으로 끝난다.
        if row.session_day_kst != today:
            raise HTTPException(422, "오늘 진행하는 프로그램만 출석을 체험할 수 있습니다.")
        row = Attendance(id=str(uuid4()), program_session_id=value.program_session_id,
                         code_hash=hashlib.sha256(value.code.encode()).hexdigest(), day_kst=today)
        session.add(row)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            return {"duplicate": True, "message": "이미 데모 출석을 확인했어요. 실제 출결에는 반영되지 않아요."}
        return {"duplicate": False, "message": "데모 출석을 확인했어요. 실제 출결에는 반영되지 않아요."}

    dist = ROOT / "web" / "dist"
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        @app.get("/admin", include_in_schema=False)
        def frontend():
            return FileResponse(dist / "index.html")

    return app


app = create_app()
