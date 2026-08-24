"""SQLAlchemy 2.0 모델 — schema/001_phase1.sql 과 1:1 대응.

규칙:
- DDL이 이미 ENUM 타입과 테이블을 만들었으므로, 여기서는 create_type=False로
  "이미 있는 타입을 쓴다"고 알려준다. 안 그러면 Alembic이 타입을 또 만들려 한다.
- 좌표는 SRID 0 (SLAM 지도 원점 기준 미터 단위 로컬 좌표).
- 시각은 전부 timezone=True (timestamptz).
"""
from __future__ import annotations

import datetime as dt
import uuid as uuid_pkg

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, DateTime, Double, ForeignKey,
    Index, Integer, SmallInteger, Text, UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import CITEXT, ENUM, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app import enums


class Base(DeclarativeBase):
    pass


def _enum(py_enum, name: str):
    """DDL이 이미 만든 PostgreSQL ENUM 타입을 그대로 쓴다."""
    return ENUM(py_enum, name=name, create_type=False, values_callable=lambda e: [m.value for m in e])


# 부분 인덱스 조건에서 쓰는 '진행중' 상태 목록. 001_phase1.sql 과 문자열이 같아야 한다.
_ACTIVE_TRIP = "status = ANY (ARRAY['requested'::trip_status, 'navigating'::trip_status, 'paused'::trip_status])"



class Facility(Base):
    __tablename__ = "facility"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    code: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    floor_count: Mapped[int | None] = mapped_column(SmallInteger)
    contact_name: Mapped[str | None] = mapped_column(Text)
    contact_phone: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    maps: Mapped[list[Map]] = relationship(back_populates="facility")


