# DB-PHASE1.md — 1차 테이블 스키마

> 베리어프리 이동 보조 자율주행 로봇 / 웹·데이터베이스팀
> 대상: PostgreSQL 16 + PostGIS 3
> **이 문서의 DDL은 실제 PostgreSQL 16 + PostGIS 3에서 실행 검증을 마쳤다.** 제약조건 6종이 의도대로 동작하는 것까지 확인했다 (§6).
> Claude Code에 이 파일을 넣고 §7의 작업 지시부터 시작하면 된다.

---

## 1. 이 문서의 범위

1차 = **다른 팀의 답변 없이 지금 확정할 수 있는 테이블**만 담았다.

| 포함 (9개) | 제외 (나중) | 제외 이유 |
|---|---|---|
| `facility`, `map`, `poi`, `zone`, `route_edge`, `robot`, `app_user`, `trip`, `trip_event` | `label_class`, `data_file`, `annotation`, `dataset`, `dataset_item`, `model_run` | AI팀 라벨 클래스 확정 필요 |
| | `pose_log`, `detection_log` | 로그 발행 주기(Hz) 확정 후 파티션 설계 |

복지관 실제 장소명이 없어도 **구조는 지금 다 만든다.** 모르는 건 값이지 구조가 아니다. 값은 §5 가짜 시드로 채우고, 기관 컨택 결과가 오면 `UPDATE`만 하면 된다.

---

## 2. 전역 규칙 (Claude Code가 반드시 지킬 것)

| 항목 | 규칙 | 이유 |
|---|---|---|
| PK | `BIGINT GENERATED ALWAYS AS IDENTITY` | `SERIAL`은 구식. IDENTITY가 표준이고 시퀀스 소유권이 명확 |
| 외부 노출 ID | `robot`, `trip`만 `uuid` 컬럼 추가 | 로봇 인증 토큰이나 URL에 순번(1,2,3)을 노출하면 안 됨 |
| 시각 | 전부 `TIMESTAMPTZ`, **UTC 저장** | KST 변환은 화면에서만. 서버를 옮겨도 시각이 안 틀어짐 |
| 좌표 | `geometry(Point, 0)` — **미터 단위 로컬 좌표** | 실내라 위경도(4326)를 쓰지 않는다. SLAM 지도 원점 기준. SRID 0에서도 PostGIS 거리·포함 판정이 정상 동작함(검증 완료) |
| 삭제 | 마스터 데이터는 `is_active` / `deleted_at`. 물리 삭제 금지 | 과거 `trip`이 삭제된 POI를 참조하면 통계가 깨짐 |
| 네이밍 | 테이블 단수 snake_case, 시각은 `_at`, 불리언은 `is_`/`has_` | |
| 스키마 변경 | **반드시 Alembic 마이그레이션.** `psql`에서 직접 `ALTER TABLE` 금지 | 팀원 DB가 조용히 갈라지는 걸 막음 |

---

## 3. 테이블 관계

```
facility ──< map ──< poi ──< route_edge (from/to)
                 └─< zone
                 └─< robot.current_map_id
                 └─< trip >── robot
                          └─< trip_event
app_user ──< trip.requested_by_user_id
```

핵심: **모든 공간 데이터는 `map`에 매달려 있다.** SLAM을 다시 돌리면 좌표계가 통째로 바뀌므로, POI·zone·경로가 "어느 지도 버전의 좌표인지"를 잃으면 로봇이 벽으로 간다.

---

## 4. DDL (검증 완료)

`schema/001_phase1.sql`로 저장할 것.

