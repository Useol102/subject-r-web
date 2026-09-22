# PROJECT CONTEXT — 프로젝트 배경과 설계 근거

> 이 문서는 2026-08 에 작성된 원본 프로젝트 컨텍스트다.
> 출처: SbR 8.11 회의록 + 하드웨어/소프트웨어 결정 사항.
> **"왜 이렇게 짰는지"가 여기 있다.** 구조를 바꾸고 싶으면 여기를 먼저 반박할 것.
> 현재 진행 상황은 `STATUS.md`, 작업 규칙은 저장소 루트의 `AGENTS.md` 를 볼 것.

---

## 1. 프로젝트 개요

- **목표**: 베리어프리 이동 보조 자율주행 로봇 개발. 복지관 실내에서 노인·휠체어 이용자를 목적지까지 안내한다.
- **팀**: 하드웨어 / 시뮬레이션 / AI 학습 / 웹사이트 / 홍보
- **이 저장소의 담당**: 웹사이트팀 (사용자 웹 UI, 관리자 대시보드, **그리고 전체 데이터베이스**)
- **전제 조건**: **클라우드 없이** 동작 가능해야 한다. 인터넷이 끊긴 복지관에서도 로봇과 서버가 LAN만으로 돌아야 한다.

### 로봇 기능 로드맵 (DB가 이걸 전부 뒷받침해야 함)

| 단계 | 기능 | DB가 담당하는 것 |
|---|---|---|
| ① | 수동주행 | 주행 로그 |
| ② | SLAM 복지관 지도 생성 | 지도 버전 관리 |
| ③ | 지정 좌표 자율주행 + 사물 인식 | 웨이포인트/POI, 인식 로그 |
| ④ | 장애물 회피 | 회피 이벤트, 금지구역 |
| ⑤ | 목적지 UI | POI 목록 = 웹 UI의 데이터 소스 |
| ⑥ | 사람 따라오기 | 주행 모드 구분, 추적 로그 |
| ⑦ | 음성 | POI별 음성 안내 문구 |
| ⑧ | 필드 테스트 | 실주행 통계 |
| ⑨ | 노인 사용성 개선 | 피드백 수집 |

### 기존 확정 스택 (로봇 쪽)

- 하드웨어: Jetson Orin Nano Super 8GB, 4WD skid-steer, RPLIDAR, USB 카메라, 7인치 터치스크린, 24V 배터리
- 소프트웨어: Ubuntu 22.04 + ROS2 Humble + Nav2 + SLAM Toolbox + robot_localization + OpenCV + YOLOv8n + TensorRT

---

## 2. 언어 및 기술 스택

### 결론

| 영역 | 선택 | 근거 |
|---|---|---|
| 백엔드 언어 | **Python 3.11** | 로봇(rclpy)·AI(YOLOv8, OpenCV)가 전부 Python. 언어를 통일해야 팀 간 코드와 인력이 오간다. AI팀이 짠 전처리 코드를 웹 백엔드에서 그대로 import할 수 있다 |
| 웹 프레임워크 | **FastAPI** | 이미 로봇 소프트웨어 스택에 포함되어 있음. Pydantic 모델 하나가 *ROS 메시지 ↔ API 스키마 ↔ DB 컬럼*의 계약 역할을 한다. `/docs`가 자동 생성되므로 AI팀·시뮬레이션팀이 문서 없이도 API를 쓴다 |
| DB | **PostgreSQL 16 + PostGIS** | 이 프로젝트 데이터의 절반이 좌표다. "이 구역 안에 로봇이 있나", "가장 가까운 화장실은" 같은 질문을 SQL 한 줄로 푼다. JSONB로 센서 메타데이터를 스키마 변경 없이 담는다. 무료·로컬 설치 가능 |
| ORM / 마이그레이션 | **SQLAlchemy 2.0 + Alembic** | 5명이 동시에 스키마를 건드린다. 마이그레이션 파일이 없으면 "내 DB에선 되는데"가 반드시 터진다 |
| 대용량 파일 저장 | **MinIO** (S3 호환, 로컬 설치) 또는 파일시스템 | 아래 §4 참조 |
| 프론트엔드 | **React 18 + TypeScript + Vite** | 관리자 대시보드와 사용자 UI를 한 스택으로. TS는 API 응답 타입을 FastAPI 스키마에서 자동 생성해 받아쓴다 |
| 실시간 통신 | **WebSocket (FastAPI 내장)** | 로봇 위치를 대시보드에 실시간 표시. 폴링보다 배터리·네트워크 부담이 적다 |
| 로봇 ↔ 서버 | ROS2 노드 하나를 **브리지**로 둔다 (rclpy → HTTP/WS) | 웹 서버가 ROS를 알 필요 없게 격리. 브리지만 ROS 메시지를 읽어 REST로 던진다 |
| 배포 | **Docker Compose** | §3의 미결정 사항을 해결하는 열쇠. 아래 참조 |

