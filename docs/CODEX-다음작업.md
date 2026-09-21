# 다음 작업은 여기서부터 (Codex·Claude 공용 인수인계)

마지막 갱신: **2026-09-22 (KST)** · 갱신자: Claude Code
작업 브랜치: `web-kiosk-sqlite`

> **매일 작업을 시작할 때 이 파일을 제일 먼저 읽는다.**
> **작업을 끝낼 때 이 파일의 "지금 상태"와 "다음 작업"을 갱신하고 같이 커밋한다.**
> 이 파일은 "무엇을 할 차례인가"만 적는다. 규칙은 `AGENTS.md`, 함정은 `CLAUDE.md`,
> 실행법과 화면 흐름은 `docs/WEB-START.md` 에 있다.

---

## 0. 읽는 순서 (처음 들어온 에이전트용)

1. `AGENTS.md` — 이 저장소의 작업 규칙
2. `CLAUDE.md` — 사고 나기 쉬운 지점 (코드가 두 벌, 인코딩, SQLite 시각 형식)
3. `docs/WEB-START.md` — 실행법·화면 흐름·데이터 계약
4. 이 파일 — 다음에 할 일

`app/`, `alembic/`, `schema/`, `docs/archive/` 는 **옛 PostgreSQL 계획**이다. 근거로 삼지 않는다.

---

## 1. 바꾸지 않기로 한 것 (UI 동결)

**화면 디자인은 지금 상태로 고정한다.** 기능을 고치거나 데이터를 붙이더라도 아래는 그대로 둔다.

- 화면 구성과 흐름: 홈(인사말 + 큰 카드 3개 + 오늘의 프로그램) → 프로그램 / 장소 / 출석
- 색·여백·모서리·글꼴 체계 (`web/src/styles.css` 의 `:root` 변수와 기존 클래스)
- 직원 화면의 왼쪽 메뉴 4개 구성과 패널 배치
- `큰 글씨` 토글, 데모 표시줄, 하단 고정 바

고칠 수 있는 것: **버그, 기능 추가, 데이터 연결, 접근성·가독성 보정.**
새 화면이 필요하면 **기존 클래스를 재사용**해서 같은 모양으로 만든다.
색을 바꾸거나 레이아웃을 새로 짜야 한다면 **먼저 사용자에게 묻는다.** 임의 리디자인 금지.

이유: 시연 자료와 팀 설명이 이 화면 기준으로 만들어져 있다. 화면이 바뀌면 설명이 전부 어긋난다.

---

## 2. 지금 상태 (2026-09-22 기준)

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
| **태블릿·모바일 터치 화면 대응** | `web/src/styles.css` 끝부분 |
| **고령층용 글씨 굵기 상향** | `web/src/styles.css` 끝부분 |
| **PR 자동 검사 (GitHub Actions)** | `.github/workflows/web-verify.yml` |

**검증 기준선** — 이 숫자가 줄면 뭔가 깨진 것이다.

```
API 20개 · 프런트 55개(스캐너 13 + 한글 검색 16 + 영수증 8 + 회차 반복 18)
빌드 통과 · Alembic 빈 diff · 인코딩 검사 통과
가로 스크롤 없음: 360 / 390 / 414 / 600 / 601 / 700 / 768 / 820 / 900 / 1024 / 1180 / 1366 px
```

---

## 3. 다음 작업 (우선순위 순)

### ⏸ 막혀 있는 것 — 규격이 와야 시작할 수 있다. 지어내지 말 것

| 작업 | 기다리는 것 | 주는 곳 |
|---|---|---|
| 예약 이동 (프로그램 시작 전 강의실 앞으로) | 로봇 이동 API 규격 | 시뮬레이션팀 |
| 실제 장소·층·안내 문구 채우기 | 기관 데이터 | 기관 컨택 |
| 실내 지도, 검증된 경로 | 지도 데이터 | 시뮬레이션팀 |
| 기관 출결 연동 | 출결 API 규격 | 기관 |
| 영수증 실물 출력 확인 (여백·잘림) | 프린터 기종 | 기관 |

