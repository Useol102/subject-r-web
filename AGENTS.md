# Subject R 웹 작업 규칙

2026-09-17 사용자 요청: 새 개발 계획의 웹 담당 부분부터 구현한다. 다른 팀의 자료는 아직 없으므로 예시로 화면과 연결 틀을 만든다. **SQLite로 변경**한다는 사용자 답변을 받았다.

- 한국어로 답하고 코드 주석도 한국어로 작성한다.
- 현재 개발 대상은 `web/`(React 18 + TypeScript + Vite), `web_api/`(FastAPI + SQLAlchemy 2.0 + SQLite), `web_migrations/`이다.
- 기존 `app/`, `alembic/`, `schema/`, `subject-r-web-frontend.zip`은 이전 PostgreSQL 설계의 참고 자료다. 새 서비스를 실행하는 데 사용하지 않는다. 기존 DB를 자동 변환하거나 삭제하지 않는다.
- `docs/WEB-START.md`를 먼저 읽는다. `docs/PITFALLS.md`의 인코딩 규칙을 지킨다. `.ps1`은 UTF-8 BOM, `.ini`는 ASCII.
- SQLite는 TIMESTAMPTZ가 없으므로 시각은 UTC 오프셋이 명시된 ISO 8601 문자열로 저장하고 화면과 일자 집계는 KST를 사용한다.
- 스키마 변경은 모델 수정 후 `python -m alembic -c web-alembic.ini revision --autogenerate`로 생성한다. 수동 DDL이나 마이그레이션 본문 수정을 금지한다. 전후 `alembic check`와 upgrade → downgrade → upgrade를 검증한다.
- 실제 기관 데이터, 지도, 로봇 통신, 출결 규격, 프린터 규격은 미확정이다. 예시와 실제 동작을 혼동시키지 않는다.
- 로봇 제어, 경로 계산, 비전/AI, 엘리베이터 제어는 다른 팀 범위다. 웹은 계약이 확정되면 연결한다.
- 실제 로봇으로 명령을 보내는 코드는 아직 없다. 이동 요청은 `trip`으로 부르고 데모 상태를 자동 완료로 위조하지 않는다.
- 장소/프로그램은 비활성화로 숨긴다. 이력 보호를 위해 물리 삭제하지 않는다. 가져오기는 ID 기준 병합, 전체 검증 후 한 번에 커밋한다.
- 데모는 로컬 전용이다. 기본 바인딩 127.0.0.1을 유지한다. 실데이터 모드에서는 직원 쓰기에 `WEB_ADMIN_KEY`를 요구하고 미연동 출결/이동을 거부한다.
- 외부 CDN, 온라인 지도, 클라우드 런타임 의존성을 추가하지 않는다. 설치 후 LAN에서 실행할 수 있어야 한다.
- 변경 후 `python -m pytest tests_web -q`, `npm --prefix web test`, `npm --prefix web run build`, `python -m alembic -c web-alembic.ini check`, `python tools/check_encoding.py`를 실행한다.
- 옛 계획 문서는 `docs/archive/`에 있다. 근거로 삼지 않는다.
- 바코드 스캐너는 키보드 웨지(HID) 방식이다. 사람 타자와 구분하는 기준은 글자 간 시간 간격뿐이므로 판별 로직은 `web/src/scanner.ts`에 순수 함수로 두고 `scanner.test.ts`로 검증한다. 화면 코드에 직접 넣지 않는다.
