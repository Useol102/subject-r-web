# 다음 작업은 여기서부터 (Codex·Claude 공용 인수인계)

마지막 갱신: **2026-09-28 (KST)** · 갱신자: Claude Code
작업 브랜치: `web-kiosk-sqlite` · 기본 브랜치: `main`

> **작업을 시작할 때 이 파일을 제일 먼저 읽는다.**
> **작업을 끝낼 때 §4(지금 상태)·§5(다음 작업)를 갱신해 같은 커밋에 넣는다.**
> 이 파일은 "무엇을 할 차례인가"만 적는다. 규칙은 `AGENTS.md`, 함정은 `CLAUDE.md`,
> 화면 흐름과 데이터 계약은 `docs/WEB-START.md` 에 있다.

---

## 0. 읽는 순서 (처음 들어온 에이전트용)

1. `AGENTS.md` — 이 저장소의 작업 규칙
2. `CLAUDE.md` — 사고 나기 쉬운 지점 (코드가 두 벌, 인코딩, SQLite 시각 형식, 화면 동결)
3. `docs/WEB-START.md` — 실행법·화면 흐름·데이터 계약
4. 이 파일 — 다음에 할 일

`app/`, `alembic/`, `schema/`, `docs/archive/` 는 **옛 PostgreSQL 계획**이다. 근거로 삼지 않는다.

---

## 1. 처음 한 번 (새 PC 에 설치)

저장소에는 `.venv` 와 `node_modules` 가 없다. 새 PC 에서는 직접 만든다.

먼저 **Git**, **Python 3.12**(설치 첫 화면에서 `Add python.exe to PATH` 체크), **Node.js 22 LTS** 를 설치하고
PowerShell 을 **새로 연다**. 확인: `git --version`, `py -V`, `node -v`

```powershell
git clone https://github.com/Useol102/subject-r-web.git
cd subject-r-web
git checkout web-kiosk-sqlite

py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-web.txt
npm --prefix web install
```

막히는 지점

| 증상 | 원인 |
|---|---|
| `.\.venv\Scripts\python.exe 용어가 인식되지 않습니다` | 저장소 폴더 **밖**이거나 `.venv` 를 아직 안 만든 것 |
| `py` 를 못 찾음 | 파이썬 PATH 미체크. 다시 설치하거나 `python` 으로 시도 |
| `npm` 인식 안 됨 | PowerShell 을 새로 열지 않은 것 |

⛔ `setup-python-env.ps1`, `init-db.ps1`, `fix-env.ps1` 은 **옛 PostgreSQL 기준**이다. 쓰지 말 것.

---

## 2. 매번 실행

```powershell
.\start-web.ps1              # 이 PC 에서만 (127.0.0.1)
.\start-web.ps1 -Lan         # 폰·패드에서도 볼 때. 접속할 주소를 알려준다
.\start-web.ps1 -SkipBuild   # 화면을 안 고쳤을 때 빌드 생략
```

- 이용자 화면 `http://127.0.0.1:8000/` · 직원 화면 `/admin`
- 스크립트가 DB 업그레이드 → 화면 빌드 → 서버 실행을 한 번에 한다
- 화면이 비어 있으면 `/admin` → `예시 데이터 불러오기`

**직원 화면 비밀번호**는 `web-admin-key.txt` 파일에서 읽는다 (없으면 `1234` 로 만들어진다).
바꾸려면 그 파일 내용만 고치면 된다. `.gitignore` 에 있어 깃허브에 올라가지 않는다.

프런트를 고치며 개발할 때만 Vite 개발 서버를 쓴다 (`npm --prefix web run dev` → `http://127.0.0.1:5173/`).

### 폰·패드에서 열 때 (실제로 다 막혀본 것들)

- 주소는 **`http://` 로 시작**해야 한다. `https` 로 치면 사파리가 "보안 연결할 수 없다"며 막는다.
- **사설 IP** 여야 한다 (`192.168.x.x`, `172.16~31.x.x`, `10.x.x.x`). 공인 IP 로는 닿지 않고,
  닿게 하려고 **포트포워딩을 열지 말 것** — 서버가 인터넷 전체에 노출된다.
- iOS 18 이상: 설정 → 앱 → Safari → **로컬 네트워크** 허용
- 게스트·기관 와이파이는 기기 간 통신을 막는다. 폰 핫스팟에 PC 를 붙이고 IP 를 다시 확인한다.
- 확인이 끝나면 `Ctrl+C` 로 서버를 끈다.

---

## 3. 바꾸지 않기로 한 것 (UI 동결)

**화면 디자인은 지금 상태로 고정한다.** 기능을 고치거나 데이터를 붙이더라도 아래는 그대로 둔다.

