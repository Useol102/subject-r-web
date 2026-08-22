# API 서버 실행

## 처음 한 번

```powershell
.\setup-python-env.ps1      # .venv 생성 + 패키지 설치 (conda 불필요)
.\fix-env.ps1               # .env 생성 + SECRET_KEY 발급 + DB 비밀번호 확인
.\.venv\Scripts\Activate.ps1
```

> conda를 쓰지 않는 이유: Anaconda는 PowerShell 연동에 `conda init`이 따로 필요하고,
> 안 하면 Anaconda Prompt 창을 따로 열어야 한다. 우리 스크립트는 전부 PowerShell용이라
> 창을 오가는 게 번거롭다. `.venv`는 폴더 하나로 끝나고, 지울 때도 폴더만 지우면 된다.

Alembic 기준점을 찍는다 (`init-db.ps1`로 DB를 만든 직후 한 번만):

```powershell
alembic stamp head
```

## 실행

```powershell
uvicorn app.main:app --reload
```

가상환경 활성화가 막히면 활성화 없이 직접 호출해도 된다:

```powershell
.\.venv\Scripts\uvicorn.exe app.main:app --reload
```

- API 문서: http://localhost:8000/docs ← **AI팀·시뮬레이션팀은 여기만 보면 된다**
- 상태 확인: http://localhost:8000/health

## 문제가 생기면 — 먼저 이것부터

```powershell
.\.venv\Scripts\python.exe tools\preflight.py
```

Python 버전 / 패키지 / .env / DB 접속 / PostGIS / 테이블 수 / 시드 / 좌표계 / Alembic 을
한 번에 확인하고, 실패한 항목마다 무엇을 해야 하는지 알려준다.
에러가 하나씩 터지길 기다리지 말고 이걸 먼저 돌릴 것.

파일을 고친 뒤에는 인코딩 검사도 돌린다:

```powershell
.\.venv\Scripts\python.exe tools\check_encoding.py
```

한국어 Windows(CP949)에서만 터지는 지뢰를 잡는다:
- `.ini` 파일의 한글 - Alembic이 로캘 인코딩으로 읽어서 죽는다
- `.ps1` 파일의 BOM 누락 - PowerShell이 한글을 깨뜨린다
- `psql -c` 인자에 들어간 한글 - UTF8/CP949 불일치

## 엔드포인트

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/health` | DB + PostGIS 살아있는지 |
| GET | `/maps` | 지도 버전 목록 |
| GET | `/maps/{id}` | 지도 하나 |
| GET | `/maps/{id}/pois` | **사용자 UI 목적지 목록** (충전소 등 제외) |
| GET | `/maps/{id}/pois?all_pois=true` | 관리자용 전체 목록 |
| GET | `/maps/{id}/bundle` | **로봇 오프라인 캐시** (지도+POI+구역+경로) |
| GET | `/robots`, `/robots/{id}` | 로봇 목록/상세 |
| GET/POST | `/trips` | 안내 요청 조회/생성 |
| PATCH | `/trips/{id}` | 상태 변경 (started_at/ended_at 자동 기록) |
| POST/GET | `/trips/{id}/events` | 로봇이 사건 보고 / 조회 |

### 확인해볼 것

```powershell
curl http://localhost:8000/health
curl http://localhost:8000/maps/1/pois
curl http://localhost:8000/maps/1/bundle
```

## 스키마를 바꿀 때

**`psql`에서 직접 `ALTER TABLE` 하지 말 것.**

```powershell
# 1. app/models.py 수정
# 2. 마이그레이션 생성
alembic revision --autogenerate -m "무엇을 바꿨는지"
# 3. 생성된 파일을 눈으로 확인 (중요)
# 4. 적용
alembic upgrade head
```

### alembic.ini는 반드시 ASCII만

Alembic은 `alembic.ini`를 **시스템 로캘 인코딩**(한국어 Windows에서는 CP949)으로 읽는다.
여기에 한글 주석을 UTF-8로 넣으면 `configparser.ParsingError`로 alembic이 통째로 죽는다.

- `alembic.ini` → 영어 주석만
- `.py` 파일 → 한글 주석 OK (Python은 소스를 UTF-8로 읽는다)

`alembic/env.py`에 두 가지 장치를 넣어놨다:

- PostGIS 내부 테이블(`spatial_ref_sys` 등)을 autogenerate에서 제외 — 안 하면 DROP하려 든다
- geometry 컬럼끼리는 타입 비교를 건너뜀 — srid 때문에 매번 가짜 diff가 생긴다

현재 `app/models.py`는 실제 DB와 **완전히 일치**한다.
`alembic revision --autogenerate`를 돌리면 **빈 마이그레이션**이 나오는 게 정상이다.
뭔가 나온다면 모델이나 DB 중 하나가 어긋난 것이니 그 내용을 먼저 확인할 것.
