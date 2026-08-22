"""Pydantic 스키마 = API 계약.

좌표는 DB에 geometry로 들어있지만, API로는 x/y 숫자로 내보낸다.
로봇(ROS2)과 프론트 양쪽 다 WKB보다 숫자가 다루기 쉽다.
"""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field

from app import enums


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- POI
class PoiOut(ORMBase):
    id: int
    code: str
    name_ko: str
    label: str = Field(description="화면 버튼에 쓸 짧은 이름. name_short가 없으면 name_ko")
    category: enums.PoiCategory
    x: float = Field(description="지도 원점 기준 미터")
    y: float
    approach_yaw: float | None = None
    voice_script: str | None = None
    wheelchair_accessible: bool
    display_order: int


class PoiCreate(BaseModel):
    map_id: int
    code: str
    name_ko: str
    name_short: str | None = None
    category: enums.PoiCategory
    x: float
    y: float
    approach_yaw: float | None = None
    voice_script: str | None = None
    wheelchair_accessible: bool = True
    is_selectable: bool = True
    display_order: int = 0


# ---------------------------------------------------------------- Zone
class ZoneOut(ORMBase):
    id: int
    name: str
    zone_type: enums.ZoneType
    speed_limit_mps: float | None = None
    priority: int
    polygon: list[list[float]] = Field(description="[[x,y], ...] 닫힌 다각형")


# ---------------------------------------------------------------- Route
class RouteEdgeOut(ORMBase):
    id: int
    from_poi_id: int
    to_poi_id: int
    distance_m: float
    is_bidirectional: bool
    slope_pct: float
    has_step: bool
    min_width_m: float | None = None


# ---------------------------------------------------------------- Map
class MapOut(ORMBase):
    id: int
    facility_id: int
    floor: int
    version: int
    name: str | None = None
    pgm_uri: str
    yaml_uri: str
    resolution_m: float
    origin_x: float
    origin_y: float
    origin_yaw: float
    width_px: int | None = None
    height_px: int | None = None
    is_active: bool


class MapBundle(BaseModel):
    """로봇이 오프라인에서 쓰려고 통째로 받아가는 묶음.

    복지관에 인터넷이 없어도 로봇이 주행할 수 있어야 하므로,
    지도·목적지·금지구역·경로를 한 번에 내려받아 로컬에 캐시한다.
    """
    map: MapOut
    pois: list[PoiOut]
    zones: list[ZoneOut]
    edges: list[RouteEdgeOut]
    generated_at: dt.datetime
    etag: str = Field(description="내용 해시. 로봇은 이 값이 그대로면 재다운로드를 건너뛴다")


# ---------------------------------------------------------------- Robot
class RobotOut(ORMBase):
    id: int
    uuid: str
    serial: str
    name: str
    model: str | None = None
    current_map_id: int | None = None
    status: enums.RobotStatus
    battery_pct: int | None = None
    last_seen_at: dt.datetime | None = None


# ---------------------------------------------------------------- Trip
class TripCreate(BaseModel):
    robot_id: int
    mode: enums.TripMode
    dest_poi_id: int | None = None
    origin_poi_id: int | None = None
    requested_by: enums.TripRequester = enums.TripRequester.kiosk
    is_simulated: bool = False


class TripUpdate(BaseModel):
    status: enums.TripStatus | None = None
    actual_distance_m: float | None = None
    abort_reason: str | None = None


class TripEventIn(BaseModel):
    ts: dt.datetime | None = None
    event_type: enums.TripEventType
    severity: int = 0
    x: float | None = None
    y: float | None = None
    payload: dict = {}


class TripEventOut(ORMBase):
    id: int
    ts: dt.datetime
    event_type: enums.TripEventType
    severity: int
    x: float | None = None
    y: float | None = None
    payload: dict


class TripOut(ORMBase):
    id: int
    uuid: str
    robot_id: int
    map_id: int
    mode: enums.TripMode
    status: enums.TripStatus
    origin_poi_id: int | None = None
    dest_poi_id: int | None = None
    requested_by: enums.TripRequester
    is_simulated: bool
    requested_at: dt.datetime
    started_at: dt.datetime | None = None
    ended_at: dt.datetime | None = None
    planned_distance_m: float | None = None
    actual_distance_m: float | None = None
    abort_reason: str | None = None
