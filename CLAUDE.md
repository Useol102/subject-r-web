# CLAUDE.md — Subject R 웹 / 데이터베이스

## 이 저장소의 범위

베리어프리 이동 보조 자율주행 로봇 프로젝트에서 **웹사이트와 데이터베이스만** 담당한다.

| 담당한다 | 담당하지 않는다 |
|---|---|
| 데이터베이스 설계·구축 | 로봇 제어 (ROS2, Nav2) |
| 백엔드 API (FastAPI) | SLAM, 경로계획 |
| 관리자 대시보드 | AI 모델 학습 |
| 사용자 웹 UI | 하드웨어 |

다른 팀 작업을 이 저장소에서 하지 말 것. 다른 팀과는 **API와 DB 스키마로만** 연결된다.

## 로봇 쪽 맥락 (알고만 있으면 되는 것)

복지관 실내에서 노인·휠체어 이용자를 목적지까지 안내하는 자율주행 로봇이다.
Jetson Orin Nano + ROS2 Humble + Nav2 + SLAM Toolbox + YOLOv8n으로 돌아간다.
로봇은 ROS2 브리지 노드를 통해 우리 API에 HTTP/WebSocket으로 접속한다.
우리는 ROS를 직접 다루지 않는다.

**중요 제약: 클라우드를 쓰지 않는다.** 인터넷이 끊긴 복지관에서 LAN만으로 동작해야 한다.
따라서 로봇이 오프라인에서도 주행할 수 있도록 `GET /maps/{id}/bundle`로 지도·POI·구역을
일괄 다운로드해 캐시하는 구조를 전제로 설계했다.

## 기술 스택

| 영역 | 선택 |
|---|---|
| 백엔드 | Python 3.11 + FastAPI |
| DB | PostgreSQL 16 + PostGIS 3 (Docker) |
| ORM | SQLAlchemy 2.0 (`Mapped[]` 스타일) + GeoAlchemy2 |
| 마이그레이션 | Alembic |
| DB 드라이버 | **psycopg3** — 연결 문자열은 `postgresql+psycopg://` |
| 인증 | bcrypt (passlib 쓰지 말 것) + PyJWT |
| 프론트 | React 18 + TypeScript + Vite |
| 실내 지도 표시 | Leaflet `CRS.Simple` (위경도 기반 지도 API 쓰지 말 것) |
| 배포 | Docker Compose (클라우드 없이 어디서든 동일 재현) |
| Python 환경 | 프로젝트 폴더의 `.venv` (conda 쓰지 않는다) |

## 절대 규칙

- 시각은 전부 `TIMESTAMPTZ`, **UTC 저장**. KST 변환은 화면에서만.
- 좌표는 `geometry(Point, 0)` — SLAM 지도 원점 기준 **미터 단위 로컬 좌표**. 위경도(4326) 금지.
- 이미지·rosbag 같은 큰 파일은 **DB에 넣지 않는다** (`bytea` 금지). 파일은 객체 저장소, DB엔 경로 + sha256만.
- 마스터 데이터는 물리 삭제 금지 — `is_active` / `deleted_at`.
- 스키마 변경은 **반드시 Alembic**. `psql`에서 직접 `ALTER TABLE` 금지.
- **`alembic.ini`에는 ASCII만 쓴다.** Alembic이 이 파일을 로캘 인코딩(CP949)으로 읽어서,
  한글 주석을 넣으면 `configparser.ParsingError`로 죽는다. `.py`는 한글 주석 괜찮다.
- **`psql -c "..."` 인자에도 한글을 쓰지 않는다.** 콘솔이 CP949로 넘기는데
  `PGCLIENTENCODING=UTF8`과 어긋나 인코딩 에러가 난다. `.sql` 파일 안의 한글은 괜찮다.
- Python은 3.11~3.13을 쓴다. 3.14는 일부 패키지 휠이 아직 없다.
- PK는 `BIGINT GENERATED ALWAYS AS IDENTITY`. 외부 노출이 필요한 `robot`, `trip`만 `uuid` 컬럼 추가.

## 용어 (혼동 방지)

- **trip** — 안내 요청 1건. "mission", "task"라고 쓰지 말 것.
- **POI** — 사용자가 화면에서 고르는 목적지.
- **map** — SLAM으로 만든 지도의 **한 버전**. 다시 돌리면 새 레코드.
- **zone** — 진입금지·서행 구역.

## 현재 진행 상황

- ✅ 1차 테이블 9개 설계·검증 완료 (Docker / Windows 네이티브 양쪽에서 확인)
- ✅ SQLAlchemy 2.0 모델 — `alembic revision --autogenerate`가 빈 diff를 내는 것까지 확인 (모델 == DB)
- ✅ FastAPI 뼈대 + API 10개 엔드포인트 (실제 기동해서 응답 확인)
- ✅ Alembic 기준점 `0001_phase1`
- 📄 상세: `docs/DB-PHASE1.md`, `schema/001_phase1.sql`, `RUN-API.md`
- ⬜ 인증 (app_user 로그인, JWT)
- ⬜ POI/zone 편집 API (관리자 대시보드용)
- ⬜ WebSocket 실시간 로봇 위치
- ⬜ React 프론트 (9월)
- ⏸ 2차 (`data_file`, `annotation`, `dataset` 등) — AI팀 라벨 클래스 확정 대기
- ⏸ 3차 (`pose_log`, `detection_log` 파티션) — 로그 발행 주기(Hz) 확정 대기

2차·3차 테이블을 **추측해서 미리 만들지 말 것.** 답이 오면 그때 만든다.

## 검사 도구

코드를 고친 뒤에는 이 둘을 돌린다.

```powershell
.\fix-env.ps1                                          # .env / DB 연결 자동 수리
.\.venv\Scripts\python.exe tools\preflight.py        # 환경이 정상인지 한 번에
.\.venv\Scripts\python.exe tools\check_encoding.py   # CP949 인코딩 지뢰
```

`check_encoding.py`는 실제로 두 번 터진 사고를 자동으로 잡는다:
`alembic.ini`의 한글 주석, `psql -c` 인자의 한글, `.ps1`의 BOM 누락.

## 요구분석

설계 문서는 이 순서로 이어진다:
`REQUIREMENTS.md` → `SCREEN-FLOW.md` → `FEATURES.md` → `ERD.md` → 코드

**새 API를 만들 때는 `FEATURES.md` 의 기능 ID를 커밋 메시지에 적는다** (예: `feat(S-09): ...`).
그래야 "이 API 왜 있지"를 나중에 추적할 수 있다.

`docs/REQUIREMENTS.md` 에 사용자·화면흐름·기록범위와 **미결정 사항**이 정리돼 있다.
`[제안]` 표시는 웹팀 의견일 뿐 확정이 아니다. 회의 결과에 따라 스키마가 바뀔 수 있다.

1차 스키마는 회의록 기능 로드맵(①~⑨)에서 도출한 **초안**이다.
요구사항이 확정되면 Alembic 마이그레이션으로 수정한다 — 버리고 다시 짜지 않는다.

## 작업 시작 전 읽을 것

`docs/DB-PHASE1.md` — 1차 스키마의 전체 DDL, 컬럼별 설계 근거, 제약조건 검증 결과, 단계별 작업 지시가 들어 있다.
