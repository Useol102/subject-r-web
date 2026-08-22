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

-- 관리자 계정은 시드로 만들지 않는다.
-- 가짜 해시가 든 admin 계정이 모든 설치에 남는 것은 위험하다.
-- 첫 관리자는 아래 명령으로 만든다:
--     .\.venv\Scripts\python.exe tools\create_admin.py

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
