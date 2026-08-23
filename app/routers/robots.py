"""로봇 목록·상태 — 기능 `직원-로봇상태`, `로봇-상태보고`, `직원-계정관리`(키 발급).

두 종류의 호출자가 있다.
- 사람(직원 대시보드): 로봇 목록을 본다. staff 이상.
- 로봇 자신: 자기 상태를 보고한다. X-Robot-Key 헤더로 인증.

로봇은 `/robots/me` 로만 접근한다. 다른 로봇 정보를 볼 이유가 없다.
"""
import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.db import get_db
from app.deps import get_current_robot, require_role
from app.security import generate_api_key, hash_api_key

router = APIRouter(prefix="/robots", tags=["robots"])


def _out(r: models.Robot, now: dt.datetime) -> schemas.RobotOut:
    stale = (
        r.last_seen_at is None
        or (now - r.last_seen_at).total_seconds() > settings.ROBOT_STALE_SECONDS
    )
    return schemas.RobotOut(
        id=r.id, uuid=str(r.uuid), serial=r.serial, name=r.name, model=r.model,
        current_map_id=r.current_map_id, status=r.status,
        battery_pct=r.battery_pct, last_seen_at=r.last_seen_at,
        is_stale=stale, has_api_key=bool(r.api_key_hash),
    )


# ---------------------------------------------------------------- 로봇 자신
@router.get("/me", response_model=schemas.RobotSelfOut)
def whoami(robot: models.Robot = Depends(get_current_robot)):
    """로봇이 부팅 후 자기 확인 + 서버 시각 동기화에 쓴다."""
    return schemas.RobotSelfOut(
        id=robot.id, uuid=str(robot.uuid), serial=robot.serial, name=robot.name,
        status=robot.status, battery_pct=robot.battery_pct,
        current_map_id=robot.current_map_id,
        server_time=dt.datetime.now(dt.timezone.utc),
    )


@router.post("/me/status", response_model=schemas.RobotSelfOut)
def report_status(body: schemas.RobotStatusIn,
                  robot: models.Robot = Depends(get_current_robot),
                  db: Session = Depends(get_db)):
    """`로봇-상태보고`.

    보낸 필드만 갱신한다. `last_seen_at` 은 호출될 때마다 자동으로 찍힌다
    — 아무것도 안 보내고 호출하면 그냥 heartbeat가 된다.
    """
    if body.current_map_id is not None:
        if not db.get(models.Map, body.current_map_id):
            raise HTTPException(404, f"map {body.current_map_id} 없음")
        robot.current_map_id = body.current_map_id
    if body.status is not None:
        robot.status = body.status
    if body.battery_pct is not None:
        robot.battery_pct = body.battery_pct
    if body.firmware_version is not None:
        robot.firmware_version = body.firmware_version

    robot.last_seen_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(robot)
    return schemas.RobotSelfOut(
        id=robot.id, uuid=str(robot.uuid), serial=robot.serial, name=robot.name,
        status=robot.status, battery_pct=robot.battery_pct,
        current_map_id=robot.current_map_id,
        server_time=dt.datetime.now(dt.timezone.utc),
    )


# ---------------------------------------------------------------- 사람(직원)
@router.get("", response_model=list[schemas.RobotOut],
            dependencies=[Depends(require_role("viewer"))])
def list_robots(db: Session = Depends(get_db)):
    """`직원-로봇상태` 대시보드용 목록."""
    now = dt.datetime.now(dt.timezone.utc)
    rows = db.scalars(
        select(models.Robot)
        .where(models.Robot.deleted_at.is_(None))
        .order_by(models.Robot.serial)
    ).all()
    return [_out(r, now) for r in rows]


@router.get("/{robot_id}", response_model=schemas.RobotOut,
            dependencies=[Depends(require_role("viewer"))])
def get_robot(robot_id: int, db: Session = Depends(get_db)):
    r = db.get(models.Robot, robot_id)
    if not r or r.deleted_at:
        raise HTTPException(404, f"robot {robot_id} 없음")
    return _out(r, dt.datetime.now(dt.timezone.utc))


@router.post("/{robot_id}/api-key", response_model=schemas.RobotApiKeyOut,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_role("admin"))])
def issue_api_key(robot_id: int, db: Session = Depends(get_db)):
    """로봇 API 키 발급 / 재발급.

    **평문 키는 이 응답에서 한 번만 나온다.** 서버는 해시만 저장한다.
    재발급하면 이전 키는 즉시 무효가 된다.
    """
    r = db.get(models.Robot, robot_id)
    if not r or r.deleted_at:
        raise HTTPException(404, f"robot {robot_id} 없음")

    key = generate_api_key()
    r.api_key_hash = hash_api_key(key)
    r.api_key_issued_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(r)
    return schemas.RobotApiKeyOut(
        robot_id=r.id, serial=r.serial, api_key=key,
        issued_at=r.api_key_issued_at,
    )


@router.delete("/{robot_id}/api-key", status_code=204,
               dependencies=[Depends(require_role("admin"))])
def revoke_api_key(robot_id: int, db: Session = Depends(get_db)):
    """키 폐기. 로봇을 분실했거나 키가 샜을 때."""
    r = db.get(models.Robot, robot_id)
    if not r:
        raise HTTPException(404, f"robot {robot_id} 없음")
    r.api_key_hash = None
    r.api_key_issued_at = None
    db.commit()
