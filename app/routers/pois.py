"""목적지(POI) 관리 API — 기능 `직원-목적지편집`, `직원-음성문구편집`.

관리자가 웹에서 목적지를 추가·수정·숨김하고 음성 문구를 편집한다.
이게 없으면 복지관 장소명이 바뀔 때마다 SQL을 직접 쳐야 한다.

원칙:
- 물리 삭제하지 않는다. 과거 trip이 참조하므로 is_active=false 로 숨긴다.
- POI를 다른 지도로 옮길 수 없다. 지도마다 좌표계가 다르다.
- 지도 범위 밖 좌표는 거부한다. 로봇이 갈 수 없는 지점이다.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import enums, models, schemas
from app.db import get_db
from app.deps import require_role
from app.geo import point

# 목적지 편집은 직원 이상만. 어르신 키오스크는 읽기만 하므로 여기 오지 않는다.
router = APIRouter(prefix="/pois", tags=["pois (관리)"],
                   dependencies=[Depends(require_role("staff"))])

ACTIVE_TRIP = (enums.TripStatus.requested, enums.TripStatus.navigating,
               enums.TripStatus.paused)


def _admin_out(db: Session, poi_id: int) -> schemas.PoiAdminOut:
    row = db.execute(
        select(models.Poi, func.ST_X(models.Poi.geom), func.ST_Y(models.Poi.geom))
        .where(models.Poi.id == poi_id)
    ).one_or_none()
    if row is None:
        raise HTTPException(404, f"poi {poi_id} 없음")
    p, x, y = row
    return schemas.PoiAdminOut(
        id=p.id, map_id=p.map_id, code=p.code, name_ko=p.name_ko,
        name_short=p.name_short, category=p.category, x=x, y=y,
        approach_yaw=p.approach_yaw, voice_script=p.voice_script,
        voice_file_uri=p.voice_file_uri,
        wheelchair_accessible=p.wheelchair_accessible,
        is_selectable=p.is_selectable, is_active=p.is_active,
        display_order=p.display_order,
        created_at=p.created_at, updated_at=p.updated_at,
    )


def _check_in_map(m: models.Map, x: float, y: float) -> None:
    """좌표가 지도 범위 안인지 확인.

    SLAM 지도의 origin은 좌하단 픽셀의 실좌표다(ROS 관례).
    width/height가 없는 지도는 검사를 건너뛴다.
    """
    if not (m.width_px and m.height_px):
        return
    x_max = m.origin_x + m.width_px * m.resolution_m
    y_max = m.origin_y + m.height_px * m.resolution_m
    if not (m.origin_x <= x <= x_max and m.origin_y <= y <= y_max):
        raise HTTPException(
            400,
            f"좌표 ({x}, {y})가 지도 범위 밖이다. "
            f"이 지도의 범위는 x [{m.origin_x:.1f}, {x_max:.1f}], "
            f"y [{m.origin_y:.1f}, {y_max:.1f}] 이다."
        )


@router.get("/{poi_id}", response_model=schemas.PoiAdminOut)
def get_poi(poi_id: int, db: Session = Depends(get_db)):
    return _admin_out(db, poi_id)


@router.post("", response_model=schemas.PoiAdminOut, status_code=201)
def create_poi(body: schemas.PoiCreate, db: Session = Depends(get_db)):
    """`직원-목적지편집` — 목적지 추가."""
    m = db.get(models.Map, body.map_id)
    if not m:
        raise HTTPException(404, f"map {body.map_id} 없음")
    _check_in_map(m, body.x, body.y)

    poi = models.Poi(
        map_id=body.map_id, code=body.code, name_ko=body.name_ko,
        name_short=body.name_short, category=body.category,
        geom=point(body.x, body.y), approach_yaw=body.approach_yaw,
        voice_script=body.voice_script, voice_file_uri=body.voice_file_uri,
        wheelchair_accessible=body.wheelchair_accessible,
        is_selectable=body.is_selectable, display_order=body.display_order,
        is_active=True,
    )
    db.add(poi)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if "uq_poi_code" in str(e.orig):
            raise HTTPException(409, f"이 지도에 code '{body.code}' 가 이미 있다") from e
        raise HTTPException(400, f"저장 실패: {e.orig}") from e
    return _admin_out(db, poi.id)


@router.patch("/{poi_id}", response_model=schemas.PoiAdminOut)
def update_poi(poi_id: int, body: schemas.PoiUpdate, db: Session = Depends(get_db)):
    """`직원-목적지편집` 수정 / `직원-음성문구편집`.

    보내지 않은 필드는 그대로 둔다.
    """
    poi = db.get(models.Poi, poi_id)
    if not poi:
        raise HTTPException(404, f"poi {poi_id} 없음")

    data = body.model_dump(exclude_unset=True)

    # 좌표는 x, y 를 함께 다뤄야 한다
    if "x" in data or "y" in data:
        m = db.get(models.Map, poi.map_id)
        cur = db.execute(
            select(func.ST_X(models.Poi.geom), func.ST_Y(models.Poi.geom))
            .where(models.Poi.id == poi_id)
        ).one()
        nx = data.pop("x", cur[0])
        ny = data.pop("y", cur[1])
        _check_in_map(m, nx, ny)
        poi.geom = point(nx, ny)

    for k, v in data.items():
        setattr(poi, k, v)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        if "uq_poi_code" in str(e.orig):
            raise HTTPException(409, f"이 지도에 code '{body.code}' 가 이미 있다") from e
        raise HTTPException(400, f"저장 실패: {e.orig}") from e
    return _admin_out(db, poi_id)


@router.delete("/{poi_id}", response_model=schemas.PoiAdminOut)
def hide_poi(poi_id: int, db: Session = Depends(get_db)):
    """`직원-목적지편집` — 목적지 숨김.

    물리 삭제가 아니다. 과거 trip이 이 POI를 참조하므로 지우면 통계가 깨진다.
    진행 중인 안내의 목적지면 거부한다.
    """
    poi = db.get(models.Poi, poi_id)
    if not poi:
        raise HTTPException(404, f"poi {poi_id} 없음")

    n = db.scalar(
        select(func.count()).select_from(models.Trip).where(
            models.Trip.dest_poi_id == poi_id,
            models.Trip.status.in_(ACTIVE_TRIP),
        )
    )
    if n:
        raise HTTPException(
            409, f"이 목적지로 진행 중인 안내가 {n}건 있다. 끝난 뒤에 숨길 것."
        )

    poi.is_active = False
    db.commit()
    return _admin_out(db, poi_id)


@router.post("/{poi_id}/restore", response_model=schemas.PoiAdminOut)
def restore_poi(poi_id: int, db: Session = Depends(get_db)):
    """숨긴 목적지를 다시 켠다."""
    poi = db.get(models.Poi, poi_id)
    if not poi:
        raise HTTPException(404, f"poi {poi_id} 없음")
    poi.is_active = True
    db.commit()
    return _admin_out(db, poi_id)
