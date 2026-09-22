# docs/archive — 옛 계획 문서 (읽기 전용)

> **여기 있는 문서를 근거로 작업하지 말 것.** 현재 기준은 `CLAUDE.md`, `AGENTS.md`, `docs/WEB-START.md` 다.

2026-09-17 에 프로젝트 방향이 바뀌었다.

- 이동형 안내 로봇 중심 → **이동형 고령자 친화형 키오스크 중심**
- PostgreSQL + PostGIS → **SQLite** (팀 합의)

아래 문서는 바뀌기 전 계획이다. 지우지 않고 남겨둔 이유는 계획이 또 바뀔 수 있고,
PostGIS 좌표 설계는 자율주행이 붙을 때 다시 쓸 수 있기 때문이다.
이 문서들이 설명하는 코드는 `app/`, `alembic/`, `schema/` 에 그대로 있다 (역시 참고용).

| 파일 | 원래 위치 | 내용 |
|---|---|---|
| `CLAUDE-postgres-plan.md` | `docs/ARCHIVE-postgres-plan.md` | 옛 CLAUDE.md (PostgreSQL 계획) |
| `AGENTS-postgres.md` | 상위 인수인계 폴더 `AGENTS.md` | 옛 에이전트 규칙 (PostgreSQL 스택) |
| `PROJECT-CONTEXT.md` | 상위 인수인계 폴더 `docs/` | 프로젝트 배경, DB 설계 근거 |
| `STATUS-postgres.md` | 상위 인수인계 폴더 `docs/STATUS.md` | 옛 진행 상황 |
| `README-postgres.md` | 저장소 루트 `README.md` | 옛 프로젝트 개요 |
| `RUN-API.md` | 저장소 루트 | 옛 API 실행·마이그레이션 방법 |
| `TEAM-SETUP.md` | 저장소 루트 | 옛 팀원 설치 가이드 (PostgreSQL) |
| `REQUIREMENTS.md` `SCREEN-FLOW.md` `FEATURES.md` | `docs/` | 요구분석·화면흐름·기능목록 (안내 로봇 중심) |
| `flow-user.*` `flow-staff.*` | `docs/` | 화면 흐름도 그림 |
| `ERD.*` `DB-PHASE1.md` | `docs/` | PostgreSQL 스키마와 설계 근거 |

문서 안의 경로(`docs/REQUIREMENTS.md` 등)는 옮기기 전 위치 기준이라 지금과 다르다.
