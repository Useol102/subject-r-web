# 팀원 설치 가이드

이 저장소를 처음 받는 사람용. **20~40분** 걸린다 (PostgreSQL 설치가 대부분).

Windows 기준으로 썼다. Mac/Linux면 아래 [다른 OS](#다른-os) 참고.

---

## 시작하기 전에

**PowerShell을 쓴다. CMD나 Anaconda Prompt가 아니다.**

프롬프트 맨 앞을 확인:

```
PS C:\...>     <- PowerShell. 맞다
C:\...>        <- CMD. 창을 다시 열 것
```

여는 법: `Win` + `X` → **터미널** (설치 단계는 **터미널(관리자)**)

---

## 1단계 — 저장소 받기

```powershell
cd C:\           # 원하는 위치. 경로에 한글이 없는 곳을 권함
git clone https://github.com/Useol102/subject-r-web.git
cd subject-r-web
```

Git이 없으면 먼저: `winget install Git.Git` → **창을 닫고 새로 열 것**

---

## 2단계 — 설치 (관리자 권한 PowerShell)

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup-windows.ps1
```

이미 깔린 건 알아서 건너뛴다. 여러 번 돌려도 안전하다.

PostgreSQL 설치 마법사가 뜨면:

| 항목 | 값 |
|---|---|
| **Password** | 기억할 수 있는 걸로. **꼭 메모해둘 것** |
| Port | 5432 (기본값) |
| Locale | 기본값 |
| 마지막 Stack Builder 체크박스 | **켜둘 것** |

---

## 3단계 — PostGIS ⚠️ 제일 많이 빠뜨리는 단계

**이걸 건너뛰면 4단계에서 반드시 실패한다.** 자동 설치가 안 돼서 손으로 해야 한다.

1. 시작 메뉴 → **Stack Builder** 실행
   - 안 보이면 직접: `C:\Program Files\PostgreSQL\16\bin\stackbuilder.exe`
2. 드롭다운에서 **PostgreSQL 16 (x64) on port 5432** → Next
3. **Spatial Extensions** 펼치기 → **PostGIS 3.x Bundle for PostgreSQL 16** 체크
4. Next → Next → 설치
5. "Create spatial database?" 는 **No** 눌러도 된다

> 왜 필요한가: 우리 DB는 POI 좌표, 금지구역 폴리곤을 다룬다.
> PostGIS 없이는 테이블 생성부터 실패한다.

Stack Builder 다운로드가 자주 실패한다. 안 되면
[download.osgeo.org/postgis/windows](https://download.osgeo.org/postgis/windows/) 에서
`postgis-bundle-pg16-...x64.zip` 를 받아 압축을 풀고,
안의 `bin` `share` `lib` 내용을 `C:\Program Files\PostgreSQL\16\` 의 같은 폴더에 덮어쓴다 (관리자 권한).

---

## 4단계 — 나머지 (일반 PowerShell로 충분)

```powershell
.\setup-python-env.ps1     # .venv 생성 + 패키지 설치
.\init-db.ps1              # DB + 테이블 9개 + 시드 데이터
.\fix-env.ps1              # .env 생성 + SECRET_KEY 발급
.\.venv\Scripts\alembic.exe stamp head
```

`init-db.ps1`이 2단계에서 정한 **postgres 비밀번호**를 물어본다.

성공하면 이렇게 나온다:

```
접속 OK
PostGIS OK
robotdb 생성 중 (UTF8)...
적용: schema\001_phase1.sql
적용: schema\002_seed_dev.sql

 tables_created
----------------
              9

  label   | x  |  y
----------+----+-----
 출입구   |  2 | 0.5
 로비     |  5 |   3
 ...
```

---

## 5단계 — 확인

```powershell
.\.venv\Scripts\python.exe tools\preflight.py
```

전부 `[ OK ]` 여야 한다. 하나라도 `[FAIL]` 이면 무엇을 해야 하는지 화면에 나온다.

```powershell
.\.venv\Scripts\uvicorn.exe app.main:app --reload
```

브라우저에서 **http://localhost:8000** → API 문서로 자동 이동하면 끝.

---

## 문제 해결

에러 메시지를 그대로 찾아볼 것.

| 화면에 뜨는 것 | 원인 / 해결 |
|---|---|
| `이 시스템에서 스크립트를 실행할 수 없으므로` | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` 를 먼저 |
| `'xxx.ps1' 용어가 ... 인식되지 않습니다` | 앞에 `.\` 를 빠뜨림. `.\setup-windows.ps1` |
| `'irm'은(는) 내부 또는 외부 명령이 아닙니다` | CMD 창이다. PowerShell로 열 것 |
| `extension "postgis" is not available` | **3단계를 건너뜀.** PostGIS 설치 후 `.\init-db.ps1 -Recreate` |
| `robotdb 이미 있음` | `.\init-db.ps1 -Recreate` 로 다시 만들 것 |
| postgres 비밀번호가 기억 안 남 | `.\reset-pgpassword.ps1` (관리자 권한). 재설치 불필요 |
| `[FAIL] DB 접속` | PostgreSQL 서비스가 꺼졌거나 비밀번호가 틀림. `.\fix-env.ps1` 이 둘 다 잡아줌 |
| `'conda' 용어가 ... 인식되지 않습니다` | **conda를 쓰지 않는다.** `.\setup-python-env.ps1` 이 `.venv`를 만든다 |
| `alembic` 실행 시 `configparser` 에러 | `alembic.ini`에 한글이 들어감. 아래 [주의사항](#주의사항) 참고 |
| psql에서 `0xc1 0xa2` 인코딩 에러 | `psql -c` 인자에 한글이 들어감. 아래 참고 |
| Docker 쓰려는데 `_ping` 500 에러 | Docker Desktop 엔진이 안 켜짐. **Docker는 필수가 아니다** — 위 4단계로 가면 된다 |

### Docker를 쓰고 싶다면

`docker compose up -d` 한 줄로 DB가 뜬다. 다만 **WSL2 + CPU 가상화(BIOS)** 가 필요하다.
발로란트 등 안티치트 프로그램과 충돌할 수 있으니, 굳이 켤 필요 없으면 위 4단계(로컬 설치)로 가면 된다.
**어느 쪽이든 같은 `schema/` 파일을 쓰므로 결과는 동일하다.**

---

## 주의사항

### 인코딩 — 한국어 Windows에서만 터지는 것들

우리가 실제로 두 번 당했다. 파일을 고칠 때 지킬 것:

| 하지 말 것 | 이유 |
|---|---|
| `alembic.ini` 에 한글 주석 | Alembic이 이 파일을 CP949로 읽어서 통째로 죽는다 |
| `psql -c "SELECT ... AS 한글별칭"` | 콘솔이 CP949로 넘기는데 UTF8과 어긋나 에러 |
| `.ps1` 파일을 BOM 없이 저장 | PowerShell이 한글을 깨뜨린다 |

`.py`, `.sql`, `.md` 안의 한글은 **괜찮다.**

파일을 고친 뒤에는 검사를 돌릴 것:

```powershell
.\.venv\Scripts\python.exe tools\check_encoding.py
```

### 커밋하면 안 되는 것

```
.env          비밀번호, SECRET_KEY가 들어있다
.venv/        수백 MB
SLAM 지도(.pgm), 학습 이미지, rosbag   저장소가 망가진다
```

`.gitignore`가 막고 있지만, `git status`에 이것들이 보이면 **멈추고 물어볼 것.**

큰 파일은 MinIO나 공유 드라이브에 두고 DB에는 경로 + sha256만 저장한다.
`data_file` 테이블을 그렇게 설계한 이유다.

### 스키마를 바꿀 때

**`psql`이나 pgAdmin에서 직접 `ALTER TABLE` 하지 말 것.** 네 DB만 바뀌고 남들 건 안 바뀐다.

```powershell
# 1. app/models.py 수정
# 2. 마이그레이션 생성
.\.venv\Scripts\alembic.exe revision --autogenerate -m "what changed"
# 3. 생성된 파일을 눈으로 확인   <- 반드시
# 4. 적용
.\.venv\Scripts\alembic.exe upgrade head
# 5. 모델과 마이그레이션 파일을 같이 커밋
```

3번을 강조하는 이유: autogenerate가 **우리가 만든 제약조건을 지우려 드는 경우가 있다.**
`op.drop_constraint`, `op.drop_index` 가 보이면 의도한 게 아닐 가능성이 높다.

**이미 push한 마이그레이션 파일은 절대 수정하지 않는다.**
남의 DB에는 이미 적용됐기 때문에, 고치면 영원히 어긋난다. 새 리비전을 만들 것.

### 남의 변경을 받았을 때

```powershell
git pull
.\.venv\Scripts\pip.exe install -r requirements.txt   # 패키지가 늘었을 수 있다
.\.venv\Scripts\alembic.exe upgrade head              # 스키마가 바뀌었을 수 있다
.\.venv\Scripts\python.exe tools\preflight.py
```

`alembic upgrade head`를 빼먹으면 "내 컴에선 되는데"가 시작된다.

### 이 프로젝트의 규칙

- 시각은 전부 **UTC로 저장**. KST 변환은 화면에서만.
- 좌표는 **위경도가 아니다.** SLAM 지도 원점 기준 미터 단위 로컬 좌표(SRID 0).
- 마스터 데이터(`poi`, `zone`, `robot`)는 **물리 삭제 금지.** `is_active = false`.
- 안내 요청 1건은 **`trip`** 이라고 부른다. "mission", "task" 라고 쓰지 말 것.

---

## 다른 OS

**Mac / Linux**: `.ps1` 스크립트는 Windows 전용이다. 대신 Docker를 쓰면 된다.

```bash
cp .env.example .env      # DATABASE_URL 을 robot:devpass 로 수정
docker compose up -d
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic stamp head
uvicorn app.main:app --reload
```

---

## 도움을 요청할 때

이걸 같이 보내면 훨씬 빨리 해결된다.

```powershell
.\.venv\Scripts\python.exe tools\preflight.py
```

출력 전체를 복사해서 보낼 것. 어느 단계에서 막혔는지 한눈에 보인다.

에러 메시지는 **화면 캡처보다 텍스트 복사**가 낫다 (검색이 되고 글자가 안 깨진다).

---

## 더 읽을 것

| 문서 | 내용 |
|---|---|
| `README.md` | 프로젝트 개요, 데이터 모델 |
| `docs/DB-PHASE1.md` | **스키마 설계 근거** — 왜 이렇게 짰는지, 컬럼별 이유 |
| `RUN-API.md` | 서버 실행, 마이그레이션 상세 |
| `GIT-SETUP.md` | git 협업 규칙 |
| `CLAUDE.md` | 프로젝트 규칙 (Claude Code가 자동으로 읽는다) |