```sql
-- =====================================================================
-- 베리어프리 이동 보조 로봇 — 1차 스키마 (Phase 1)
-- PostgreSQL 16 + PostGIS 3
-- 좌표계: SLAM 지도 원점 기준 미터 단위 로컬 데카르트 좌표 (SRID 0)
-- 시각: 전부 timestamptz, UTC 저장
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- 대소문자 무시 email

-- ---------------------------------------------------------------------
-- ENUM 타입
-- ---------------------------------------------------------------------
CREATE TYPE poi_category AS ENUM (
    'entrance', 'lobby', 'restroom', 'elevator', 'stairs',
    'therapy_room', 'program_room', 'office', 'cafeteria',
    'charging_station', 'waiting_area', 'other'
);

CREATE TYPE zone_type AS ENUM ('keepout', 'slow', 'caution', 'service_area');

CREATE TYPE robot_status AS ENUM (
    'offline', 'idle', 'driving', 'charging', 'error', 'estop'
);

CREATE TYPE user_role AS ENUM ('admin', 'staff', 'viewer');

CREATE TYPE trip_mode AS ENUM ('guide', 'follow', 'manual', 'return_to_charge');

CREATE TYPE trip_status AS ENUM (
    'requested', 'navigating', 'paused', 'arrived',
    'completed', 'canceled', 'failed'
);

CREATE TYPE trip_requester AS ENUM ('kiosk', 'dashboard', 'robot_auto');

CREATE TYPE trip_event_type AS ENUM (
    'obstacle_detected', 'obstacle_cleared', 'replan',
    'estop_pressed', 'estop_released', 'manual_override',
    'paused', 'resumed', 'waypoint_reached', 'arrived',
    'low_battery', 'localization_lost', 'error'
);

-- ---------------------------------------------------------------------
-- updated_at 자동 갱신 트리거
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- A. 공간 / 마스터
-- =====================================================================

-- 운영 기관 (복지관)
CREATE TABLE facility (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          TEXT        NOT NULL UNIQUE,
    name          TEXT        NOT NULL,
    address       TEXT,
    floor_count   SMALLINT,
    contact_name  TEXT,
    contact_phone TEXT,
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

-- SLAM 지도 "버전". SLAM을 다시 돌리면 새 레코드가 생긴다.
CREATE TABLE map (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id   BIGINT      NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
    floor         SMALLINT    NOT NULL,              -- 지하 1층 = -1
    version       INTEGER     NOT NULL DEFAULT 1,
    name          TEXT,
    pgm_uri       TEXT        NOT NULL,              -- 예: s3://maps/sbr/1f/v3.pgm
    yaml_uri      TEXT        NOT NULL,
    resolution_m  DOUBLE PRECISION NOT NULL,         -- m/pixel (예: 0.05)
    origin_x      DOUBLE PRECISION NOT NULL,
    origin_y      DOUBLE PRECISION NOT NULL,
    origin_yaw    DOUBLE PRECISION NOT NULL DEFAULT 0,
    width_px      INTEGER,
    height_px     INTEGER,
    slam_method   TEXT        NOT NULL DEFAULT 'slam_toolbox',
    is_active     BOOLEAN     NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_map_version UNIQUE (facility_id, floor, version),
    CONSTRAINT ck_map_resolution CHECK (resolution_m > 0)
);

-- 한 층에 활성 지도는 반드시 하나만. DB가 규칙을 강제한다.
CREATE UNIQUE INDEX uq_map_active_per_floor
    ON map (facility_id, floor) WHERE is_active;

-- 목적지 (사용자가 화면에서 고르는 것)
CREATE TABLE poi (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    map_id                 BIGINT NOT NULL REFERENCES map(id) ON DELETE CASCADE,
    code                   TEXT   NOT NULL,          -- 'RESTROOM_1F_A'
    name_ko                TEXT   NOT NULL,          -- '1층 화장실'
    name_short             TEXT,                     -- 터치 버튼용 '화장실'
    category               poi_category NOT NULL,
    geom                   geometry(Point, 0) NOT NULL,
    approach_yaw           DOUBLE PRECISION,         -- 도착 후 바라볼 방향(rad)
    voice_script           TEXT,                     -- ⑦ 음성 안내 문구
    voice_file_uri         TEXT,                     -- 미리 녹음/합성한 파일
    wheelchair_accessible  BOOLEAN NOT NULL DEFAULT true,
    is_selectable          BOOLEAN NOT NULL DEFAULT true,  -- 사용자 목록 노출 여부
    display_order          SMALLINT NOT NULL DEFAULT 0,
    is_active              BOOLEAN NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_poi_code UNIQUE (map_id, code)
);

CREATE INDEX ix_poi_geom     ON poi USING GIST (geom);
CREATE INDEX ix_poi_map_live ON poi (map_id, display_order) WHERE is_active AND is_selectable;

-- 진입금지 / 서행 구역
CREATE TABLE zone (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    map_id          BIGINT NOT NULL REFERENCES map(id) ON DELETE CASCADE,
    name            TEXT   NOT NULL,
    zone_type       zone_type NOT NULL,
    geom            geometry(Polygon, 0) NOT NULL,
    speed_limit_mps DOUBLE PRECISION,
    priority        SMALLINT NOT NULL DEFAULT 0,     -- 구역이 겹칠 때 우선순위
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- slow 구역은 속도 제한이 반드시 있어야 한다
    CONSTRAINT ck_zone_speed CHECK (
        zone_type <> 'slow' OR speed_limit_mps IS NOT NULL
    )
);

CREATE INDEX ix_zone_geom ON zone USING GIST (geom);

-- POI 간 연결 그래프 (베리어프리 경로 판정용)
CREATE TABLE route_edge (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    map_id           BIGINT NOT NULL REFERENCES map(id) ON DELETE CASCADE,
    from_poi_id      BIGINT NOT NULL REFERENCES poi(id) ON DELETE CASCADE,
    to_poi_id        BIGINT NOT NULL REFERENCES poi(id) ON DELETE CASCADE,
    distance_m       DOUBLE PRECISION NOT NULL,
    is_bidirectional BOOLEAN NOT NULL DEFAULT true,
    slope_pct        DOUBLE PRECISION NOT NULL DEFAULT 0,
    has_step         BOOLEAN NOT NULL DEFAULT false,
    min_width_m      DOUBLE PRECISION,               -- 휠체어 통과 가능 폭
    is_active        BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_route_edge UNIQUE (from_poi_id, to_poi_id),
    CONSTRAINT ck_route_self CHECK (from_poi_id <> to_poi_id),
    CONSTRAINT ck_route_distance CHECK (distance_m >= 0)
);

CREATE INDEX ix_route_edge_from ON route_edge (from_poi_id) WHERE is_active;

-- =====================================================================
-- B. 로봇 / 계정
-- =====================================================================

CREATE TABLE robot (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid             UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    serial           TEXT   NOT NULL UNIQUE,         -- 기체에 붙는 물리 시리얼
    name             TEXT   NOT NULL,                -- '토리'
    model            TEXT,                           -- 'jetson-orin-nano-4wd'
    current_map_id   BIGINT REFERENCES map(id) ON DELETE SET NULL,
    status           robot_status NOT NULL DEFAULT 'offline',
    battery_pct      SMALLINT,
    last_seen_at     TIMESTAMPTZ,
    firmware_version TEXT,
    note             TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    CONSTRAINT ck_robot_battery CHECK (battery_pct BETWEEN 0 AND 100)
);

-- 관리자·직원 계정만. 노인 이용자는 계정 없이 키오스크로 사용한다.
CREATE TABLE app_user (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           CITEXT NOT NULL UNIQUE,
    hashed_password TEXT   NOT NULL,
    display_name    TEXT   NOT NULL,
    role            user_role NOT NULL DEFAULT 'viewer',
    facility_id     BIGINT REFERENCES facility(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- C. 운행
-- =====================================================================

-- 안내 요청 1건
CREATE TABLE trip (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                UUID   NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    robot_id            BIGINT NOT NULL REFERENCES robot(id) ON DELETE RESTRICT,
    map_id              BIGINT NOT NULL REFERENCES map(id)   ON DELETE RESTRICT,
    mode                trip_mode   NOT NULL,
    status              trip_status NOT NULL DEFAULT 'requested',
    origin_poi_id       BIGINT REFERENCES poi(id) ON DELETE SET NULL,
    dest_poi_id         BIGINT REFERENCES poi(id) ON DELETE SET NULL,
    requested_by        trip_requester NOT NULL,
    requested_by_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
    is_simulated        BOOLEAN NOT NULL DEFAULT false,  -- 시뮬레이션팀 데이터 구분
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,
    planned_distance_m  DOUBLE PRECISION,
    actual_distance_m   DOUBLE PRECISION,
    abort_reason        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 안내 모드는 목적지가 반드시 있어야 한다
    CONSTRAINT ck_trip_dest CHECK (
        mode <> 'guide' OR dest_poi_id IS NOT NULL
    ),
    CONSTRAINT ck_trip_time CHECK (
        ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at
    )
);

CREATE INDEX ix_trip_robot_time ON trip (robot_id, requested_at DESC);
CREATE INDEX ix_trip_dest       ON trip (dest_poi_id, requested_at DESC);
CREATE INDEX ix_trip_live       ON trip (robot_id)
    WHERE status IN ('requested', 'navigating', 'paused');

-- 한 로봇이 동시에 두 개의 진행중 trip을 가질 수 없다
CREATE UNIQUE INDEX uq_trip_one_active_per_robot
    ON trip (robot_id) WHERE status IN ('requested', 'navigating', 'paused');

-- trip 진행 중 발생한 사건
CREATE TABLE trip_event (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id    BIGINT NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
    ts         TIMESTAMPTZ NOT NULL,
    event_type trip_event_type NOT NULL,
    severity   SMALLINT NOT NULL DEFAULT 0,      -- 0 info / 1 warn / 2 error
    geom       geometry(Point, 0),               -- 어디서 일어났는지 (히트맵용)
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_event_severity CHECK (severity BETWEEN 0 AND 2)
);

CREATE INDEX ix_event_trip  ON trip_event (trip_id, ts);
CREATE INDEX ix_event_type  ON trip_event (event_type, ts DESC);
CREATE INDEX ix_event_geom  ON trip_event USING GIST (geom);

-- ---------------------------------------------------------------------
-- updated_at 트리거 부착
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['facility','map','poi','zone','route_edge',
                             'robot','app_user','trip']
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 편의 뷰: 사용자 화면에 띄울 목적지 목록
-- ---------------------------------------------------------------------
CREATE VIEW v_selectable_poi AS
SELECT p.id, p.map_id, m.facility_id, m.floor,
       p.code, p.name_ko, COALESCE(p.name_short, p.name_ko) AS label,
       p.category, p.wheelchair_accessible, p.display_order,
       ST_X(p.geom) AS x, ST_Y(p.geom) AS y
FROM poi p
JOIN map m ON m.id = p.map_id
WHERE p.is_active AND p.is_selectable AND m.is_active
ORDER BY m.floor, p.display_order, p.name_ko;
```

