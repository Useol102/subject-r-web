"""환경 점검 — 하나씩 터지기 전에 한 번에 확인한다.

실행:  python tools/preflight.py
       .\.venv\Scripts\python.exe tools\preflight.py

각 항목을 순서대로 보고, 실패하면 무엇을 해야 하는지 알려준다.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

OK, FAIL, WARN = "[ OK ]", "[FAIL]", "[WARN]"
problems: list[str] = []


def line(mark: str, label: str, detail: str = "") -> None:
    print(f"  {mark} {label}" + (f"  —  {detail}" if detail else ""))


def main() -> int:
    print("\n=== Subject R 환경 점검 ===\n")

    # 1) Python 버전
    v = sys.version_info
    ver = f"{v.major}.{v.minor}.{v.micro}"
    if v < (3, 10):
        line(FAIL, "Python", f"{ver} — 3.10 이상 필요 (models.py가 'str | None' 문법을 쓴다)")
        problems.append("Python 3.12 설치 후:  .\\setup-python-env.ps1 -Recreate")
    elif v[:2] > (3, 13):
        line(WARN, "Python", f"{ver} — 검증된 건 3.11~3.13. 패키지 문제가 나면 3.12로 내릴 것")
    else:
        line(OK, "Python", ver)

    # 2) 패키지
    missing = []
    for mod in ("fastapi", "uvicorn", "sqlalchemy", "geoalchemy2",
                "psycopg", "alembic", "pydantic", "pydantic_settings"):
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)
    if missing:
        line(FAIL, "패키지", f"없음: {', '.join(missing)}")
        problems.append("pip install -r requirements.txt")
        return report()
    line(OK, "패키지", "전부 import 됨")

    # 3) .env
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        line(FAIL, ".env", "파일이 없다")
        problems.append("copy .env.example .env   그리고 DATABASE_URL 비밀번호 수정")
        return report()
    line(OK, ".env", "있음")

    from app.config import settings

    if not settings.DATABASE_URL.startswith("postgresql+psycopg://"):
        line(WARN, "DATABASE_URL", "스킴이 postgresql+psycopg:// 가 아니다 (psycopg2 아님)")
    else:
        line(OK, "DATABASE_URL", "스킴 정상")

    if settings.SECRET_KEY == "CHANGE_ME" or len(settings.SECRET_KEY) < 32:
        line(WARN, "SECRET_KEY", "기본값이거나 32자 미만")
        problems.append('python -c "import secrets; print(secrets.token_hex(32))" 로 만들어 .env에 넣을 것')
    else:
        line(OK, "SECRET_KEY", "설정됨")

    # 4) DB 접속
    from sqlalchemy import text

    from app.db import engine

    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
    except Exception as e:
        line(FAIL, "DB 접속", str(e).splitlines()[0][:90])
        problems.append("PostgreSQL 서비스가 켜져 있는지, .env 비밀번호가 맞는지 확인")
        return report()
    line(OK, "DB 접속", settings.DATABASE_URL.rsplit("@", 1)[-1])

    with engine.connect() as c:
        # 5) PostGIS
        try:
            pg = c.execute(text("SELECT postgis_version()")).scalar()
            line(OK, "PostGIS", pg)
        except Exception:
            line(FAIL, "PostGIS", "설치 안 됨")
            problems.append("Stack Builder -> Spatial Extensions -> PostGIS Bundle 설치 후 "
                            ".\\init-db.ps1 -Recreate")
            return report()

        # 6) 테이블
        n = c.execute(text(
            "SELECT count(*) FROM information_schema.tables "
            "WHERE table_schema='public' AND table_type='BASE TABLE' "
            "AND table_name NOT IN ('spatial_ref_sys', 'alembic_version')"
        )).scalar()
        if n == 9:
            line(OK, "테이블", f"{n}개")
        else:
            line(FAIL, "테이블", f"{n}개 (9개여야 정상)")
            problems.append(".\\init-db.ps1 -Recreate")

        # 7) 시드 데이터
        try:
            pois = c.execute(text("SELECT count(*) FROM v_selectable_poi")).scalar()
            line(OK if pois else WARN, "목적지 데이터", f"{pois}개")
            if not pois:
                problems.append("시드가 안 들어갔다:  .\\init-db.ps1 -Recreate")
        except Exception as e:
            line(FAIL, "목적지 데이터", str(e).splitlines()[0][:70])

        # 8) 좌표계
        try:
            srids = c.execute(text(
                "SELECT DISTINCT srid FROM geometry_columns"
            )).scalars().all()
            if srids and set(srids) == {0}:
                line(OK, "좌표계", "SRID 0 (실내 미터 좌표)")
            elif srids:
                line(WARN, "좌표계", f"SRID {srids} — 실내는 0이어야 한다")
        except Exception:
            pass

        # 9) 관리자 계정
        try:
            n_admin = c.execute(text(
                "SELECT count(*) FROM app_user WHERE role='admin' AND is_active"
            )).scalar()
            seed = c.execute(text(
                "SELECT count(*) FROM app_user WHERE email='admin@example.com'"
            )).scalar()
            if seed:
                line(WARN, "관리자 계정", "시드가 만든 admin@example.com 이 남아있다")
                problems.append("남은 시드 계정 정리:  "
                                "psql -d robotdb -c \"DELETE FROM app_user "
                                "WHERE email='admin@example.com'\"")
            elif n_admin:
                line(OK, "관리자 계정", f"admin {n_admin}명")
            else:
                line(WARN, "관리자 계정", "없다 — 관리 API를 쓸 수 없다")
                problems.append(".\\.venv\\Scripts\\python.exe tools\\create_admin.py")
        except Exception:
            pass

        # 10) 로봇 API 키
        try:
            total = c.execute(text("SELECT count(*) FROM robot WHERE deleted_at IS NULL")).scalar()
            keyed = c.execute(text(
                "SELECT count(*) FROM robot WHERE deleted_at IS NULL AND api_key_hash IS NOT NULL"
            )).scalar()
            if total and keyed < total:
                line(WARN, "로봇 API 키", f"{total}대 중 {keyed}대만 발급됨")
                problems.append("로봇이 서버에 보고하려면 키가 필요하다. "
                                "관리자로 로그인 후 POST /robots/{id}/api-key")
            elif total:
                line(OK, "로봇 API 키", f"{keyed}/{total}대 발급됨")
        except Exception:
            pass

        # 11) Alembic
        try:
            rev = c.execute(text("SELECT version_num FROM alembic_version")).scalar()
            line(OK, "Alembic", f"현재 리비전 {rev}")
        except Exception:
            line(WARN, "Alembic", "기준점이 안 찍혔다")
            problems.append("alembic stamp head")

    return report()


def report() -> int:
    print()
    if problems:
        print("해야 할 일:\n")
        for i, p in enumerate(problems, 1):
            print(f"  {i}. {p}")
        print()
        return 1
    print("전부 정상. 서버를 띄울 수 있다:\n")
    print("  uvicorn app.main:app --reload")
    print("  http://localhost:8000/docs\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