### 채택하지 않은 선택지와 이유

- **Node.js/Express**: 웹은 편하지만 AI·로봇 코드와 언어가 갈라진다. 5명짜리 팀에서 언어를 둘로 쪼개면 사람이 못 옮겨 다닌다.
- **Django**: 관리자 페이지가 공짜로 나오는 건 매력적이지만, 우리 관리자 화면은 지도·실시간 위치가 핵심이라 Django Admin으로 안 된다. 무거운 만큼을 못 뽑는다.
- **MongoDB**: 센서 로그엔 어울리지만 POI·경로·예약처럼 관계가 확실한 데이터가 더 많다. 관계형 + JSONB 조합이 양쪽을 다 커버한다.
- **SQLite (서버용)**: 로봇 온보드 캐시로는 쓴다(§3). 하지만 여러 명이 동시에 쓰는 본 서버로는 부적합.

---

## 3. `[미결정]` 서버를 어디에 둘 것인가 — 노트북 / NAS / 클라우드

**지금 결정하지 않아도 된다. 대신 결정을 미룰 수 있는 구조로 짠다.**

전부 Docker Compose로 묶으면 (`postgres` + `api` + `minio` + `web`) 노트북에서 NAS로, NAS에서 미니PC로 옮기는 일이 `docker compose up` 한 번이 된다. 지금 할 일은 장비 구매가 아니라 **compose 파일을 먼저 만드는 것**이다.

### 세 안 비교

| | 노트북 1대 | NAS | 클라우드 |
|---|---|---|---|
| 비용 | 0원 | 초기 구매비 | 월 과금 |
| 24시간 가동 | ✕ (닫으면 정지) | ○ | ○ |
| 데이터 안전성 | 백업 없음 | RAID로 디스크 고장 방어 | 높음 |
| 인터넷 없는 복지관 | ○ (같은 공유기) | ○ | **✕ 치명적** |
| 성능 | 충분 | 저사양 모델은 Postgres+API 동시에 버거움 | 충분 |
| 회의록 조건 부합 | ○ | ○ | **✕ "클라우드 없이"** |

### 권장 진행

1. **8~9월 (개발기)** — 각자 노트북에서 Docker Compose로 로컬 실행. 스키마는 Alembic 마이그레이션으로 공유하므로 DB 파일을 주고받을 필요가 없다.
2. **10월 필드 테스트 전** — 상시 켜둘 기기 한 대를 정한다. 판단 기준은 딱 두 가지: **(a) 학습 이미지 총량이 몇 GB로 가는가** — AI팀에 8월 안에 물어볼 것. (b) **디스크가 죽으면 프로젝트가 죽는가** — 죽는다면 NAS(RAID)로 간다.
3. **필드 테스트 당일** — 로봇 + 서버 기기 + 노트북을 휴대용 공유기 하나에 물린다. 인터넷 불필요.

### 어느 안을 고르든 반드시 넣을 것: 로봇 온보드 캐시

서버가 꺼져 있거나 Wi-Fi가 끊겨도 로봇은 주행을 계속해야 한다.

- Jetson에 **SQLite 큐**를 둬서 주행 로그·인식 결과를 일단 로컬에 쌓는다.
- 서버 연결이 복구되면 `synced_at IS NULL`인 행만 배치 업로드한다.
- 이러면 "서버를 어디 둘지"가 **로봇 동작의 필수 조건이 아니게 된다.** 이게 결정을 미룰 수 있는 진짜 이유다.

---

## 4. 데이터베이스 설계

### 4.1 핵심 원칙 3가지

**원칙 1 — 큰 건 파일, 가리키는 건 DB.**
학습용 이미지, rosbag, 포인트클라우드, SLAM 지도 PGM은 **절대 DB에 바이너리로 넣지 않는다** (`bytea` 금지). 파일은 MinIO/파일시스템에 두고, DB에는 `storage_uri` + `sha256` + 메타데이터만 저장한다.
→ DB 백업이 수십 MB로 유지되고, 같은 이미지가 두 번 들어와도 sha256으로 걸러진다.

**원칙 2 — 원본과 데이터셋을 분리한다.**
`data_file`(찍힌 원본)과 `dataset`(학습에 쓰려고 묶은 것)을 별개 테이블로 둔다. 재라벨링하거나 train/val을 다시 나눠도 원본은 건드리지 않는다. 학습 결과가 나빠졌을 때 "어떤 데이터 조합이었나"를 되짚을 수 있다.

