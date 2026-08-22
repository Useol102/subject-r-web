# Subject R — 웹 / 데이터베이스

베리어프리 이동 보조 자율주행 로봇 프로젝트의 **웹사이트 + 데이터베이스** 저장소.

복지관 실내에서 노인·휠체어 이용자를 목적지까지 안내하는 로봇의 데이터를 담당한다.
로봇 제어(ROS2)·SLAM·시뮬레이션·AI 모델 학습 코드는 이 저장소에 없다.

> **전제 조건: 클라우드를 쓰지 않는다.**
> 인터넷이 끊긴 복지관에서 로봇과 서버가 LAN만으로 동작해야 한다.

---

## 빠른 시작

```powershell
git clone https://github.com/Useol102/subject-r-web.git
cd subject-r-web

.\setup-windows.ps1          # PostgreSQL + Git + Node 설치 (없는 것만)
#   -> 이어서 Stack Builder 로 PostGIS Bundle 설치 (필수)

.\setup-python-env.ps1       # .venv 생성 + 패키지 설치
.\init-db.ps1                # DB 생성 + 테이블 9개 + 시드 데이터
.\fix-env.ps1                # .env 생성 + SECRET_KEY 발급 + 연결 확인

.\.venv\Scripts\alembic.exe stamp head
.\.venv\Scripts\uvicorn.exe app.main:app --reload
```

http://localhost:8000 → API 문서로 자동 이동

**막히면 먼저 이걸 돌릴 것:**

```powershell
.\.venv\Scripts\python.exe tools\preflight.py
```

Python 버전 / 패키지 / .env / DB 접속 / PostGIS / 테이블 / 시드 / 좌표계 / Alembic 을
한 번에 확인하고, 실패한 항목마다 무엇을 해야 하는지 알려준다.

Docker를 쓸 수 있으면 `docker compose up -d` 한 줄로도 된다 (가상화 필요).

---

## 무엇이 들어있나

| 경로 | 내용 |
|---|---|
| `schema/001_phase1.sql` | 1차 테이블 9개 DDL |
| `schema/002_seed_dev.sql` | 개발용 데모 복지관 데이터 |
| `app/models.py` | SQLAlchemy 2.0 모델 (DDL과 1:1) |
| `app/routers/` | API 엔드포인트 |
| `alembic/` | 스키마 마이그레이션 |
| `tools/` | 환경 점검 · 인코딩 검사 |
| `docs/DB-PHASE1.md` | **스키마 설계 근거** — 왜 이렇게 짰는지 |
| `RUN-API.md` | 서버 실행과 마이그레이션 방법 |
| `CLAUDE.md` | 프로젝트 규칙 (Claude Code가 읽는다) |

---

## 데이터 모델 한눈에

```
facility ──< map ──< poi ──< route_edge
                 └─< zone
                 └─< robot ──< trip ──< trip_event
app_user ────────────────────┘
```

**모든 공간 데이터는 `map`에 매달려 있다.** SLAM을 다시 돌리면 좌표계가 통째로 바뀌므로,
지도가 바뀌었는데 POI 좌표가 옛날 것이면 로봇이 벽으로 간다. `map`은 버전 테이블이다.

**좌표는 위경도가 아니다.** 실내이므로 SLAM 지도 원점 기준 미터 단위 로컬 좌표(SRID 0)를 쓴다.

---

## 주요 API

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/maps/{id}/pois` | 사용자 UI 목적지 목록 |
| GET | `/maps/{id}/bundle` | **로봇 오프라인 캐시** (지도+POI+구역+경로 일괄) |
| GET/POST | `/trips` | 안내 요청 |
| POST | `/trips/{id}/events` | 로봇이 사건 보고 |

전체 목록은 실행 후 `/docs` 참고. **다른 팀에는 `/docs` 주소만 주면 된다.**

같은 Wi-Fi의 팀원이 접속하게 하려면:

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 팀 규칙

- **스키마는 Alembic으로만 바꾼다.** `psql`에서 직접 `ALTER TABLE` 금지.
- **이미 push한 마이그레이션은 수정하지 않는다.** 새 리비전을 만든다.
- **`.env`는 커밋하지 않는다.** 비밀번호가 들어있다. `.gitignore`에 있다.
- **`alembic.ini`에는 ASCII만.** 한글 주석을 넣으면 한국어 Windows에서 alembic이 죽는다.
- 시각은 전부 UTC로 저장, 화면에서만 KST로 변환.
- 큰 파일(이미지·rosbag)은 DB에 넣지 않는다. 경로 + sha256만 저장.

작업 후에는 검사를 돌린다:

```powershell
.\.venv\Scripts\python.exe tools\check_encoding.py
```

---

## 진행 상황

- [x] 1차 테이블 9개 (`facility, map, poi, zone, route_edge, robot, app_user, trip, trip_event`)
- [x] SQLAlchemy 모델 + Alembic 기준점
- [x] API 11개 엔드포인트
- [ ] 인증 (직원 로그인)
- [ ] 관리자 대시보드 — 지도 위 실시간 로봇 위치
- [ ] 사용자 UI — 큰 버튼, 고대비, 음성 (노인 대상)
- [ ] 2차: AI 학습 데이터 테이블 — **AI팀 라벨 클래스 확정 대기**
- [ ] 3차: 주행 로그 파티션 테이블 — **로그 발행 주기(Hz) 확정 대기**
