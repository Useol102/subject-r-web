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


class PoiAdminOut(ORMBase):
    """관리 화면용. 사용자 화면(PoiOut)에는 없는 운영 필드까지 포함한다."""
    id: int
    map_id: int
    code: str
    name_ko: str
    name_short: str | None = None
    category: enums.PoiCategory
    x: float
    y: float
    approach_yaw: float | None = None
    voice_script: str | None = None
    voice_file_uri: str | None = None
    wheelchair_accessible: bool
    is_selectable: bool
    is_active: bool
    display_order: int
    created_at: dt.datetime
    updated_at: dt.datetime


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
    voice_file_uri: str | None = None
    is_selectable: bool = True
    display_order: int = 0


class PoiUpdate(BaseModel):
    """부분 수정. 보내지 않은 필드는 건드리지 않는다.

    map_id는 없다 — POI를 다른 지도로 옮기는 것은 좌표계가 달라 의미가 없다.
    """
    code: str | None = None
    name_ko: str | None = None
    name_short: str | None = None
    category: enums.PoiCategory | None = None
    x: float | None = None
    y: float | None = None
    approach_yaw: float | None = None
    voice_script: str | None = None
    voice_file_uri: str | None = None
    wheelchair_accessible: bool | None = None
    is_selectable: bool | None = None
    display_order: int | None = None


class PoiOrderItem(BaseModel):
    poi_id: int
    display_order: int


class PoiReorder(BaseModel):
    """목록 순서 일괄 변경. 관리 화면에서 드래그로 정렬할 때 쓴다."""
    items: list[PoiOrderItem]


# ---------------------------------------------------------------- 인증
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: "UserOut"


class UserOut(ORMBase):
    id: int
    email: str
    display_name: str
    role: enums.UserRole
    facility_id: int | None = None
    is_active: bool
    last_login_at: dt.datetime | None = None


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=8, description="8자 이상")
    display_name: str
    role: enums.UserRole = enums.UserRole.viewer
    facility_id: int | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


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
    is_stale: bool = Field(
        default=False,
        description="마지막 보고가 오래돼 연결이 끊긴 것으로 보이는 상태",
    )
    has_api_key: bool = Field(default=False, description="API 키 발급 여부")
    x: float | None = Field(default=None, description="최신 위치 (지도 원점 기준 미터)")
    y: float | None = None
    heading_rad: float | None = None


class RobotApiKeyOut(BaseModel):
    """키 발급 응답. **평문 키는 이때 한 번만 나온다.**"""
    robot_id: int
    serial: str
    api_key: str = Field(description="이 값은 다시 볼 수 없다. 로봇에 바로 저장할 것")
    issued_at: dt.datetime
    warning: str = "이 키는 다시 표시되지 않는다. 잃어버리면 재발급해야 한다."


class RobotStatusIn(BaseModel):
    """로봇이 주기적으로 보내는 상태 보고.

    x, y 를 같이 보내면 최신 위치가 갱신된다 (덮어쓴다).
    과거 궤적은 저장하지 않는다 — 그건 3차 `pose_log` 의 몫이다.
    """
    status: enums.RobotStatus | None = None
    battery_pct: int | None = Field(default=None, ge=0, le=100)
    current_map_id: int | None = None
    firmware_version: str | None = None
    x: float | None = Field(default=None, description="지도 원점 기준 미터")
    y: float | None = None
    heading_rad: float | None = Field(default=None, description="진행 방향(라디안)")


class RobotSelfOut(ORMBase):
    """로봇이 자기 정보를 확인할 때. 사람용 목록과 다르다."""
    id: int
    uuid: str
    serial: str
    name: str
    status: enums.RobotStatus
    battery_pct: int | None = None
    current_map_id: int | None = None
    server_time: dt.datetime = Field(description="로봇 시계 보정용 서버 UTC 시각")


class TripProgressOut(BaseModel):
    """`사용자-진행상황` — 어르신 화면의 '얼마나 남았나'.

    remaining_m 은 **직선거리**다. 실제 주행 경로가 아니다.
    화면에 진행 막대를 그리는 데는 충분하고, 정확한 경로 거리는
    로봇의 Nav2가 알고 있으므로 필요해지면 로봇이 직접 보내면 된다.
    """
    trip_id: int
    status: enums.TripStatus
    dest_poi_id: int | None = None
    dest_name: str | None = None
    robot_x: float | None = None
    robot_y: float | None = None
    remaining_m: float | None = Field(default=None, description="목적지까지 직선거리")
    planned_distance_m: float | None = None
    progress_pct: int | None = Field(
        default=None, ge=0, le=100,
        description="planned_distance_m 가 있을 때만 계산된다")
    is_stale: bool = Field(default=False, description="로봇 보고가 끊긴 상태")
    updated_at: dt.datetime | None = Field(
        default=None, description="로봇이 마지막으로 보고한 시각")


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
