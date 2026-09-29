# 옛 PostgreSQL 스크립트 보관

이 폴더의 `.ps1`은 이전 PostgreSQL/PostGIS 설계의 설치·복구 절차다. 현재 SQLite 웹 서비스에 실행하지 않는다. 이전 작업 기록을 보존하기 위해 원본 내용을 그대로 옮겼다.

현재 웹은 저장소 루트의 `start-web.ps1`로 실행한다. 새 PC 설치와 실행 방법은 `docs/WEB-START.md`를 따른다.

| 보관 파일 | 이전 용도 |
|---|---|
| `setup-windows.ps1` | PostgreSQL 포함 Windows 개발환경 설치 |
| `setup-python-env.ps1` | 이전 백엔드 의존성 설치 |
| `init-db.ps1` | PostgreSQL DB 생성·재생성 |
| `fix-env.ps1` | 이전 `.env` 및 PostgreSQL 연결 복구 |
| `reset-pgpassword.ps1` | PostgreSQL 인증 설정과 비밀번호 변경 |
