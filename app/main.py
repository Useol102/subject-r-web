"""FastAPI 진입점.

실행:  uvicorn app.main:app --reload
문서:  http://localhost:8000/docs   <- AI팀·시뮬레이션팀은 여기만 보면 된다
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy import text

from app.config import settings
from app.db import engine
from app.routers import maps, pois, robots, trips

app = FastAPI(
    title="Subject R — 베리어프리 안내 로봇 API",
    description=(
        "복지관 실내 안내 로봇의 지도·목적지·주행 데이터 API.\n\n"
        "좌표는 모두 **SLAM 지도 원점 기준 미터 단위 로컬 좌표**다 (위경도 아님).\n"
        "시각은 모두 UTC다."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(maps.router)
app.include_router(pois.router)
app.include_router(robots.router)
app.include_router(trips.router)


@app.get("/", include_in_schema=False)
def root():
    """루트로 들어오면 API 문서로 보낸다.

    이게 없으면 http://localhost:8000 에 접속했을 때
    {"detail":"Not Found"} 가 떠서 서버가 죽은 줄 알기 쉽다.
    """
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["meta"])
def health():
    """DB와 PostGIS가 살아있는지 확인한다."""
    with engine.connect() as c:
        c.execute(text("SELECT 1"))
        postgis = c.execute(text("SELECT postgis_version()")).scalar()
    return {"status": "ok", "postgis": postgis}