**원칙 3 — 라벨 클래스는 DB가 단일 진실.**
YOLO는 클래스를 `0, 1, 2` 정수 인덱스로 쓴다. 이 매핑이 AI팀 코드와 웹 DB에서 어긋나면 **학습은 성공했는데 결과가 전부 틀린** 최악의 버그가 난다. `label_class` 테이블을 만들고 인덱스를 여기서만 발급한다.

### 4.2 데이터 3계층

```
A. 서비스/마스터 데이터   작다, 자주 읽는다, 관계가 중요   → 일반 테이블
B. 운행 텔레메트리        크다, 시간순, append-only        → 월 단위 파티션 테이블
C. AI 학습 데이터         파일이 크다, 버전이 중요          → 메타데이터만 DB + 객체 저장소
```

### 4.3 테이블 목록

#### A. 공간 / 마스터

| 테이블 | 용도 | 주요 컬럼 |
|---|---|---|
| `facility` | 복지관 등 운영 기관 | name, address, floors, contact |
| `map` | SLAM 지도 **버전** | facility_id, floor, version, pgm_uri, yaml_uri, resolution, origin_x/y, is_active |
| `poi` | 목적지 (①⑤⑦ 대응) | map_id, code, name_ko, geom(Point), category(화장실/치료실/엘리베이터/출입구), voice_script, wheelchair_accessible, is_active |
| `zone` | 진입금지·서행 구역 (④) | map_id, geom(Polygon), zone_type, speed_limit |
| `route_edge` | POI 간 연결 그래프 | from_poi_id, to_poi_id, distance_m, slope_pct, has_step |

> `map`을 버전 테이블로 두는 이유: SLAM을 다시 돌리면 좌표계가 통째로 바뀐다. 지도가 바뀌었는데 POI 좌표가 옛날 것이면 로봇이 벽으로 간다. POI는 반드시 특정 `map_id`에 소속된다.

#### B. 로봇 / 운행

| 테이블 | 용도 | 주요 컬럼 |
|---|---|---|
| `robot` | 로봇 대수 관리 | serial, name, current_map_id, status, battery_pct, last_seen_at |
| `trip` | 안내 요청 1건 (③⑥) | robot_id, origin_poi_id, dest_poi_id, mode(guide/follow/manual), status, started_at, ended_at, distance_m, is_success, abort_reason |
| `trip_event` | trip 중 사건 (④) | trip_id, ts, event_type(obstacle/replan/estop/manual_override/arrived), payload JSONB |
| `pose_log` | 위치 시계열 | robot_id, ts, geom(Point), heading_rad, linear_v, angular_v, battery_pct |
| `detection_log` | 인식 결과 (③⑥) | robot_id, trip_id, ts, label_class_id, confidence, bbox JSONB, distance_m, data_file_id(nullable) |
| `feedback` | 사용성 피드백 (⑨) | trip_id, rating(1–5), comment, input_method(touch/voice), created_at |

> `pose_log`·`detection_log`는 1Hz만 돌려도 하루 8만 행이 쌓인다. 처음부터 `PARTITION BY RANGE (ts)` 월 단위로 만들어라. 나중에 바꾸려면 전부 마이그레이션해야 한다.
> `detection_log.data_file_id`가 nullable인 이유: 모든 프레임을 저장할 순 없다. **confidence가 낮았던 프레임만** 이미지를 남겨 학습 데이터로 재활용한다 — 이게 ⑨ "사용성 개선"의 데이터 파이프라인이 된다.

#### C. AI 학습 데이터

| 테이블 | 용도 | 주요 컬럼 |
|---|---|---|
| `data_file` | 원본 파일 1개 | storage_uri, **sha256 (UNIQUE)**, bytes, media_type(image/rosbag/pcd), captured_at, robot_id, map_id, meta JSONB |
| `label_class` | 클래스 정의 (원칙 3) | yolo_index (UNIQUE), key(person/wheelchair/obstacle/door), name_ko |
| `annotation` | 라벨 1개 | data_file_id, label_class_id, bbox/polygon, annotator, verified_by, created_at |
| `dataset` | 학습용 묶음 | name, version, purpose(detection/slam), created_at, note |
| `dataset_item` | 묶음 ↔ 파일 (N:M) | dataset_id, data_file_id, split(train/val/test) |
| `model_run` | 학습 이력 | dataset_id, model_name, hyperparams JSONB, mAP50, weights_uri, trained_at |

> `model_run`이 있으면 "8월에 학습한 모델이 왜 더 잘했지?"에 답할 수 있다. 학습을 몇 번 돌리고 나면 반드시 필요해진다.

#### D. 계정

| 테이블 | 용도 |
|---|---|
| `app_user` | **관리자·직원 계정만.** email, hashed_password, role(admin/staff/viewer) |

> 노인 이용자에게 회원가입을 시키지 않는다. 로봇 터치스크린은 키오스크 방식(로그인 없음), 웹은 직원용이다. 계정 테이블을 단순하게 유지하는 게 ⑨ 사용성 목표와도 맞는다.