### 4.1 설계 결정과 근거 (왜 이렇게 짰는지)

| 결정 | 근거 |
|---|---|
| `map`이 **버전** 테이블 | SLAM을 다시 돌리면 원점과 좌표계가 바뀐다. 지도를 덮어쓰면 기존 POI 좌표가 전부 무효가 되는데, 그 사실을 아무도 모른 채 로봇이 엉뚱한 데로 간다. 새 지도 = 새 레코드 |
| `uq_map_active_per_floor` (부분 유니크 인덱스) | "한 층에 활성 지도는 하나"를 애플리케이션 코드가 아니라 **DB가 강제**한다. 코드는 실수하지만 제약조건은 안 한다 |
| `poi.is_selectable` | 충전 스테이션은 좌표가 필요하지만 사용자 화면 목적지 목록에는 뜨면 안 된다. `is_active`(존재 여부)와 노출 여부는 다른 개념 |
| `poi.approach_yaw` | 좌표만으로는 부족하다. 화장실 문 앞에 도착했는데 벽을 보고 서 있으면 안내가 안 된다 |
| `poi.name_short` | 7인치 터치스크린 + 노인 대상이면 버튼 글자가 짧고 커야 한다. `'1층 화장실'`이 아니라 `'화장실'` |
| `poi.voice_script` + `voice_file_uri` 둘 다 | ⑦ 음성을 실시간 TTS로 할지 미리 만든 파일로 할지 미결정이라, 양쪽 다 담아두고 나중에 하나만 쓴다 |
| `route_edge.min_width_m`, `has_step`, `slope_pct` | **이 프로젝트의 정체성이 여기 있다.** 베리어프리 = 휠체어가 지나갈 수 있는 경로만 안내하는 것. 이 세 컬럼이 없으면 그냥 평범한 안내 로봇이다 |
| `zone` CHECK (slow면 speed_limit 필수) | 서행 구역인데 속도 제한이 NULL이면 로봇이 그냥 통과한다. 데이터가 절반만 들어오는 걸 DB가 막는다 |
| `trip.is_simulated` | 시뮬레이션팀 결과를 같은 테이블에 넣고 플래그로 구분. 나중에 "시뮬 대비 실주행 성공률"을 SQL 한 줄로 뽑는다 |
| `uq_trip_one_active_per_robot` | 한 로봇에 진행중 trip이 두 개 생기면 로봇이 두 곳으로 가려고 한다. 대시보드에서 중복 요청을 눌러도 DB가 막는다 |
| `trip_event.geom` | "어느 지점에서 자꾸 막히나"를 좌표로 집계할 수 있다. ⑨ 노인 사용성 개선의 근거 데이터가 여기서 나온다 |
| `trip.origin_poi_id` nullable | 출발지를 모를 수 있다(로봇이 복도 한가운데 있을 때). 목적지는 guide 모드에서만 CHECK로 강제 |
| `app_user`에 이용자 계정 없음 | 노인에게 회원가입을 시키지 않는다. 로봇 화면은 키오스크(로그인 없음), 웹은 직원용 |

