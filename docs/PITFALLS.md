# PITFALLS — 이미 밟은 지뢰 목록

> 전부 실제로 당한 것들이다. 증상이 원인과 안 닮은 것들만 골라 적었다.
> 새 에이전트가 이 문서를 안 읽으면 같은 걸 처음부터 다시 디버깅하게 된다.
>
> **현재(SQLite 웹) 기준으로 유효한 것:** A-1(`.ini` ASCII — `web-alembic.ini` 포함), A-3, A-5, B 전체, E 의 PATH 항목.
> psql·PostGIS·JWT·통계 쿼리 항목(A-2, A-4, C, D)은 `docs/archive/` 의 옛 PostgreSQL 코드(`app/`) 기준이다.
> 현재 웹에서 Alembic 을 쓸 때는 `.\.venv\Scripts\python.exe -m alembic -c web-alembic.ini ...` 로 실행한다.

---

## A. 한글 윈도우 인코딩 — 제일 악질

윈도우 한국어판은 콘솔 코드페이지가 **CP949** 다. 프로그램이 UTF-8 을
기대하는 자리에 CP949 가 들어가면, 에러 메시지가 원인과 전혀 안 닮는다.

### A-1. `alembic.ini` 에 한글 주석을 쓰면 안 된다

**증상**

```
configparser.ParsingError: Source contains parsing errors
```

**원인**
Alembic 이 이 파일을 `encoding="locale"` 로 읽는다. 한국어 윈도우에서
locale = CP949 라서, UTF-8 로 저장된 한글이 깨져서 파싱이 터진다.

**규칙**
`alembic.ini` 는 **순수 ASCII 로만 쓴다.** 주석도 영어로.
(다른 `.py` `.md` `.ps1` 은 한글 써도 된다.)

### A-2. `psql -c` 인자에 한글을 넣으면 안 된다

**증상**

```
ERROR: invalid byte sequence for encoding "UTF8": 0xc1 0xa2
```

**원인**
`PGCLIENTENCODING=UTF8` 로 설정해도, PowerShell 이 인자를 CP949 로 넘긴다.
컬럼 별칭(`AS 목적지`) 하나 때문에 터진다.

**규칙**
`psql -c "..."` 안은 **ASCII 만.** 한글이 필요하면 `.sql` 파일로 저장해서
`psql -f` 로 실행한다 (파일은 UTF-8 로 읽힌다).

### A-3. `.ps1` 은 BOM 있는 UTF-8 로 저장

PowerShell 5.1 은 BOM 이 없으면 UTF-8 파일을 CP949 로 읽는다.
한글이 든 `.ps1` 은 **UTF-8 with BOM**.

### A-4. PostgreSQL 의 NOTICE 가 빨간 치명적 오류로 보인다

**증상**
`DROP DATABASE IF EXISTS` 같은 정상 동작인데 PowerShell 창이 빨개진다.

**원인**
`$ErrorActionPreference = 'Stop'` 상태에서 PowerShell 5.1 이 psql 의
stderr NOTICE 를 오류로 취급한다.

**해결** — `.ps1` 세 개에 이미 넣어놨다.

```powershell
$env:PGOPTIONS = "-c client_min_messages=WARNING"
$ErrorActionPreference = 'Continue'   # psql 호출 구간에서만
```

### A-5. 자동 검사기가 있다

이 부류를 사람이 매번 기억할 수 없어서 검사 스크립트를 만들어놨다.

```powershell
.\.venv\Scripts\python.exe tools\check_encoding.py
```

**새 파일을 추가하면 이걸 한 번 돌릴 것.**

---

## B. Alembic

### B-1. autogenerate 가 모든 제약조건을 DROP 하려 든다

**원인**
`models.py` 에 `__table_args__` 로 CHECK·부분 인덱스를 선언 안 했는데
DB 에는 있으니까, Alembic 이 "모델에 없네 = 지워야지" 로 판단한다.

**규칙**
**DB 에 있는 제약조건은 전부 `models.py` 에도 선언한다.**
정상 상태에서 `--autogenerate` 가 **빈 diff** 를 내는지가 건강 지표다.

### B-2. 제약조건 이름이 `None` 으로 생성된다

```python
op.create_unique_constraint(None, 'robot', ['api_key_hash'])   # ← 이러면 안 됨
op.create_unique_constraint('uq_robot_api_key_hash', 'robot', ['api_key_hash'])
```

이름이 없으면 `downgrade()` 에서 지울 수가 없다. 손으로 이름 붙일 것.

### B-3. 마이그레이션 파일을 `ls -t | head -1` 로 지우지 말 것

autogenerate 가 조용히 실패했을 때 "방금 만든 파일 지우기"를 하다가
**기준 마이그레이션(`0001_phase1_baseline.py`)을 날린 적이 있다.**
파일명을 눈으로 확인하고 지운다.

---

## C. 인증

