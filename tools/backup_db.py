"""실행 중인 SQLite 데이터베이스를 일관된 사본으로 백업한다."""

from __future__ import annotations

import argparse
import os
import re
import sqlite3
import sys
import tempfile
from contextlib import closing
from datetime import datetime
from pathlib import Path

from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

from web_api.db import DEFAULT_DATABASE_URL
from web_api.models import KST


ROOT = Path(__file__).resolve().parent.parent
BACKUP_NAME = re.compile(r"web-data-\d{8}-\d{6}\.db\Z")


def database_path(database_url: str) -> Path:
    """서버와 같은 SQLite URL에서 실제 파일 경로를 읽는다."""
    try:
        url = make_url(database_url)
    except ArgumentError as exc:
        raise ValueError("WEB_DATABASE_URL 형식이 올바르지 않습니다.") from exc
    if url.drivername not in {"sqlite", "sqlite+pysqlite"} or not url.database or url.database == ":memory:":
        raise ValueError("백업에는 파일 기반 SQLite WEB_DATABASE_URL이 필요합니다.")
    if url.query.get("uri") == "true":
        raise ValueError("SQLite URI 모드의 WEB_DATABASE_URL은 백업에서 지원하지 않습니다.")
    return Path(url.database).resolve()


def backup_database(database_url: str, backup_dir: Path, *, keep: int = 30,
                    now: datetime | None = None) -> Path:
    """SQLite 백업 API로 복사하고 성공한 뒤 오래된 사본을 정리한다."""
    if keep < 1:
        raise ValueError("보관 개수는 1 이상이어야 합니다.")
    source_path = database_path(database_url)
    if not source_path.is_file():
        raise FileNotFoundError(f"원본 데이터베이스가 없습니다: {source_path}")

    timestamp = (now or datetime.now(KST)).astimezone(KST).strftime("%Y%m%d-%H%M%S")
    backup_dir.mkdir(parents=True, exist_ok=True)
    backup_path = backup_dir / f"web-data-{timestamp}.db"
    if backup_path.exists():
        raise FileExistsError(f"같은 시각의 백업이 이미 있습니다: {backup_path}")

    fd, temporary_name = tempfile.mkstemp(prefix=".web-data-", suffix=".tmp", dir=backup_dir)
    os.close(fd)
    temporary_path = Path(temporary_name)
    try:
        # 읽기 전용으로 열어 원본이 사라졌을 때 빈 DB를 새로 만들지 않는다.
        with closing(sqlite3.connect(source_path.as_uri() + "?mode=ro", uri=True, timeout=5)) as source:
            with closing(sqlite3.connect(temporary_path, timeout=5)) as destination:
                source.backup(destination, pages=100, sleep=0.05)
                if destination.execute("PRAGMA integrity_check").fetchone() != ("ok",):
                    raise sqlite3.DatabaseError("백업 파일 무결성 검사에 실패했습니다.")
        temporary_path.replace(backup_path)
    finally:
        temporary_path.unlink(missing_ok=True)

    saved = sorted(
        (path for path in backup_dir.iterdir()
         if path.is_file() and BACKUP_NAME.fullmatch(path.name) and path.resolve() != source_path),
        key=lambda path: path.name,
    )
    # PC 시계가 뒤로 갔어도 방금 만든 사본은 남긴다.
    removable = [path for path in saved if path != backup_path]
    for old_path in removable[:max(0, len(saved) - keep)]:
        old_path.unlink()
    return backup_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="SQLite 웹 DB를 backups/에 백업합니다.")
    parser.add_argument("--keep", type=int, default=30, help="남겨 둘 백업 개수 (기본 30개)")
    args = parser.parse_args(argv)
    database_url = os.getenv("WEB_DATABASE_URL") or DEFAULT_DATABASE_URL
    try:
        path = backup_database(database_url, ROOT / "backups", keep=args.keep)
    except (ValueError, OSError, sqlite3.Error) as exc:
        print(f"[백업 실패] {exc}", file=sys.stderr)
        return 1
    print(f"[백업 완료] {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