---

## 5. 개발용 시드 데이터

`schema/seed_dev.sql`로 저장할 것. **복지관 실명이 없어도 프론트 개발을 시작할 수 있게 하는 게 목적이다.**

```sql
-- 개발용 가짜 시드 데이터 (복지관 실명 확정 전까지 사용)
BEGIN;

INSERT INTO facility (code, name, address, floor_count)
VALUES ('demo-welfare', '데모 노인복지관', '미정', 3);

INSERT INTO map (facility_id, floor, version, name, pgm_uri, yaml_uri,
                 resolution_m, origin_x, origin_y, width_px, height_px, is_active)
SELECT id, 1, 1, '1층 데모 지도', 's3://maps/demo/1f_v1.pgm', 's3://maps/demo/1f_v1.yaml',
       0.05, -10.0, -10.0, 800, 600, true
FROM facility WHERE code = 'demo-welfare';

INSERT INTO poi (map_id, code, name_ko, name_short, category, geom,
                 approach_yaw, voice_script, wheelchair_accessible,
                 is_selectable, display_order)
SELECT m.id, v.code, v.name_ko, v.name_short, v.category::poi_category,
       ST_SetSRID(ST_MakePoint(v.x, v.y), 0),
       v.yaw, v.voice, v.wc, v.sel, v.ord
FROM map m, (VALUES
    ('ENTRANCE_1F',  '정문 출입구',   '출입구',   'entrance',         2.0,  0.5,  1.57, '정문에 도착했습니다.',            true,  true,  1),
    ('LOBBY_1F',     '1층 로비',      '로비',     'lobby',            5.0,  3.0,  0.0,  '로비에 도착했습니다.',            true,  true,  2),
    ('RESTROOM_1F',  '1층 화장실',    '화장실',   'restroom',        12.0,  4.0,  3.14, '화장실 앞에 도착했습니다.',       true,  true,  3),
    ('THERAPY_1F',   '물리치료실',    '물리치료', 'therapy_room',    18.0,  7.5,  0.0,  '물리치료실에 도착했습니다.',      true,  true,  4),
    ('PROGRAM_1F',   '프로그램실',    '프로그램', 'program_room',    22.0,  2.0,  1.57, '프로그램실에 도착했습니다.',      true,  true,  5),
    ('ELEV_1F',      '1층 엘리베이터','엘리베이터','elevator',       15.0, -2.0,  3.14, '엘리베이터 앞에 도착했습니다.',   true,  true,  6),
    ('STAIRS_1F',    '1층 계단',      '계단',     'stairs',          16.5, -4.0,  3.14, NULL,                              false, true,  7),
    ('CHARGE_1F',    '충전 스테이션', NULL,       'charging_station', 0.5, -1.0,  0.0,  NULL,                              true,  false, 99)
) AS v(code, name_ko, name_short, category, x, y, yaw, voice, wc, sel, ord)
WHERE m.is_active AND m.floor = 1;

-- 진입금지 / 서행 구역
INSERT INTO zone (map_id, name, zone_type, geom, speed_limit_mps)
SELECT m.id, '계단 진입금지', 'keepout',
       ST_SetSRID(ST_GeomFromText('POLYGON((15 -5, 18 -5, 18 -3, 15 -3, 15 -5))'), 0), NULL
FROM map m WHERE m.is_active;

INSERT INTO zone (map_id, name, zone_type, geom, speed_limit_mps)
SELECT m.id, '로비 혼잡구역 서행', 'slow',
       ST_SetSRID(ST_GeomFromText('POLYGON((3 1, 8 1, 8 5, 3 5, 3 1))'), 0), 0.3
FROM map m WHERE m.is_active;

-- 경로 그래프 (로비 기준 방사형)
INSERT INTO route_edge (map_id, from_poi_id, to_poi_id, distance_m, slope_pct, has_step, min_width_m)
SELECT p1.map_id, p1.id, p2.id,
       ST_Distance(p1.geom, p2.geom),
       0,
       (p2.code = 'STAIRS_1F'),
       CASE WHEN p2.code = 'ELEV_1F' THEN 0.9 ELSE 1.4 END
FROM poi p1
JOIN poi p2 ON p2.map_id = p1.map_id AND p2.id <> p1.id
WHERE p1.code = 'LOBBY_1F';

INSERT INTO robot (serial, name, model, current_map_id, status, battery_pct, last_seen_at)
SELECT 'SBR-0001', '토리', 'jetson-orin-nano-4wd', m.id, 'idle', 87, now()
FROM map m WHERE m.is_active;

INSERT INTO app_user (email, hashed_password, display_name, role, facility_id)
SELECT 'admin@example.com', '$2b$12$devplaceholderhashvalue000000000000000000000000000000',
       '관리자', 'admin', id
FROM facility WHERE code = 'demo-welfare';

-- 샘플 trip 1건 (완료 상태)
INSERT INTO trip (robot_id, map_id, mode, status, origin_poi_id, dest_poi_id,
                  requested_by, requested_at, started_at, ended_at,
                  planned_distance_m, actual_distance_m)
SELECT r.id, r.current_map_id, 'guide', 'completed',
       o.id, d.id, 'kiosk',
       now() - interval '30 min', now() - interval '29 min', now() - interval '27 min',
       9.6, 10.4
FROM robot r
JOIN poi o ON o.code = 'LOBBY_1F'    AND o.map_id = r.current_map_id
JOIN poi d ON d.code = 'RESTROOM_1F' AND d.map_id = r.current_map_id
WHERE r.serial = 'SBR-0001';

INSERT INTO trip_event (trip_id, ts, event_type, severity, geom, payload)
SELECT t.id, t.started_at + interval '40 sec', 'obstacle_detected', 1,
       ST_SetSRID(ST_MakePoint(8.5, 3.5), 0),
       '{"class": "person", "distance_m": 1.2}'::jsonb
FROM trip t ORDER BY t.id DESC LIMIT 1;

INSERT INTO trip_event (trip_id, ts, event_type, severity, geom, payload)
SELECT t.id, t.ended_at, 'arrived', 0,
       ST_SetSRID(ST_MakePoint(12.0, 4.0), 0), '{}'::jsonb
FROM trip t ORDER BY t.id DESC LIMIT 1;

COMMIT;
```