### C-1. `tokenUrl` 은 실제로 존재하는 폼 엔드포인트여야 한다

**증상** — Swagger 의 Authorize 창에 뭘 넣어도 로그인이 안 된다.

**원인** — `OAuth2PasswordBearer(tokenUrl="/auth/login")` 인데
`/auth/login` 은 **JSON** 을 받는다. Swagger 는 **폼** 을 보낸다. 영원히 안 맞는다.

**해결** — `/auth/token` 을 따로 만들어 `OAuth2PasswordRequestForm` 으로 받고,
내부에서 기존 `login()` 에 위임한다. 코드는 `STATUS.md` §4 에 있다.

> Swagger 에서 로그인할 때 **`username` 칸에 이메일**을 넣는다.
> OAuth2 규격이 필드 이름을 `username` 으로 고정해놨기 때문이다.

### C-2. passlib 을 쓰지 말 것

passlib 은 bcrypt 4.x 이상에서 버전 탐지가 깨진다. **bcrypt 를 직접 호출한다.**

### C-3. 로봇 키는 bcrypt 가 아니라 SHA-256

bcrypt 는 salt 가 매번 달라서 해시로 조회가 안 된다. 전체 로봇을 순회해야 한다.
로봇은 1Hz 로 보고하므로 속도 문제도 있다. SHA-256 은 결정적이라 인덱스가 먹는다.

### C-4. 시드에 가짜 해시를 넣지 말 것

`002_seed_dev.sql` 에 `admin@example.com` 을 가짜 bcrypt 문자열로 넣어뒀던 적이
있다. **보안 문제다.** 지금은 제거했고, `preflight.py` 가 남아 있으면 경고한다.

```powershell
.\.venv\Scripts\python.exe tools\preflight.py --fix
```

관리자 계정은 `tools\create_admin.py` 로 만든다.

---

## D. 통계 / 공간 쿼리

### D-1. 히트맵에 `ST_SnapToGrid` 를 쓰면 안 된다

`ST_SnapToGrid` 는 **반올림**이라 같은 덩어리가 셀 경계에서 쪼개진다.
(8.1 과 8.6 이 다른 셀로 갔다.)

```sql
-- 이렇게
floor(ST_X(geom) / :cell) * :cell
```

### D-2. enum 의 `array_agg` 가 문자열로 돌아온다

Python 쪽에서 한 글자씩 순회되는 버그가 났다.

```python
func.array_agg(cast(models.TripEvent.event_type, Text))
```

### D-3. 통계는 KST 로 그룹핑

저장은 UTC 인데 집계를 UTC 로 하면 "오늘 이용자 수"가 9시간 밀린다.

```sql
date_trunc('day', ts AT TIME ZONE 'Asia/Seoul')
```

---

## E. 윈도우 환경 일반

| 증상 | 원인 | 해결 |
|---|---|---|
| `psql` 인식 안 됨 | PostgreSQL `bin` 이 PATH 에 없다 | `& "C:\Program Files\PostgreSQL\16\bin\psql.exe"` |
| `alembic` / `preflight.py` 인식 안 됨 | venv 도 PATH 에 없다 | `.\.venv\Scripts\alembic.exe` |
| `setup-windows.ps1` 인식 안 됨 | PowerShell 은 현재 폴더를 안 본다 | `.\setup-windows.ps1` |
| `extension "postgis" is not available` | 설치 때 Stack Builder 를 건너뜀 | Stack Builder 로 PostGIS 설치. `init-db.ps1` 이 미리 잡아준다 |
| Docker `_ping` 500 / WSL2 가상화 오류 | CPU 가상화가 BIOS 에서 꺼짐 | 도커 대신 윈도우 네이티브 PostgreSQL 사용 (지금 방식) |
| `git add -A` 가 이상하게 동작 | `F:\` 루트에서 실행함 | 프로젝트 폴더로 `cd` 후 실행 |

---

## F. 디버깅할 때의 순서

에러가 나면 개별 대응하지 말고 **먼저 이 둘을 돌린다.**

```powershell
.\.venv\Scripts\python.exe tools\preflight.py        # 환경 전반 한 번에 진단
.\.venv\Scripts\python.exe tools\check_encoding.py   # 인코딩 함정 전수 검사
```

`preflight.py` 의 종료 코드는 **"진행 가능한가"** 를 뜻한다.
`[WARN]` 만 있으면 0, `[FAIL]` 이 하나라도 있으면 1 이다.
`start-web.ps1` 이 이 코드를 보고 진행 여부를 정한다.

### 500 에러가 났을 때 먼저 의심할 것

**DB 가 최신 마이그레이션까지 올라가 있는지.**
`column robot.api_key_hash does not exist` 로 500 이 났는데,
알고 보니 테스트용 DB 에 `0002` 가 안 올라가 있었다. 코드 버그가 아니었다.

```powershell
.\.venv\Scripts\alembic.exe current    # head 와 같은지 확인
```