- 화면 구성과 흐름: 홈(인사말 + 큰 카드 3개 + 오늘의 프로그램) → 프로그램 / 장소 / 출석
- 색·여백·모서리·글꼴 체계 (`web/src/styles.css` 의 `:root` 변수와 기존 클래스)
- 직원 화면의 메뉴 4개 구성과 패널 배치
- `큰 글씨` 토글, 데모 표시줄, 하단 고정 바

고칠 수 있는 것: **버그, 기능 추가, 데이터 연결, 접근성·가독성 보정.**
새 화면이 필요하면 **기존 클래스를 재사용**해 같은 모양으로 만든다 (직원 잠금 화면이 그 예다).
색을 바꾸거나 레이아웃을 새로 짜야 한다면 **먼저 사용자에게 묻는다.**

이유: 시연 자료와 팀 설명이 이 화면 기준으로 만들어져 있다. 화면이 바뀌면 설명이 전부 어긋난다.

---

## 4. 지금 상태 (2026-09-28 기준)

**끝난 것**

| 항목 | 위치 |
|---|---|
| 프로그램·장소 조회, 상세, 길찾기 안내 | `web/src/App.tsx` |
| 한글 검색(초성·띄어쓰기 무시) | `web/src/hangulSearch.ts` |
| 바코드 출결 (키보드 웨지 판별) | `web/src/scanner.ts` |
| 안내문 인쇄 · 용지 폭 80/58mm 전환 | `web/src/receipt.ts` |
| 프로그램 / 회차(`program_session`) 분리 | `web_api/models.py` |
| 회차 반복 생성 · 휴강 처리 | `web/src/recurrence.ts`, `web/src/Admin.tsx` |
| 시각 문자열 형식 통일 (`iso_z`) | `web_api/models.py` |
| 현행 ERD (테이블 6개) | `docs/ERD-현행.dbml` |
| 태블릿·모바일 터치 화면 대응 | `web/src/styles.css` 끝부분 |
| 고령층용 글씨 굵기 (`:root` 600 / 본문 700) | `web/src/styles.css` 끝부분 |
| PR 자동 검사 (GitHub Actions) | `.github/workflows/web-verify.yml` |
| **직원 화면 비밀번호 잠금** | `web_api/main.py` 의 `staff()`, `web/src/Admin.tsx` 의 잠금 화면 |
| **실행 스크립트** | `start-web.ps1` |

**검증 기준선** — 이 숫자가 줄면 뭔가 깨진 것이다.

```
API 23개 · 프런트 55개(스캐너 13 + 한글 검색 16 + 영수증 8 + 회차 반복 18)
빌드 통과 · Alembic 빈 diff · 인코딩 검사 통과
가로 스크롤 없음: 360 / 390 / 414 / 600 / 601 / 700 / 768 / 820 / 900 / 1024 / 1180 / 1366 px
```

---

## 5. 다음 작업 (우선순위 순)

### ⏸ 막혀 있는 것 — 규격이 와야 시작할 수 있다. 지어내지 말 것

| 작업 | 기다리는 것 | 주는 곳 |
|---|---|---|
| 예약 이동 (프로그램 시작 전 강의실 앞으로) | 로봇 이동 API 규격 | 시뮬레이션팀 |
| 실제 장소·층·안내 문구 채우기 | 기관 데이터 | 기관 컨택 |
| 실내 지도, 검증된 경로 | 지도 데이터 | 시뮬레이션팀 |
| 기관 출결 연동 | 출결 API 규격 | 기관 |
| 영수증 실물 출력 확인 (여백·잘림) | 프린터 기종 | 기관 |

### ▶ 규격 없이도 지금 할 수 있는 것

1. **실제 사용 전 비밀번호 교체** — `web-admin-key.txt` 가 `1234` 면 바꾼다.
   실제 회원 정보를 넣을 때는 `WEB_DEMO=false` 도 같이 켜야 한다(§7).
2. **옛 `.ps1` 스크립트 정리** — `setup-python-env.ps1`, `init-db.ps1`, `fix-env.ps1` 은
   옛 PostgreSQL 기준이다. `scripts/archive/` 로 옮기거나 파일 첫 줄에 ⛔ 표시를 단다.
   **지우지는 않는다.** `.ps1` 은 UTF-8 **BOM** 이어야 한다(옮기기만 해도 검사는 돌린다).
3. **비밀번호 연속 실패 제한** — 지금은 `1234` 를 무한정 시도할 수 있다. 같은 공유기에 있는
   사람이 몇 초면 다 넣어본다. `web_api/main.py` 의 `staff()` 에 **메모리 기반 지연**을 넣는다.
   - 클라이언트 주소별로 실패 횟수를 세고, 5회부터 응답을 늦추거나 429 를 준다
   - 성공하면 카운터를 지운다. 외부 의존성(레디스 등) 추가 금지 — LAN 오프라인이어야 한다
   - 이용자 화면(`/api/snapshot`, 출결)은 건드리지 않는다. 직원 API 만이다
   - 테스트: 연속 실패 후 잠기는지, 맞는 비밀번호로 풀리는지 (`tests_web/test_api.py`)