---

## 6. 검증 결과 (실제 실행함)

### 6.1 제약조건이 잘못된 데이터를 막는지

| # | 시도한 잘못된 입력 | 결과 |
|---|---|---|
| 1 | 같은 층에 활성 지도 2개 | ✅ 차단 — `uq_map_active_per_floor` |
| 2 | slow 구역인데 속도제한 NULL | ✅ 차단 — `ck_zone_speed` |
| 3 | guide 모드인데 목적지 없음 | ✅ 차단 — `ck_trip_dest` |
| 4 | 한 로봇에 진행중 trip 2개 | ✅ 차단 — `uq_trip_one_active_per_robot` |
| 5 | 배터리 120% | ✅ 차단 — `ck_robot_battery` |
| 6 | follow 모드 + 목적지 없음 | ✅ **통과** (의도대로 허용) |

### 6.2 실제로 뽑아본 쿼리

**사용자 화면 목적지 목록** (`v_selectable_poi`) — 충전 스테이션이 자동으로 빠졌다:

```
 floor |   label    |   category   | wc |  x   |  y
-------+------------+--------------+----+------+-----
     1 | 출입구     | entrance     | t  |    2 | 0.5
     1 | 로비       | lobby        | t  |    5 |   3
     1 | 화장실     | restroom     | t  |   12 |   4
     1 | 물리치료   | therapy_room | t  |   18 | 7.5
     1 | 프로그램   | program_room | t  |   22 |   2
     1 | 엘리베이터 | elevator     | t  |   15 |  -2
     1 | 계단       | stairs       | f  | 16.5 |  -4
```