### 4.4 공통 규칙 (Claude Code가 지킬 것)

- PK는 `BIGSERIAL`. 외부 노출되는 것(`robot`, `trip`)만 `uuid` 컬럼을 따로 둔다.
- 모든 테이블에 `created_at timestamptz NOT NULL DEFAULT now()`.
- **시간은 전부 UTC로 저장.** KST 변환은 화면에서만 한다.
- 마스터 데이터(`poi`, `zone`, `robot`)는 물리 삭제 금지 — `is_active` 또는 `deleted_at` 사용. 과거 `trip`이 삭제된 POI를 참조하는 사태를 막는다.
- **좌표계**: 실내이므로 위경도(EPSG:4326)를 쓰지 않는다. SLAM 지도 원점 기준 **미터 단위 로컬 좌표(SRID 0)** 를 쓴다. PostGIS는 SRID 0에서도 거리·포함 판정이 정상 동작한다. `map.origin_x/y`가 실좌표 변환 기준점이다.
- 네이밍: 테이블은 단수 snake_case, 시간 컬럼은 `_at`, 불리언은 `is_`/`has_`.

---

## 5. 팀 간 데이터 계약

| 주는 팀 | 받는 것 | 형식 |
|---|---|---|
| AI 학습팀 → DB | 기관 조사 결과, 복지관 지도, 학습 이미지 | `data_file` 업로드 API + `annotation` |
| DB → AI 학습팀 | 학습 데이터셋 | `GET /datasets/{id}/export?format=yolo` → 이미지 + `.txt` 라벨 + `data.yaml` zip |
| 시뮬레이션팀 → DB | 시뮬 주행 결과 | `trip`에 `is_simulated` 플래그를 두고 실주행과 같은 테이블에 저장 |
| 하드웨어팀 → DB | 로봇 사양 | `robot` 레코드 수동 등록 |
| DB → 로봇 | POI 목록, 지도, 금지구역 | `GET /maps/{id}/bundle` (오프라인 캐시용 일괄 다운로드) |

> YOLO export를 **API로 만드는 것**이 중요하다. AI팀이 매번 웹팀에 파일을 달라고 하면 병목이 된다.

---

## 6. 8월 3주차 목표 (완료 — 현재 상황은 STATUS.md 참고)

회의록상 웹팀 8월 3주차 산출물은 "데이터베이스 구축 (클라우드 없이 가능하도록)"이다. 9월의 대시보드·UI는 그 다음이다.

- [ ] `docker-compose.yml` (postgres+postgis, minio, api)
- [ ] Alembic 초기 마이그레이션 — §4.3 전체 테이블
- [ ] SQLAlchemy 모델 + Pydantic 스키마
- [ ] `label_class` 시드 데이터 (AI팀과 클래스명 합의 후)
- [ ] `poi` 시드 데이터 (복지관 컨택 후 실제 장소명으로)
- [ ] 파일 업로드 API (`data_file` 생성 + sha256 중복 검사)
- [ ] `GET /maps/{id}/bundle` (로봇 오프라인 캐시)
- [ ] README — 팀원이 `docker compose up` 한 줄로 띄우는 법

## 7. 9월 목표

- 관리자 대시보드: 지도 위 실시간 로봇 위치(WebSocket), trip 목록, POI 편집
- 사용자 UI(⑤ 목적지 선택): 큰 버튼, 고대비, 텍스트 최소화, 아이콘 + 음성 — 노인 대상이 전제
- 데이터셋 관리 화면: 이미지 업로드, 라벨 확인, YOLO export

---

## 8. 용어 정의 (혼동 방지)

- **trip** = 안내 요청 1건. "mission", "task"라는 말을 쓰지 말고 trip으로 통일한다.
- **POI** = 로봇이 갈 수 있는 목적지. 사용자가 화면에서 고르는 것.
- **waypoint** = 경로 계산용 중간 지점. 사용자에게 보이지 않는다. (필요해지면 별도 테이블)
- **map** = SLAM으로 만든 지도의 **한 버전**. 다시 돌리면 새 레코드다.
- **data_file** = 학습 후보 원본 파일. **dataset** = 학습에 쓰려고 묶은 것.

---

## 9. 아직 물어봐야 하는 것 `[미결정]` (2026-09-17 기준 여전히 미결)

1. 서버 기기 (노트북/NAS) — 판단 기준은 §3
2. AI팀이 예상하는 학습 이미지 총량 (GB) — 저장소 용량 결정에 필요
3. 라벨 클래스 목록 확정 — AI팀
4. 복지관 실제 장소명/층 구조 — 임원 기관 컨택 결과 대기
5. 음성(⑦) TTS를 실시간 생성할지, 미리 만든 음성 파일을 POI에 붙일지
