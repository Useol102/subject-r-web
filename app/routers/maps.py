"""지도 조회 + 로봇 오프라인 캐시 번들."""
import datetime as dt
import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.deps import require_role, robot_or_role
from app.geo import polygon_coords, xy

router = APIRouter(prefix="/maps", tags=["maps"])


def _poi_rows(db: Session, map_id: int, only_selectable: bool,
              include_inactive: bool = False):
    x, y = xy(models.Poi.geom)
    stmt = (
        select(models.Poi, x.label("x"), y.label("y"))
        .where(models.Poi.map_id == map_id)
        .order_by(models.Poi.display_order, models.Poi.name_ko)
    )
    if not include_inactive:
        stmt = stmt.where(models.Poi.is_active.is_(True))
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


@router.get("", response_model=list[schemas.MapOut],
            dependencies=[Depends(robot_or_role("viewer"))])
def list_maps(db: Session = Depends(get_db), active_only: bool = False):
    stmt = select(models.Map).order_by(models.Map.floor, models.Map.version.desc())
    if active_only:
        stmt = stmt.where(models.Map.is_active.is_(True))
    return db.scalars(stmt).all()


@router.get("/{map_id}", response_model=schemas.MapOut,
            dependencies=[Depends(robot_or_role("viewer"))])
def get_map(map_id: int, db: Session = Depends(get_db)):
    m = db.get(models.Map, map_id)
    if not m:
        raise HTTPException(404, f"map {map_id} 없음")
    return m


@router.get("/{map_id}/pois", response_model=list[schemas.PoiOut],
            dependencies=[Depends(robot_or_role("viewer"))])
def list_pois(map_id: int, db: Session = Depends(get_db), all_pois: bool = False):
    """사용자 UI의 목적지 목록.

    키오스크는 로봇 위에서 돌아가므로 **로봇 키(X-Robot-Key)** 로 접근한다.
    직원 대시보드는 로그인 토큰으로 접근한다.

    기본은 is_selectable=true인 것만 준다 (충전 스테이션 등은 빠진다).
    ?all_pois=true 면 목록 비노출 대상까지 포함한다. 숨긴 것(is_active=false)은 제외.
    """
    if not db.get(models.Map, map_id):
        raise HTTPException(404, f"map {map_id} 없음")
    return _poi_rows(db, map_id, only_selectable=not all_pois)


@router.get("/{map_id}/pois/admin", response_model=list[schemas.PoiAdminOut],
            dependencies=[Depends(require_role("staff"))])
def list_pois_admin(map_id: int, db: Session = Depends(get_db),
                    include_inactive: bool = True):
    """`직원-목적지편집` — 관리 화면용 목적지 목록.

    숨긴 목적지(is_active=false)까지 보여준다. 그래야 다시 켤 수 있다.
    사용자용 목록과 응답 형태가 다르다 — 운영 필드가 더 들어간다.
    """
    if not db.get(models.Map, map_id):
        raise HTTPException(404, f"map {map_id} 없음")
    x, y = xy(models.Poi.geom)
    stmt = (
        select(models.Poi, x, y)
        .where(models.Poi.map_id == map_id)
        .order_by(models.Poi.display_order, models.Poi.name_ko)
    )
    if not include_inactive:
        stmt = stmt.where(models.Poi.is_active.is_(True))
    return [
        schemas.PoiAdminOut(
            id=p.id, map_id=p.map_id, code=p.code, name_ko=p.name_ko,
            name_short=p.name_short, category=p.category, x=px, y=py,
            approach_yaw=p.approach_yaw, voice_script=p.voice_script,
            voice_file_uri=p.voice_file_uri,
            wheelchair_accessible=p.wheelchair_accessible,
            is_selectable=p.is_selectable, is_active=p.is_active,
            display_order=p.display_order,
            created_at=p.created_at, updated_at=p.updated_at,
        )
        for p, px, py in db.execute(stmt).all()
    ]


@router.patch("/{map_id}/pois/order", response_model=list[schemas.PoiOut],
              dependencies=[Depends(require_role("staff"))])
def reorder_pois(map_id: int, body: schemas.PoiReorder,
                 db: Session = Depends(get_db)):
    """`직원-목적지편집` — 표시 순서 일괄 변경 (관리 화면에서 드래그 정렬).

    자주 쓰는 목적지를 위로 올리는 용도. 노인 사용성과 직결된다.
    """
    if not db.get(models.Map, map_id):
        raise HTTPException(404, f"map {map_id} 없음")

    ids = [i.poi_id for i in body.items]
    owned = set(db.scalars(
        select(models.Poi.id).where(models.Poi.map_id == map_id,
                                    models.Poi.id.in_(ids))
    ).all())
    missing = [i for i in ids if i not in owned]
    if missing:
        raise HTTPException(400, f"이 지도에 속하지 않는 poi: {missing}")

    for item in body.items:
        db.get(models.Poi, item.poi_id).display_order = item.display_order
    db.commit()
    return _poi_rows(db, map_id, only_selectable=False)


@router.get("/{map_id}/bundle", response_model=schemas.MapBundle,
            dependencies=[Depends(robot_or_role("viewer"))])
def get_bundle(map_id: int, response: Response, db: Session = Depends(get_db)):
    """로봇이 오프라인 주행용으로 받아가는 일괄 데이터.

    로봇 키(X-Robot-Key) 또는 로그인 토큰이 필요하다.

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