class Map(Base):
    """SLAM 지도의 '한 버전'. 다시 돌리면 새 레코드다."""
    __tablename__ = "map"
    __table_args__ = (
        UniqueConstraint("facility_id", "floor", "version", name="uq_map_version"),
        CheckConstraint("resolution_m > 0", name="ck_map_resolution"),
        # 한 층에 활성 지도는 하나뿐. DB가 강제한다.
        Index("uq_map_active_per_floor", "facility_id", "floor",
              unique=True, postgresql_where=text("is_active")),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id", ondelete="RESTRICT"))
    floor: Mapped[int] = mapped_column(SmallInteger)
    version: Mapped[int] = mapped_column(Integer, server_default=text("1"))
    name: Mapped[str | None] = mapped_column(Text)
    pgm_uri: Mapped[str] = mapped_column(Text)
    yaml_uri: Mapped[str] = mapped_column(Text)
    resolution_m: Mapped[float] = mapped_column(Double)
    origin_x: Mapped[float] = mapped_column(Double)
    origin_y: Mapped[float] = mapped_column(Double)
    origin_yaw: Mapped[float] = mapped_column(Double, server_default=text("0"))
    width_px: Mapped[int | None] = mapped_column(Integer)
    height_px: Mapped[int | None] = mapped_column(Integer)
    slam_method: Mapped[str] = mapped_column(Text, server_default=text("'slam_toolbox'"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    facility: Mapped[Facility] = relationship(back_populates="maps")
    pois: Mapped[list[Poi]] = relationship(back_populates="map")
    zones: Mapped[list[Zone]] = relationship(back_populates="map")


class Poi(Base):
    """사용자가 화면에서 고르는 목적지."""
    __tablename__ = "poi"
    __table_args__ = (
        UniqueConstraint("map_id", "code", name="uq_poi_code"),
        Index("ix_poi_geom", "geom", postgresql_using="gist"),
        Index("ix_poi_map_live", "map_id", "display_order",
              postgresql_where=text("is_active AND is_selectable")),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    map_id: Mapped[int] = mapped_column(ForeignKey("map.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(Text)
    name_ko: Mapped[str] = mapped_column(Text)
    name_short: Mapped[str | None] = mapped_column(Text)
    category: Mapped[enums.PoiCategory] = mapped_column(_enum(enums.PoiCategory, "poi_category"))
    geom: Mapped[object] = mapped_column(Geometry("POINT", srid=0, spatial_index=False))
    approach_yaw: Mapped[float | None] = mapped_column(Double)
    voice_script: Mapped[str | None] = mapped_column(Text)
    voice_file_uri: Mapped[str | None] = mapped_column(Text)
    wheelchair_accessible: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    is_selectable: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    display_order: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    map: Mapped[Map] = relationship(back_populates="pois")


class Zone(Base):
    """진입금지 / 서행 구역."""
    __tablename__ = "zone"
    __table_args__ = (
        # 서행 구역인데 속도 제한이 없으면 로봇이 그냥 통과한다
        CheckConstraint("zone_type <> 'slow' OR speed_limit_mps IS NOT NULL",
                        name="ck_zone_speed"),
        Index("ix_zone_geom", "geom", postgresql_using="gist"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    map_id: Mapped[int] = mapped_column(ForeignKey("map.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    zone_type: Mapped[enums.ZoneType] = mapped_column(_enum(enums.ZoneType, "zone_type"))
    geom: Mapped[object] = mapped_column(Geometry("POLYGON", srid=0, spatial_index=False))
    speed_limit_mps: Mapped[float | None] = mapped_column(Double)
    priority: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    map: Mapped[Map] = relationship(back_populates="zones")


class RouteEdge(Base):
    """POI 간 연결. 베리어프리 판정(폭/계단/경사)이 여기 붙는다."""
    __tablename__ = "route_edge"
    __table_args__ = (
        UniqueConstraint("from_poi_id", "to_poi_id", name="uq_route_edge"),
        CheckConstraint("from_poi_id <> to_poi_id", name="ck_route_self"),
        CheckConstraint("distance_m >= 0", name="ck_route_distance"),
        Index("ix_route_edge_from", "from_poi_id", postgresql_where=text("is_active")),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    map_id: Mapped[int] = mapped_column(ForeignKey("map.id", ondelete="CASCADE"))
    from_poi_id: Mapped[int] = mapped_column(ForeignKey("poi.id", ondelete="CASCADE"))
    to_poi_id: Mapped[int] = mapped_column(ForeignKey("poi.id", ondelete="CASCADE"))
    distance_m: Mapped[float] = mapped_column(Double)
    is_bidirectional: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    slope_pct: Mapped[float] = mapped_column(Double, server_default=text("0"))
    has_step: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    min_width_m: Mapped[float | None] = mapped_column(Double)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Robot(Base):
    __tablename__ = "robot"
    __table_args__ = (
        CheckConstraint("battery_pct BETWEEN 0 AND 100", name="ck_robot_battery"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True,
                                                server_default=func.gen_random_uuid())
    serial: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(Text)
    current_map_id: Mapped[int | None] = mapped_column(ForeignKey("map.id", ondelete="SET NULL"))
    status: Mapped[enums.RobotStatus] = mapped_column(_enum(enums.RobotStatus, "robot_status"))
    battery_pct: Mapped[int | None] = mapped_column(SmallInteger)
    last_seen_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    firmware_version: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    # 로봇 API 키. 평문은 저장하지 않는다 (발급 시 한 번만 보여준다).
    api_key_hash: Mapped[str | None] = mapped_column(Text, unique=True)
    api_key_issued_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    # 가장 최근 위치. 덮어쓴다 — 과거 궤적은 3차 pose_log가 담당한다.
    # 이걸 분리한 덕에 로그 주기(Hz) 확정 전에도 대시보드와 진행 상황이 동작한다.
    last_geom: Mapped[object | None] = mapped_column(
        Geometry("POINT", srid=0, spatial_index=False))
    last_heading_rad: Mapped[float | None] = mapped_column(Double)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))


class AppUser(Base):
    """관리자·직원 계정만. 노인 이용자는 계정이 없다(키오스크)."""
    __tablename__ = "app_user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    hashed_password: Mapped[str] = mapped_column(Text)
    display_name: Mapped[str] = mapped_column(Text)
    role: Mapped[enums.UserRole] = mapped_column(_enum(enums.UserRole, "user_role"))
    facility_id: Mapped[int | None] = mapped_column(ForeignKey("facility.id", ondelete="SET NULL"))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    last_login_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Trip(Base):
    """안내 요청 1건. 'mission', 'task'라고 부르지 않는다."""
    __tablename__ = "trip"
    __table_args__ = (
        CheckConstraint("mode <> 'guide' OR dest_poi_id IS NOT NULL", name="ck_trip_dest"),
        CheckConstraint("ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at",
                        name="ck_trip_time"),
        Index("ix_trip_robot_time", "robot_id", text("requested_at DESC")),
        Index("ix_trip_dest", "dest_poi_id", text("requested_at DESC")),
        Index("ix_trip_live", "robot_id", postgresql_where=text(_ACTIVE_TRIP)),
        # 한 로봇이 동시에 두 곳으로 가려는 사태를 DB가 막는다
        Index("uq_trip_one_active_per_robot", "robot_id",
              unique=True, postgresql_where=text(_ACTIVE_TRIP)),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    uuid: Mapped[uuid_pkg.UUID] = mapped_column(UUID(as_uuid=True), unique=True,
                                                server_default=func.gen_random_uuid())
    robot_id: Mapped[int] = mapped_column(ForeignKey("robot.id", ondelete="RESTRICT"))
    map_id: Mapped[int] = mapped_column(ForeignKey("map.id", ondelete="RESTRICT"))
    mode: Mapped[enums.TripMode] = mapped_column(_enum(enums.TripMode, "trip_mode"))
    status: Mapped[enums.TripStatus] = mapped_column(_enum(enums.TripStatus, "trip_status"))
    origin_poi_id: Mapped[int | None] = mapped_column(ForeignKey("poi.id", ondelete="SET NULL"))
    dest_poi_id: Mapped[int | None] = mapped_column(ForeignKey("poi.id", ondelete="SET NULL"))
    requested_by: Mapped[enums.TripRequester] = mapped_column(_enum(enums.TripRequester, "trip_requester"))
    requested_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("app_user.id", ondelete="SET NULL"))
    is_simulated: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    requested_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    planned_distance_m: Mapped[float | None] = mapped_column(Double)
    actual_distance_m: Mapped[float | None] = mapped_column(Double)
    abort_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    events: Mapped[list[TripEvent]] = relationship(back_populates="trip",
                                                   order_by="TripEvent.ts")


class TripEvent(Base):
    """trip 중 일어난 사건. geom이 있어서 '어디서 자꾸 막히나'를 좌표로 집계할 수 있다."""
    __tablename__ = "trip_event"
    __table_args__ = (
        CheckConstraint("severity BETWEEN 0 AND 2", name="ck_event_severity"),
        Index("ix_event_trip", "trip_id", "ts"),
        Index("ix_event_type", "event_type", text("ts DESC")),
        Index("ix_event_geom", "geom", postgresql_using="gist"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trip.id", ondelete="CASCADE"))
    ts: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    event_type: Mapped[enums.TripEventType] = mapped_column(_enum(enums.TripEventType, "trip_event_type"))
    severity: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    geom: Mapped[object | None] = mapped_column(Geometry("POINT", srid=0, spatial_index=False))
    payload: Mapped[dict] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trip: Mapped[Trip] = relationship(back_populates="events")
