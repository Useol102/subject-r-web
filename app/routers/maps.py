"""지도 조회 + 로봇 오프라인 캐시 번들."""
import datetime as dt
import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.geo import polygon_coords, xy

router = APIRouter(prefix="/maps", tags=["maps"])


def _poi_rows(db: Session, map_id: int, only_selectable: bool):
    x, y = xy(models.Poi.geom)
    stmt = (
        select(models.Poi, x.label("x"), y.label("y"))
        .where(models.Poi.map_id == map_id, models.Poi.is_active.is_(True))
        .order_by(models.Poi.display_order, models.Poi.name_ko)
    )
    if only_selectable:
        stmt = stmt.where(models.Poi.is_selectable.is_(True))
    out = []
    for poi, px, py in db.execute(stmt).all():
        out.append(schemas.PoiOut(
            id=poi.id, code=poi.code, name_ko=poi.name_ko,
            label=poi.name_short or poi.name_ko,
            category=poi.category, x=px, y=py,
            approach_yaw=poi.approach_yaw, voice_script=poi.voice_script,
            wheelchair_accessible=poi.wheelchair_accessible,
            display_order=poi.display_order,
        ))
    return out


@router.get("", response_model=list[schemas.MapOut])
def list_maps(db: Session = Depends(get_db), active_only: bool = False):
    stmt = select(models.Map).order_by(models.Map.floor, models.Map.version.desc())
    if active_only:
        stmt = stmt.where(models.Map.is_active.is_(True))
    return db.scalars(stmt).all()


@router.get("/{map_id}", response_model=schemas.MapOut)
def get_map(map_id: int, db: Session = Depends(get_db)):
    m = db.get(models.Map, map_id)
    if not m:
        raise HTTPException(404, f"map {map_id} 없음")
    return m


@router.get("/{map_id}/pois", response_model=list[schemas.PoiOut])
def list_pois(map_id: int, db: Session = Depends(get_db), all_pois: bool = False):
    """사용자 UI의 목적지 목록.

    기본은 is_selectable=true인 것만 준다 (충전 스테이션 등은 빠진다).
    관리자 화면에서 전부 보려면 ?all_pois=true.
    """
    if not db.get(models.Map, map_id):
        raise HTTPException(404, f"map {map_id} 없음")
    return _poi_rows(db, map_id, only_selectable=not all_pois)


@router.get("/{map_id}/bundle", response_model=schemas.MapBundle)
def get_bundle(map_id: int, response: Response, db: Session = Depends(get_db)):
    """로봇이 오프라인 주행용으로 받아가는 일괄 데이터.

    복지관에 인터넷이 없어도 로봇이 돌아야 하므로,
    지도 메타 + 목적지 + 금지구역 + 경로 그래프를 한 번에 내려준다.
    """
    m = db.get(models.Map, map_id)
    if not m:
        raise HTTPException(404, f"map {map_id} 없음")

    pois = _poi_rows(db, map_id, only_selectable=False)

    zones = []
    zrows = db.execute(
        select(models.Zone, func.ST_AsGeoJSON(models.Zone.geom))
        .where(models.Zone.map_id == map_id, models.Zone.is_active.is_(True))
        .order_by(models.Zone.priority.desc())
    ).all()
    for z, gj in zrows:
        zones.append(schemas.ZoneOut(
            id=z.id, name=z.name, zone_type=z.zone_type,
            speed_limit_mps=z.speed_limit_mps, priority=z.priority,
            polygon=polygon_coords(gj),
        ))

    edges = db.scalars(
        select(models.RouteEdge).where(
            models.RouteEdge.map_id == map_id,
            models.RouteEdge.is_active.is_(True),
        )
    ).all()
    edges_out = [schemas.RouteEdgeOut.model_validate(e) for e in edges]

    payload = schemas.MapBundle(
        map=schemas.MapOut.model_validate(m),
        pois=pois, zones=zones, edges=edges_out,
        generated_at=dt.datetime.now(dt.timezone.utc),
        etag="",
    )
    # etag는 generated_at을 뺀 내용만으로 계산한다. 그래야 내용이 같으면 값도 같다.
    body = payload.model_dump(mode="json", exclude={"generated_at", "etag"})
    payload.etag = hashlib.sha256(
        json.dumps(body, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()[:16]
    response.headers["ETag"] = payload.etag
    return payload
