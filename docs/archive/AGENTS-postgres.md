# AGENTS.md — subject-r-web

> 베리어프리 실내 안내 로봇(Subject R)의 **웹 + 데이터베이스** 저장소.
> 이 파일은 에이전트가 자동으로 읽는 규칙 문서다. 작업 전에 반드시 전부 읽을 것.
> 배경과 설계 근거는 `docs/PROJECT-CONTEXT.md`, 현재 진행 상황은 `docs/STATUS.md`,
> 이미 밟은 지뢰는 `docs/PITFALLS.md` 에 있다.

---

## 0. 먼저 지킬 것 (여기만 어겨도 작업이 망가진다)

1. **한국어로 답한다.** 코드 주석도 한국어. 팀원 5명 전원 한국어 사용자다.
2. **`docs/PITFALLS.md` 를 읽기 전에 인코딩 관련 파일을 건드리지 않는다.**
   한글 윈도우에서만 터지는 함정이 여럿 있고, 전부 이미 한 번씩 당했다.
3. **`[미결정]` 항목을 임의로 확정하지 않는다.** 물어본다. (§7)
4. **큰 리팩터링 전에 승인을 받는다.** 지금 구조는 이유가 있어서 이렇게 됐다.
   바꾸고 싶으면 `docs/PROJECT-CONTEXT.md` 의 근거를 먼저 반박할 것.
5. **마이그레이션을 손으로 수정하지 않는다.** `alembic revision --autogenerate` 후
   diff 를 읽고, 이름 없는 제약조건(`None`)만 손으로 이름 붙인다. (§5)

---

## 1. 이 저장소가 담당하는 것

| 담당 | 내용 |
|---|---|
| ✅ 이 저장소 | 사용자 웹 UI, 관리자 대시보드, **전체 데이터베이스**, REST API |
| ❌ 다른 팀 | 로봇 제어(ROS2), SLAM, YOLO 학습, 하드웨어, 홍보 |

**전제 조건: 클라우드 없이 동작해야 한다.** 인터넷이 끊긴 복지관에서
로봇과 서버가 LAN(공유기 하나)만으로 돌아야 한다. AWS/GCP 를 제안하지 말 것.

---

## 2. 스택 (확정, 바꾸지 말 것)

| 영역 | 선택 | 절대 쓰지 말 것 |
|---|---|---|
| 언어 | Python 3.11 | Node.js 백엔드 |
| 웹 | FastAPI + Pydantic **v2** | Django, Flask |
| DB | PostgreSQL 16 + **PostGIS 3** | MongoDB, SQLite(서버용) |
| DB 드라이버 | **psycopg3** (`postgresql+psycopg://`) | **psycopg2 금지** |
| ORM | SQLAlchemy **2.0** (`Mapped[]` 스타일) | 1.x 스타일 `Column()` 선언 |
| 마이그레이션 | Alembic | 손으로 쓴 DDL |
| 비밀번호 해시 | **bcrypt 직접 호출** | **passlib 금지** (bcrypt 4.x 와 깨짐) |
| 토큰 | PyJWT | python-jose |
| 프론트 | React 18 + TypeScript + Vite | CRA |
| 배포 | Docker Compose | 클라우드 |

### 왜 Python 하나로 통일했나

로봇(rclpy)도 AI(YOLOv8, OpenCV)도 Python 이다. 5명짜리 팀에서 언어를 둘로
쪼개면 사람이 팀 사이를 못 옮겨 다닌다. AI팀이 짠 전처리 코드를 웹 백엔드에서
그대로 `import` 할 수 있는 게 이 선택의 핵심 값이다.

---

## 3. 폴더 구조

