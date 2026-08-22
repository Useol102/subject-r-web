"""geometry <-> x/y 변환 헬퍼.

DB에는 PostGIS geometry로 저장하고, API로는 숫자 x/y를 내보낸다.
shapely 같은 추가 의존성을 쓰지 않고 PostGIS 함수로 직접 뽑는다.
"""
import json

from sqlalchemy import func


def xy(col):
    """SELECT에 붙일 (x, y) 표현식."""
    return func.ST_X(col), func.ST_Y(col)


def point(x: float, y: float):
    """x, y -> SRID 0 POINT. 실내 로컬 좌표이므로 위경도가 아니다."""
    return func.ST_SetSRID(func.ST_MakePoint(x, y), 0)


def polygon_coords(geojson_str: str | None) -> list[list[float]]:
    """ST_AsGeoJSON 결과에서 바깥 링의 [[x,y], ...]를 뽑는다."""
    if not geojson_str:
        return []
    data = json.loads(geojson_str)
    rings = data.get("coordinates") or []
    return [[float(p[0]), float(p[1])] for p in rings[0]] if rings else []