**로봇이 (5,3)에 있을 때 적용받는 구역** — PostGIS `ST_Contains`가 정상 판정:

```
        구역        | 종류 | 제한속도
--------------------+------+----------
 로비 혼잡구역 서행 | slow |      0.3
```

**휠체어 통행 가능 경로만 필터링:**

```sql
SELECT o.name_ko, d.name_ko, e.distance_m
FROM route_edge e
JOIN poi o ON o.id = e.from_poi_id
JOIN poi d ON d.id = e.to_poi_id
WHERE e.is_active AND NOT e.has_step
  AND e.min_width_m >= 1.2 AND d.wheelchair_accessible;
```

> ⚠️ 이 쿼리에서 **엘리베이터가 결과에 안 나온다.** 시드에 넣은 엘리베이터 폭 0.9m가 기준(1.2m)에 미달해서다. 값은 내가 임의로 넣은 것이지만, 이게 정확히 이 설계가 하려는 일이다 — **실측값을 넣는 순간 "휠체어로 2층에 못 간다"가 즉시 드러난다.** 기관 실측 때 통로·엘리베이터 폭을 반드시 재올 것.

---

## 7. Claude Code 작업 지시

이 순서대로 진행할 것.

### Step 1 — 프로젝트 뼈대

```
robot-web/
├─ docker-compose.yml        # postgis/postgis:16-3.4, minio, api
├─ .env.example
├─ schema/
│  ├─ 001_phase1.sql         # §4 그대로
│  └─ seed_dev.sql           # §5 그대로
├─ app/
│  ├─ main.py                # FastAPI
│  ├─ db.py                  # SQLAlchemy 2.0 engine/session
│  ├─ models/                # ORM 모델
│  ├─ schemas/               # Pydantic
│  └─ api/                   # 라우터
├─ alembic/
└─ README.md
```

