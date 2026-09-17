# Subject R 웹 작업 인수인계

작성일: 2026-09-17

## 이번 작업의 방향

첨부된 `Subject R 진행 방향 및 개발 계획.pdf`를 기준으로 웹 담당 범위만 구현했다. 계획상 웹 담당은 다음과 같다.

- 이용자용 이동형 키오스크: 프로그램 조회, 장소 찾기, QR/바코드 출결 틀, 안내문 인쇄
- 직원용 화면: 프로그램·장소 관리, 로봇 이동 요청, 현재 상태 확인
- 서버: 정보 조회와 장치·작업 연결

다른 팀의 지도·로봇·출결 규격·실제 기관 데이터는 아직 받지 못했다. 화면에서 예시 데이터와 실제 연동 상태를 구분한다.

## 저장소 구조

이번 계획용 새 웹은 기존 PostgreSQL/PostGIS 코드와 분리했다.

```text
web/                 React 18 + TypeScript + Vite 이용자/직원 통합 화면
web_api/             FastAPI + SQLAlchemy 2.0 + SQLite API
web_migrations/      새 SQLite 웹 스키마 Alembic
tests_web/           웹 API 계약·무결성 테스트
requirements-web.txt 새 웹 서버 의존성
web-alembic.ini      새 SQLite 마이그레이션 설정
AGENTS.md            이 저장소의 현재 웹 작업 규칙
```

기존 `app/`, `alembic/`, `schema/`는 PostgreSQL/PostGIS 설계 참고 자료로 보존했다. 새 계획에서 사용자는 저장소를 SQLite로 변경하기로 선택했다.

## 실행

PowerShell에서 저장소 루트 기준:

```powershell
.\.venv\Scripts\python.exe -m alembic -c web-alembic.ini upgrade head
.\.venv\Scripts\python.exe -m uvicorn web_api.main:app --host 127.0.0.1 --port 8000
```

다른 터미널에서:

```powershell
Set-Location web
npm install
npm run dev
```

- 이용자 화면: `http://127.0.0.1:5173/`
- 직원 화면: `http://127.0.0.1:5173/admin`
- API 문서: `http://127.0.0.1:8000/docs`

API를 직접 실행할 때는 `http://127.0.0.1:8000/admin`도 빌드된 `web/dist`가 존재할 경우 직원 화면을 제공한다. 개발 중에는 Vite 주소를 사용한다.

기본 설정:

- `WEB_DATABASE_URL=sqlite:///./web-data.db`
- `WEB_DEMO=true`
- `WEB_ADMIN_KEY`는 데모에서는 비워둘 수 있다.
- 실데이터 모드에서는 `WEB_DEMO=false`와 `WEB_ADMIN_KEY`를 지정해야 직원 변경 API를 쓸 수 있다.

## 화면 사용 흐름

1. 직원 화면에서 `예시 데이터 불러오기`를 누른다.
2. 이용자 화면에서 프로그램 보기, 장소 찾기, 상세 안내, 브라우저 인쇄를 확인한다. 장소 찾기 검색창은 이름 일부, 띄어쓰기 없는 이름, 초성(`ㅎㅈㅅ`), 초성과 글자 섞기를 모두 받는다. 규칙은 `web/src/hangulSearch.ts`.
3. 출석 확인 화면은 바코드 스캐너(키보드 웨지)를 그대로 받는다. 스캐너가 값을 쏘면 자동으로 확인하고, 스캐너가 없으면 `직접 입력하기`로 넘어간다. 참여 프로그램은 지금 시간대의 일정이 미리 선택된다. 실제 개인정보 대신 `TEST-001`만 사용하며 오늘 일정에 대해서만 동작한다.
4. 직원 화면 대시보드에서 장소를 고르고 데모 이동 요청을 만든다.
5. `이동 시작 재현`, `도착 재현` 버튼은 상태 전이 UI만 확인하는 기능이다. 실제 로봇을 움직이지 않는다.
6. `데이터 · 연결`에서 장소·프로그램 JSON을 내보내거나 가져온다. 가져오기는 같은 ID를 수정하고 새 ID를 추가하며, 누락된 데이터는 삭제하지 않는다.

## 데이터 계약

`web_api/demo-catalog.json`이 교체용 예시 양식이다.

- 장소 ID와 프로그램 ID는 영문·숫자·하이픈·밑줄 1~64자
- 프로그램의 `starts_at`, `ends_at`는 UTC ISO 8601(`Z`)로 저장
- 화면의 날짜·시간 표시와 오늘 필터는 Asia/Seoul(KST)
- 장소를 비활성화하면 이용자 화면에서 숨지만 DB 기록은 남긴다.
- 사용 중인 장소를 비활성화하면 프로그램·로봇 참조 무결성 때문에 거부한다.

## 다음 팀 자료가 오면

- 실제 층·장소·안내 문구: `web_api/demo-catalog.json` 형식으로 JSON을 작성해 직원 화면에서 가져온다.
- 실내 지도와 검증된 경로: `web/src/App.tsx`의 지도 자리표시자와 장소 `directions`를 실제 계약에 맞게 교체한다.
- 시뮬레이션팀의 이동 API: `web_api/main.py`의 `/api/admin/trips`와 데모 상태 API를 실제 브리지 호출로 교체한다. 요청/응답 스키마를 먼저 문서화한다.
- 기관 출결 API: `/api/attendance/demo`를 실제 출결 어댑터로 교체한다. 회원번호·QR 원문을 로그나 SQLite에 저장하지 않는다.
- 프린터 사양: 브라우저 `window.print()` 를 쓰며, 용지 폭은 80mm(기본)/58mm 를 화면에서 전환한다. 기종이 정해지면 실물로 한 장 뽑아 여백과 잘림을 확인한다.

## 검증 명령

```powershell
.\.venv\Scripts\python.exe -m pytest tests_web -q
npm --prefix web test
npm --prefix web run build
.\.venv\Scripts\python.exe -m alembic -c web-alembic.ini check
.\.venv\Scripts\python.exe tools\check_encoding.py
```

현재 검증 결과: API 테스트 10개 통과, 프런트 테스트 37개 통과(스캐너 13, 한글 검색 16, 영수증 8), 웹 TypeScript/Vite 빌드 통과, Alembic 빈 diff 통과, 인코딩 검사 통과.

바코드 입력은 실제 브라우저에서 스캐너 속도(글자당 10ms + Enter)와 사람 타자 속도(200ms)를 각각 흘려보내 확인했다. 스캐너 속도만 출석으로 잡히고, 사람 타자는 무시된다.

## 주의

- `docs/PITFALLS.md`의 인코딩 규칙을 계속 지킨다.
- 실제 데이터·장치가 들어오기 전까지 데모라고 표시한다.
- 로봇 제어, 경로 계산, AI 인식, 엘리베이터 제어는 웹 담당 범위가 아니다.
- 옛 PostgreSQL 계획 문서는 `docs/archive/`에 참고용으로 모아뒀다. 새 웹 코드는 이 문서와 루트 `AGENTS.md`, `CLAUDE.md`를 기준으로 이어간다.
