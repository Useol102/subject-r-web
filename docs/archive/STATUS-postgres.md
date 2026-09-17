# STATUS — 어디까지 했나

마지막 갱신: 2026-09-17
직전 작업 PC: `F:\Subject R` (AI2-13) · 현재 PC: `C:\Users\AI2-19\Desktop\Subject-R`

---

## 1. 개발 순서상 현재 위치

팀원 권가은이 제안한 순서를 따르고 있다.

```
요구분석 → 화면흐름 → 기능목록 → 데이터정의 → ERD → API → 구현
  ✅        ✅         ✅         ✅        ✅    ✅    🔄 절반
```

| 단계 | 산출물 | 상태 |
|---|---|---|
| 요구분석 | `docs/REQUIREMENTS.md` | ✅ |
| 화면 흐름 | `docs/SCREEN-FLOW.md` | ✅ |
| 기능 목록 | `docs/FEATURES.md` | ✅ |
| 데이터 정의 | `docs/DB-PHASE1.md` | ✅ |
| ERD | `docs/ERD.md` + `.png` `.svg` `.mmd` `.dbml` | ✅ |
| API | `app/routers/` + `/docs` 자동 생성 | ✅ |
| 구현 | 아래 §3 | 🔄 |

---

## 2. DB 현황

**테이블 9개** (1차 범위):

```
facility  map  poi  zone  route_edge  robot  trip  trip_event  app_user
```

**마이그레이션 3개:**

| 파일 | 내용 |
|---|---|
| `0001_phase1_baseline.py` | 위 9개 테이블 전체 + 제약조건 |
| `0002_robot_api_key.py` | `robot.api_key_hash` (SHA-256), `uq_robot_api_key_hash` |
| `0003_robot_last_pose.py` | `robot.last_geom` (POINT, srid=0), `robot.last_heading_rad` |

**아직 안 만든 것** (2차 — AI팀 답변 대기):
`pose_log` `detection_log` `data_file` `label_class` `annotation`
`dataset` `dataset_item` `model_run` `feedback`

### `0003` 의 설계 의도 — 이건 꼭 알고 있을 것

로봇 위치를 두 가지로 쪼갰다.

| | 저장 위치 | 필요한 것 | 쓰는 곳 |
|---|---|---|---|
| **최신 1건** | `robot.last_geom` | 보고 주기 몰라도 됨 | 대시보드 현재 위치, 사용자-진행상황 |
| **시계열** | `pose_log` (미구현) | Hz 확정 필요 | 이동 궤적, 히트맵 원본 |

이렇게 나눈 덕분에 **시뮬레이션팀이 보고 주기(Hz)를 안 알려줘도**
"로봇이 지금 어디 있나" 기능을 완성할 수 있었다. 이게 막혀 있던 걸 푼 핵심이다.
`pose_log` 를 만들 때 `robot.last_geom` 을 지우지 말 것 — 역할이 다르다.

---

## 3. 기능 구현 현황

`docs/FEATURES.md` 기준. 우선순위 순으로 진행했다.

### ✅ 완료

| 기능 | 주요 엔드포인트 |
|---|---|
| 직원-목적지편집 | `GET/POST/PATCH/DELETE /pois` |
| 시스템-로그인 | `POST /auth/login` (JSON), `POST /auth/token` (폼) |
| 시스템-권한관리 | `GET/POST/DELETE /users` + `require_role()` |
| 로봇-인증 | `X-Robot-Key` 헤더, `POST /robots/{id}/api-key` |
| 로봇-상태보고 | `POST /robots/{id}/pose` |
| 사용자-진행상황 | `GET /trips/{id}` |
| 직원-통계 | `/stats/summary` `/by-destination` `/daily` `/events` `/hourly` |
| 직원-히트맵 | `/stats/hotspots` |

### ⬜ 남은 것

| 기능 | 난이도 | 비고 |
|---|---|---|
| 직원-구역편집 | 중 | `zone` 폴리곤 CRUD. POI 편집과 구조가 같아서 참고 가능 |
| 직원-지도관리 | 중 | 지도 버전 업로드/활성화. 부분 유니크 인덱스 주의 |
| 로봇-로그동기화 | 상 | 로봇 SQLite 큐 → 배치 업로드. `pose_log` 가 먼저 필요 |
| 시스템-백업 | 하 | `pg_dump` 래퍼 |

