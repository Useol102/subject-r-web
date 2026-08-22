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
