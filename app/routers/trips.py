"""안내 요청(trip) 생성·갱신과 이벤트 보고."""
import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import enums, models, schemas
from app.db import get_db
from app.geo import point, xy

router = APIRouter(prefix="/trips", tags=["trips"])

ACTIVE = (enums.TripStatus.requested, enums.TripStatus.navigating, enums.TripStatus.paused)


def _out(t: models.Trip) -> schemas.TripOut:
    return schemas.TripOut(
        id=t.id, uuid=str(t.uuid), robot_id=t.robot_id, map_id=t.map_id,
        mode=t.mode, status=t.status, origin_poi_id=t.origin_poi_id,
        dest_poi_id=t.dest_poi_id, requested_by=t.requested_by,
        is_simulated=t.is_simulated, requested_at=t.requested_at,
        started_at=t.started_at, ended_at=t.ended_at,
        planned_distance_m=t.planned_distance_m,
        actual_distance_m=t.actual_distance_m, abort_reason=t.abort_reason,
    )


@router.get("", response_model=list[schemas.TripOut])
def list_trips(db: Session = Depends(get_db), robot_id: int | None = None,
               include_simulated: bool = True, limit: int = 50):
    stmt = select(models.Trip).order_by(models.Trip.requested_at.desc()).limit(limit)
    if robot_id:
        stmt = stmt.where(models.Trip.robot_id == robot_id)
    if not include_simulated:
        stmt = stmt.where(models.Trip.is_simulated.is_(False))
    return [_out(t) for t in db.scalars(stmt).all()]


@router.post("", response_model=schemas.TripOut, status_code=201)
def create_trip(body: schemas.TripCreate, db: Session = Depends(get_db)):
    robot = db.get(models.Robot, body.robot_id)
    if not robot:
        raise HTTPException(404, f"robot {body.robot_id} 없음")
    if not robot.current_map_id:
        raise HTTPException(400, "로봇에 current_map_id가 없다. 지도를 먼저 지정할 것")

    # DB에도 CHECK 제약이 있지만, 400으로 친절하게 돌려주려고 여기서 먼저 본다
    if body.mode == enums.TripMode.guide and body.dest_poi_id is None:
        raise HTTPException(400, "guide 모드는 dest_poi_id가 필요하다")

    trip = models.Trip(
        robot_id=robot.id, map_id=robot.current_map_id,
        mode=body.mode, status=enums.TripStatus.requested,
        origin_poi_id=body.origin_poi_id, dest_poi_id=body.dest_poi_id,
        requested_by=body.requested_by, is_simulated=body.is_simulated,
    )
    db.add(trip)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        # uq_trip_one_active_per_robot — 한 로봇에 진행중 trip은 하나뿐
        if "uq_trip_one_active_per_robot" in str(e.orig):
            raise HTTPException(409, "이 로봇은 이미 진행중인 trip이 있다") from e
        raise HTTPException(400, f"저장 실패: {e.orig}") from e
    db.refresh(trip)
    return _out(trip)


@router.patch("/{trip_id}", response_model=schemas.TripOut)
def update_trip(trip_id: int, body: schemas.TripUpdate, db: Session = Depends(get_db)):
    t = db.get(models.Trip, trip_id)
    if not t:
        raise HTTPException(404, f"trip {trip_id} 없음")

    if body.status is not None:
        # 상태 전이에 맞춰 시각을 자동으로 찍는다
        if body.status == enums.TripStatus.navigating and t.started_at is None:
            t.started_at = dt.datetime.now(dt.timezone.utc)
        if body.status in (enums.TripStatus.completed, enums.TripStatus.canceled,
                           enums.TripStatus.failed, enums.TripStatus.arrived):
            t.ended_at = dt.datetime.now(dt.timezone.utc)
        t.status = body.status

    if body.actual_distance_m is not None:
        t.actual_distance_m = body.actual_distance_m
    if body.abort_reason is not None:
        t.abort_reason = body.abort_reason

    db.commit()
    db.refresh(t)
    return _out(t)


@router.post("/{trip_id}/events", response_model=schemas.TripEventOut, status_code=201)
def add_event(trip_id: int, body: schemas.TripEventIn, db: Session = Depends(get_db)):
    """로봇이 주행 중 사건을 보고한다 (장애물, 비상정지, 재계획 등)."""
    if not db.get(models.Trip, trip_id):
        raise HTTPException(404, f"trip {trip_id} 없음")

    ev = models.TripEvent(
        trip_id=trip_id,
        ts=body.ts or dt.datetime.now(dt.timezone.utc),
        event_type=body.event_type, severity=body.severity,
        geom=point(body.x, body.y) if body.x is not None and body.y is not None else None,
        payload=body.payload,
    )
    db.add(ev)
    db.commit()

    x, y = xy(models.TripEvent.geom)
    row = db.execute(
        select(models.TripEvent, x, y).where(models.TripEvent.id == ev.id)
    ).one()
    e, ex, ey = row
    return schemas.TripEventOut(
        id=e.id, ts=e.ts, event_type=e.event_type, severity=e.severity,
        x=ex, y=ey, payload=e.payload,
    )


@router.get("/{trip_id}/events", response_model=list[schemas.TripEventOut])
def list_events(trip_id: int, db: Session = Depends(get_db)):
    x, y = xy(models.TripEvent.geom)
    rows = db.execute(
        select(models.TripEvent, x, y)
        .where(models.TripEvent.trip_id == trip_id)
        .order_by(models.TripEvent.ts)
    ).all()
    return [
        schemas.TripEventOut(id=e.id, ts=e.ts, event_type=e.event_type,
                             severity=e.severity, x=ex, y=ey, payload=e.payload)
        for e, ex, ey in rows
    ]