```
app/
  main.py        FastAPI 앱, 라우터 등록, /health
  config.py      환경변수 (pydantic-settings)
  db.py          엔진/세션, get_db 의존성
  deps.py        인증 의존성 — 사람(Bearer) / 로봇(X-Robot-Key)
  enums.py       DB enum 과 1:1 대응
  geo.py         PostGIS 헬퍼 (좌표 <-> WKB 변환 등)
  models.py      SQLAlchemy 모델 — 제약조건까지 전부 여기 선언
  schemas.py     Pydantic 요청/응답 스키마
  security.py    bcrypt, JWT, 로봇키 SHA-256
  routers/       auth, maps, pois, robots, stats, trips
alembic/versions/ 0001_phase1_baseline / 0002_robot_api_key / 0003_robot_last_pose
schema/          001_phase1.sql, 002_seed_dev.sql (참고용 원본 DDL)
tools/           preflight.py, check_encoding.py, create_admin.py
web/admin        관리자 대시보드 (React+TS, :5173)
web/kiosk        어르신용 키오스크 (React+TS, :5174)
docs/            REQUIREMENTS / SCREEN-FLOW / FEATURES / ERD / DB-PHASE1 / STATUS / PITFALLS
start-web.ps1    DB + API + 화면 둘을 한 번에 실행
```

---

## 4. 설계 규칙 (코드를 짤 때 지킬 것)

### 4.1 좌표계 — SRID 0

실내라서 **위경도(EPSG:4326)를 쓰지 않는다.** SLAM 지도 원점 기준
**미터 단위 로컬 좌표(SRID 0)** 다. PostGIS 는 SRID 0 에서도 거리·포함 판정이
정상 동작한다. `map.origin_x/y` 가 실좌표 변환 기준점이다.

`ST_SetSRID(ST_MakePoint(x, y), 0)` — 4326 을 쓴 코드를 보면 버그다.

### 4.2 시간

- DB 저장은 **전부 `TIMESTAMPTZ`, UTC**.
- 화면 표시와 **통계 집계만** KST 로 바꾼다:
  `... AT TIME ZONE 'Asia/Seoul'`
- 통계를 UTC 로 그룹핑하면 "오늘 이용자 수"가 9시간 밀린다. 실제로 겪었다.

### 4.3 인증 통로가 둘이다

| 주체 | 헤더 | 검증 | 만료 |
|---|---|---|---|
| 사람 | `Authorization: Bearer <JWT>` | bcrypt → JWT | 있음 |
| 로봇/키오스크 | `X-Robot-Key: <평문키>` | **SHA-256** 해시 조회 | 없음 |

**로봇 키를 bcrypt 로 해시하면 안 된다.** bcrypt 는 salt 가 매번 달라서
해시로 바로 조회가 안 되고, 전체 로봇을 순회해야 한다. 로봇은 1Hz 로
상태를 보고하므로 속도도 문제다. SHA-256 은 결정적이라 인덱스 조회가 된다.

역할 위계는 `admin > staff > viewer`. `require_role("staff")` 는 admin 도 통과시킨다.

### 4.4 불변조건은 DB 가 강제한다

애플리케이션 코드만 믿지 말고 **부분 유니크 인덱스**로 못을 박는다.

- 층마다 활성 지도는 하나: `UNIQUE (facility_id, floor) WHERE is_active`
- 로봇마다 진행 중 trip 은 하나: `UNIQUE (robot_id) WHERE status IN ('requested','moving')`

### 4.5 삭제 정책

마스터 데이터(`poi`, `zone`, `robot`, `app_user`)는 **물리 삭제 금지.**
`is_active` 또는 `deleted_at` 을 쓴다. 과거 `trip` 이 삭제된 POI 를
참조하는 사태를 막기 위해서다.

### 4.6 큰 파일은 DB 에 안 넣는다

학습 이미지, rosbag, SLAM 지도 PGM 은 파일시스템/MinIO 에 두고
DB 에는 `storage_uri` + `sha256` + 메타데이터만. **`bytea` 금지.**

### 4.7 네이밍

테이블은 단수 snake_case, 시간 컬럼은 `_at`, 불리언은 `is_`/`has_`.
기능 ID 는 `docs/FEATURES.md` 의 한국어 이름을 쓴다 (`직원-목적지편집` 같은).
`S-01` 식 코드는 팀원이 못 알아봐서 이미 한 번 갈아엎었다. 되돌리지 말 것.

---

## 5. 마이그레이션 작업법

```powershell
.\.venv\Scripts\alembic.exe revision --autogenerate -m "설명"
.\.venv\Scripts\alembic.exe upgrade head
```