4. **직원 화면 로그아웃 버튼** — 지금은 탭을 닫아야 비밀번호가 지워진다. 사이드바 아래
   `이용자 화면 열기` 옆에 `잠그기` 를 둔다. `sessionStorage.removeItem('staff-key')` 후
   잠금 화면으로 돌아가면 된다. 기존 클래스 재사용(화면 동결 §3).
5. **직원 계정(`staff`)·감사 기록(`audit_log`)** — `docs/ERD.md` §8 #1.
   지금은 공용 비밀번호 하나다. 누가 고쳤는지 남지 않는다.
   ⚠ 먼저 정할 것: 직원마다 계정을 줄 것인가, 지금처럼 공용 하나로 갈 것인가.
   **기관에 물어보고 시작한다.** 개인정보가 늘어나는 변경이라 임의로 진행하지 않는다.
6. **실물 태블릿에서 최종 확인** — 터치 크기·글씨 굵기·화면 회전. (사용자가 직접 확인)

> 3번과 4번은 다른 팀 자료 없이 바로 할 수 있다. **3번을 먼저 한다** — 비밀번호가 `1234` 인 동안이
> 제일 약하다. 1번·6번은 사람이 할 일이고, 5번은 기관 답을 기다린다.

---

## 6. 작업을 끝낼 때

```powershell
.\.venv\Scripts\python.exe -m pytest tests_web -q
npm --prefix web test
npm --prefix web run build
.\.venv\Scripts\python.exe -m alembic -c web-alembic.ini check
.\.venv\Scripts\python.exe tools\check_encoding.py
```

5개를 전부 돌린 뒤 커밋한다. PR 을 올리면 GitHub Actions 가 같은 5개를 자동으로 돌린다.
**빨간불이면 머지하지 않는다.** 검사를 더하거나 뺄 때는 워크플로와 `CLAUDE.md` §10 목록을 같이 고친다.

그리고 **이 파일의 §4·§5 를 갱신**해 같은 커밋에 넣는다. 갱신하지 않으면 다음 사람이 같은 일을 또 한다.

---

## 7. 자주 사고 나는 지점

- `alembic` 명령에 **`-c web-alembic.ini` 를 반드시 붙인다.** 안 붙이면 옛 PostgreSQL 설정이 돈다.
- 마이그레이션은 `revision --autogenerate` 로만 만들고 **본문을 손으로 고치지 않는다.**
- 시각 문자열은 `web_api/models.py` 의 `iso_z()` 로만 만든다. 형식이 섞이면 `ORDER BY` 가 조용히 틀린다.
- 화면의 `datetime-local` 값은 `kstLocalToDate()` 로만 읽는다. `new Date(문자열)` 은 시간대가 밀린다.
- 순수 함수 4개(`scanner` / `hangulSearch` / `receipt` / `recurrence`)는 **DOM 을 모른다.**
  화면 코드에 같은 계산을 새로 만들지 말고, 고치면 짝이 되는 테스트도 같이 고친다.
- 장소·프로그램은 **물리 삭제 금지.** `is_active` 로 숨긴다.
- 외부 CDN·온라인 지도·클라우드 의존성 추가 금지. 설치 후 LAN 에서 돌아야 한다.

### 보안 (실제 사용이 가까워졌다)

- **비밀번호를 코드나 문서에 적지 않는다.** `web-admin-key.txt` 만 쓰고, 그 파일은 커밋하지 않는다.
- 비밀번호 검사는 **서버(`staff()`)가 한다.** 화면 잠금은 안내일 뿐이라 화면만 고치면 뚫린다.
  직원용 API 를 새로 만들면 **반드시 `dependencies=[Depends(staff)]` 를 붙인다.**
- `--host 0.0.0.0` 은 같은 공유기의 누구나 접속할 수 있는 상태다. 확인이 끝나면 끈다.
  **인터넷에 포트를 열지 않는다.**
- 실제 회원 정보를 다루기 시작하면 `WEB_DEMO=false` 로 바꾼다. 데모 전용 API(출결 재현, 이동 재현)가
  닫히고, 출결은 `TEST-001` 대신 실제 어댑터를 요구하게 된다.
- 데모(`WEB_DEMO=true`)를 실제처럼 보이게 만들지 않는다. 회원번호·QR 원문은 DB 에도 로그에도 남기지 않는다
  (지금은 SHA-256 해시만 저장).