### Step 2 — docker-compose 먼저

`docker compose up` 한 줄로 팀원 누구나 DB가 뜨게 만든다. **이게 되기 전에는 아무것도 하지 않는다.** 이미지는 `postgis/postgis:16-3.4`를 쓸 것 (순정 `postgres` 이미지에는 PostGIS가 없다).

### Step 3 — SQLAlchemy 2.0 모델

- `Mapped[...]` / `mapped_column()` 스타일 (1.x의 `Column()` 방식 쓰지 말 것)
- PostGIS 컬럼은 `geoalchemy2.Geometry('POINT', srid=0)`
- ENUM은 `sqlalchemy.Enum(..., name='poi_category', create_type=False)` — DDL이 이미 타입을 만들었으므로 중복 생성하지 않게 할 것

### Step 4 — Alembic

`alembic revision --autogenerate`로 초기 마이그레이션을 만든 뒤, **생성된 파일이 §4 DDL과 일치하는지 사람이 직접 확인한다.** autogenerate는 부분 유니크 인덱스(`WHERE is_active`)와 CHECK 제약을 자주 놓친다. 놓쳤으면 `op.execute()`로 직접 넣을 것.

### Step 5 — API 최소 세트

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/maps/{id}/pois` | 사용자 UI 목적지 목록 (`v_selectable_poi` 사용) |
| GET | `/maps/{id}/bundle` | 로봇 오프라인 캐시용 일괄 다운로드 (지도+POI+zone+edge) |
| POST | `/trips` | 안내 요청 생성 |
| PATCH | `/trips/{id}` | 상태 변경 |
| POST | `/trips/{id}/events` | 로봇이 이벤트 보고 |
| GET | `/robots` | 대시보드 로봇 목록 |
| CRUD | `/pois`, `/zones` | 관리자 편집 |

`/maps/{id}/bundle`을 우선 구현할 것 — 로봇이 네트워크 없이 동작하려면 이게 필요하다.

### Step 6 — 테스트

`pytest` + `testcontainers` 또는 별도 테스트 DB. **§6.1의 6가지 제약조건 테스트를 그대로 테스트 코드로 옮길 것.** 스키마를 고칠 때 이게 안전망이 된다.

---

## 8. 하지 말 것

- ❌ 이미지·rosbag을 `bytea`로 DB에 넣기 → 파일은 MinIO, DB엔 경로+sha256만
- ❌ 좌표를 위경도(EPSG:4326)로 저장 → 실내 미터 좌표(SRID 0)
- ❌ 시각을 KST로 저장 → UTC로 저장하고 화면에서 변환
- ❌ POI를 물리 삭제 → `is_active = false`
- ❌ 지도를 덮어쓰기 → 새 `map` 레코드 + `is_active` 전환
- ❌ `psql`에서 직접 `ALTER TABLE` → Alembic 마이그레이션
- ❌ 2차/3차 테이블(`data_file`, `pose_log` 등)을 지금 추측해서 만들기 → 다른 팀 답변 대기

---

## 9. 이 스키마가 바뀔 수 있는 지점

값이 아니라 **구조**가 바뀔 수 있는 곳. 미리 알고 있으면 마이그레이션이 덜 아프다.

1. **층간 이동** — 지금은 `route_edge`가 같은 `map`(=같은 층) 안에서만 연결된다. 엘리베이터로 층을 넘나들려면 `map`을 가로지르는 엣지가 필요하다. 로봇이 실제로 엘리베이터를 탈 계획인지 확인 후 결정.
2. **로봇 다중화** — 지금 구조는 로봇 N대를 이미 지원한다. 다만 "여러 로봇 중 누구에게 배차할지" 로직은 없다. 1대로 끝날 거면 신경 쓸 필요 없음.
3. **`trip`에 경유지** — 지금은 출발/도착 2점뿐. 중간 경유가 필요해지면 `trip_waypoint` 테이블 추가.
4. **예약 기능** — "3시에 물리치료실로 데려다줘"가 요구사항에 들어오면 `trip.scheduled_at` 추가.