### ▶ 규격 없이도 지금 할 수 있는 것

1. **처음 설치 절차 문서화** — `docs/WEB-START.md` 에 "처음 한 번" 절을 만든다.
   `.venv` 는 저장소에 없다. `py -m venv .venv` → `pip install -r requirements-web.txt` 가 빠져 있어
   실제로 팀원이 한 번 막혔다.
2. **옛 `.ps1` 스크립트 정리** — `setup-python-env.ps1`, `init-db.ps1`, `fix-env.ps1` 은
   옛 PostgreSQL 기준이다(`requirements.txt`, `app.main:app`). `CLAUDE.md` §1 표에 ⛔ 로 표시하거나
   `scripts/archive/` 로 옮긴다. **지우지는 않는다.**
3. **직원 계정(`staff`)·감사 기록(`audit_log`)** — `docs/ERD.md` §8 #1.
   ⚠ 먼저 정해야 할 것: 직원마다 계정을 줄 것인가, 지금처럼 공용 `WEB_ADMIN_KEY` 하나로 갈 것인가.
   **기관에 물어보고 시작한다.** 개인정보가 늘어나는 변경이라 임의로 진행하지 않는다.
4. **실물 태블릿 확인** — 지금까지는 브라우저 크기만 줄여서 봤다.
   실제 패드에서 터치 크기·글씨 크기·화면 회전을 한 번 봐야 한다.

---

## 4. 시작·마무리 절차

**시작**

```powershell
git pull origin web-kiosk-sqlite
.\.venv\Scripts\python.exe -m alembic -c web-alembic.ini upgrade head
.\.venv\Scripts\python.exe -m uvicorn web_api.main:app --host 127.0.0.1 --port 8000
# 다른 터미널
npm --prefix web run dev     # 이용자 http://127.0.0.1:5173/  직원 /admin
```

**마무리 — 5개 전부 돌리고 커밋한다**

```powershell
.\.venv\Scripts\python.exe -m pytest tests_web -q
npm --prefix web test
npm --prefix web run build
.\.venv\Scripts\python.exe -m alembic -c web-alembic.ini check
.\.venv\Scripts\python.exe tools\check_encoding.py
```

PR 을 올리면 GitHub Actions(`.github/workflows/web-verify.yml`)가 같은 5개를 자동으로 돌린다.
**빨간불이면 머지하지 않는다.** 검사를 더하거나 뺄 때는 워크플로와 `CLAUDE.md` §10 목록을 같이 고친다.

그리고 **이 파일의 §2·§3 을 갱신**한 뒤 같은 커밋에 넣는다. 갱신하지 않으면 다음 사람이 같은 일을 또 한다.

---

## 5. 자주 사고 나는 지점 (요약)

- `alembic` 명령에 **`-c web-alembic.ini` 를 반드시 붙인다.** 안 붙이면 옛 PostgreSQL 설정이 돈다.
- 마이그레이션은 `revision --autogenerate` 로만 만들고 **본문을 손으로 고치지 않는다.**
- 시각 문자열은 `web_api/models.py` 의 `iso_z()` 로만 만든다. 형식이 섞이면 `ORDER BY` 가 조용히 틀린다.
- 화면의 `datetime-local` 값은 `kstLocalToDate()` 로만 읽는다. `new Date(문자열)` 은 시간대가 밀린다.
- 순수 함수 4개(`scanner` / `hangulSearch` / `receipt` / `recurrence`)는 **DOM 을 모른다.**
  화면 코드에 같은 계산을 새로 만들지 말고, 고치면 짝이 되는 테스트도 같이 고친다.
- 장소·프로그램은 **물리 삭제 금지.** `is_active` 로 숨긴다.
- 외부 CDN·온라인 지도·클라우드 의존성 추가 금지. 설치 후 LAN 에서 돌아야 한다.
- 데모(`WEB_DEMO=true`)를 실제처럼 보이게 만들지 않는다. 출결은 `TEST-001` 만 통과한다.