### ⛔ 없는 것 — 가장 큰 약점

**테스트 코드가 0줄이다.** `pytest` 와 `httpx` 는 `requirements.txt` 에 있는데
쓰고 있지 않다. 새로 작업을 시작한다면 여기부터 손대는 게 제일 값이 크다.

추천 순서: `tests/test_auth.py` → `tests/test_pois.py` → `tests/test_stats.py`

---

## 4. 잃어버렸을 수 있는 코드

2026-09-01 기준으로 `F:\Subject R` 에 **커밋 안 된 변경사항**이 있었다.
GitHub 에서 clone 했다면 아래가 빠져 있을 수 있다.

```
RUN-API.md  app/config.py  app/deps.py  app/main.py  app/routers/auth.py
app/routers/trips.py  app/schemas.py  docs/FEATURES.md  fix-env.ps1
init-db.ps1  reset-pgpassword.ps1  tools/preflight.py
```

### 확인법

```powershell
Select-String -Path app\deps.py -Pattern "tokenUrl"
```

`/auth/token` 이 나오면 최신이다. `/auth/login` 이 나오면 아래를 적용할 것.

### 복구용 코드 ①  `app/deps.py`

```python
# tokenUrl 은 **OAuth2 폼 규격**을 받는 엔드포인트여야 한다.
# /auth/login 은 프론트가 쓰는 JSON 엔드포인트라 규격이 다르다.
# Swagger 의 Authorize 창은 이 주소로 username/password 를 폼으로 보낸다.
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)
```

### 복구용 코드 ②  `app/routers/auth.py`

import 에 한 줄 추가:

```python
from fastapi.security import OAuth2PasswordRequestForm
```

그리고 `@router.get("/me", ...)` **앞에** 아래를 삽입:

```python
@router.post("/token", response_model=schemas.TokenOut,
             summary="OAuth2 폼 로그인 (Swagger Authorize 전용)")
def login_form(form: OAuth2PasswordRequestForm = Depends(),
               db: Session = Depends(get_db)):
    """`/auth/login` 과 같은 일을 하되 **OAuth2 폼 규격**으로 받는다.

    두 개를 둔 이유:
    - `/auth/login` — 프론트(web/admin)가 쓰는 JSON 엔드포인트
    - `/auth/token` — Swagger `/docs` 의 Authorize 창이 쓰는 폼 엔드포인트

    OAuth2 규격이 필드 이름을 `username` 으로 정해놔서, 여기서는
    이메일을 `username` 칸에 넣는다.
    """
    return login(schemas.LoginRequest(email=form.username,
                                      password=form.password), db)
```

**검증 결과 (마이그레이션 완료된 DB 기준):**

```
POST /auth/token   200      POST /auth/login   200
GET  /auth/me      200      GET  /robots       200
틀린 비번          401      토큰 없이 /auth/me  401
```

---

## 5. 팀 간 대기 중인 답변

| 물어본 곳 | 물어본 것 | 이게 없으면 막히는 것 |
|---|---|---|
| AI팀 | 학습 이미지 총량(GB) | 서버 기기 선정, 저장소 용량 |
| AI팀 | 라벨 클래스 목록 확정 | `label_class` 시드 |
| 시뮬레이션팀 | 로봇 상태 보고 주기(Hz) | `pose_log` 파티션 크기 |
| 기관 컨택 | 복지관 실제 장소명/층 | `poi` 실데이터 (지금은 가짜 시드) |

**지금 이 답변들이 없어도 구현은 계속 가능하다.**
구조를 먼저 짜고 값은 나중에 넣는 방식으로 설계했다.

---

## 6. 팀원 분담 제안

권가은이 `web/admin` 화면 쪽을 맡으면 잘 맞는다.
백엔드 API 는 `/docs` 에 전부 떠 있어서, 화면만 붙이면 되는 상태다.
