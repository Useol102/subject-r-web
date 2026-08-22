"""DB의 ENUM 타입과 1:1로 대응한다.

주의: 값 문자열이 DB의 CREATE TYPE과 정확히 같아야 한다.
여기를 고치면 반드시 Alembic 마이그레이션도 같이 만들 것.
"""
from enum import Enum


class PoiCategory(str, Enum):
    entrance = "entrance"
    lobby = "lobby"
    restroom = "restroom"
    elevator = "elevator"
    stairs = "stairs"
    therapy_room = "therapy_room"
    program_room = "program_room"
    office = "office"
    cafeteria = "cafeteria"
    charging_station = "charging_station"
    waiting_area = "waiting_area"
    other = "other"


class ZoneType(str, Enum):
    keepout = "keepout"
    slow = "slow"
    caution = "caution"
    service_area = "service_area"


class RobotStatus(str, Enum):
    offline = "offline"
    idle = "idle"
    driving = "driving"
    charging = "charging"
    error = "error"
    estop = "estop"


class UserRole(str, Enum):
    admin = "admin"
    staff = "staff"
    viewer = "viewer"


class TripMode(str, Enum):
    guide = "guide"
    follow = "follow"
    manual = "manual"
    return_to_charge = "return_to_charge"


class TripStatus(str, Enum):
    requested = "requested"
    navigating = "navigating"
    paused = "paused"
    arrived = "arrived"
    completed = "completed"
    canceled = "canceled"
    failed = "failed"


class TripRequester(str, Enum):
    kiosk = "kiosk"
    dashboard = "dashboard"
    robot_auto = "robot_auto"


class TripEventType(str, Enum):
    obstacle_detected = "obstacle_detected"
    obstacle_cleared = "obstacle_cleared"
    replan = "replan"
    estop_pressed = "estop_pressed"
    estop_released = "estop_released"
    manual_override = "manual_override"
    paused = "paused"
    resumed = "resumed"
    waypoint_reached = "waypoint_reached"
    arrived = "arrived"
    low_battery = "low_battery"
    localization_lost = "localization_lost"
    error = "error"