**반드시 지킬 것:**

1. **`models.py` 에 제약조건을 전부 선언해둘 것.** `__table_args__` 에
   CHECK 와 부분 인덱스를 안 적으면 autogenerate 가 "DB 에만 있고 모델엔 없네"
   하고 **전부 DROP 하는 마이그레이션을 만든다.** 이미 당했다.
2. autogenerate 가 `op.create_unique_constraint(None, ...)` 처럼 **이름을 `None`**
   으로 내놓으면 손으로 이름을 붙인다 (`uq_robot_api_key_hash`). 이름이 없으면
   `downgrade()` 를 쓸 수 없다.
3. `downgrade()` 를 반드시 채운다. upgrade → downgrade → upgrade 로 검증할 것.
4. 작업 전 **정상 상태에서 autogenerate 가 빈 diff 를 내는지** 먼저 확인한다.
   빈 diff 가 안 나오면 모델과 DB 가 이미 어긋나 있는 것이다.

---

## 6. 개발 환경 실행

```powershell
.\setup-python-env.ps1        # .venv 생성 + 패키지 설치 (처음 한 번)
.\init-db.ps1                 # DB 생성 + PostGIS + 마이그레이션 + 시드
.\.venv\Scripts\python.exe tools\preflight.py   # 환경 점검
.\start-web.ps1               # DB + API + 관리자 + 키오스크 한 번에
```

- API 문서: <http://localhost:8000/docs>
- 관리자: <http://localhost:5173>  /  키오스크: <http://localhost:5174>

### 자주 막히는 지점

- **PostgreSQL 의 `bin` 은 PATH 에 없다.** `psql` 이 안 먹으면 전체 경로를 쓴다:
  `& "C:\Program Files\PostgreSQL\16\bin\psql.exe"`
- **venv 실행파일도 PATH 에 없다.** `alembic` 이 아니라 `.\.venv\Scripts\alembic.exe`.
- **PowerShell 에서 현재 폴더 스크립트는 `.\` 를 붙여야 한다.** `.\start-web.ps1`
- 키오스크는 **로봇 API 키를 넣기 전까지 설정 화면만 보여준다.** 정상이다.
  관리자 대시보드에서 키를 발급해 `web\kiosk\.env` 의 `VITE_ROBOT_KEY` 에 넣는다.

---

## 7. `[미결정]` — 임의로 정하지 말 것

1. 서버를 어디 둘 것인가 (노트북 / NAS / 미니PC) — 10월 필드테스트 전 결정
2. AI팀이 예상하는 학습 이미지 총량(GB) — 저장소 용량 결정에 필요
3. 라벨 클래스 목록 확정 — AI팀
4. 복지관 실제 장소명 / 층 구조 — 기관 컨택 대기
5. 음성(TTS) 실시간 생성 vs 미리 만든 파일

**전략: "구조는 지금, 값은 나중에."** 위 항목이 안 정해져도 스키마와 API 는
만들 수 있게 짜여 있다. 시드 데이터는 전부 `demo-welfare` 라는 가짜 기관이다.

---

## 8. 용어 (혼동 방지)

- **trip** = 안내 요청 1건. "mission", "task" 라고 쓰지 말 것.
- **POI** = 사용자가 화면에서 고르는 목적지.
- **waypoint** = 경로 계산용 중간점. 사용자에게 안 보인다. (아직 테이블 없음)
- **map** = SLAM 지도의 **한 버전**. 다시 돌리면 새 레코드다.
- **data_file** = 학습 후보 원본 파일 / **dataset** = 학습용으로 묶은 것.

---

## 9. 알려진 갭 (고쳐주면 좋은 것)

1. **테스트 코드가 하나도 없다.** `pytest` 와 `httpx` 는 설치돼 있는데 안 쓰고 있다.
   이게 현재 이 저장소의 가장 큰 약점이다. `tests/test_auth.py` 부터 만들면 좋다.
2. `_to_delete/` 폴더 — 출처 불명. 지우기 전에 소민에게 확인할 것.
3. 파티션 테이블(`pose_log`, `detection_log`)이 아직 설계만 있고 구현 전이다.
