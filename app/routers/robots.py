"""로봇 목록/상태."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db

router = APIRouter(prefix="/robots", tags=["robots"])


@router.get("", response_model=list[schemas.RobotOut])
def list_robots(db: Session = Depends(get_db)):
    stmt = (
        select(models.Robot)
        .where(models.Robot.deleted_at.is_(None))   # 물리 삭제를 하지 않으므로 필터가 필요
        .order_by(models.Robot.serial)
    )
    rows = db.scalars(stmt).all()
    return [
        schemas.RobotOut(
            id=r.id, uuid=str(r.uuid), serial=r.serial, name=r.name, model=r.model,
            current_map_id=r.current_map_id, status=r.status,
            battery_pct=r.battery_pct, last_seen_at=r.last_seen_at,
        )
        for r in rows
    ]


@router.get("/{robot_id}", response_model=schemas.RobotOut)
def get_robot(robot_id: int, db: Session = Depends(get_db)):
    r = db.get(models.Robot, robot_id)
    if not r or r.deleted_at:
        raise HTTPException(404, f"robot {robot_id} 없음")
    return schemas.RobotOut(
        id=r.id, uuid=str(r.uuid), serial=r.serial, name=r.name, model=r.model,
        current_map_id=r.current_map_id, status=r.status,
        battery_pct=r.battery_pct, last_seen_at=r.last_seen_at,
    )
