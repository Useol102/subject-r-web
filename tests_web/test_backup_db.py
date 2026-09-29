"""웹 SQLite 백업의 일관성과 보관 개수를 검증한다."""

import sqlite3
from datetime import datetime, timezone

import pytest

from tools import backup_db


def sqlite_url(path):
    return f"sqlite:///{path.as_posix()}"


def test_running_wal_database_is_backed_up_consistently(tmp_path):
    source_path = tmp_path / "live.db"
    source = sqlite3.connect(source_path)
    try:
        source.execute("PRAGMA journal_mode=WAL")
        source.execute("CREATE TABLE place (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
        source.execute("CREATE TABLE program (id INTEGER PRIMARY KEY, place_id INTEGER NOT NULL)")
        source.executemany("INSERT INTO place (name) VALUES (?)", [("강당",), ("상담실",)])
        source.executemany("INSERT INTO program (place_id) VALUES (?)", [(1,), (1,), (2,)])
        source.commit()

        backup_path = backup_db.backup_database(
            sqlite_url(source_path), tmp_path / "backups",
            now=datetime(2026, 9, 29, 0, 30, tzinfo=timezone.utc),
        )
        assert backup_path.name == "web-data-20260929-093000.db"
        with sqlite3.connect(backup_path) as saved:
            assert saved.execute("PRAGMA integrity_check").fetchone() == ("ok",)
            assert saved.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall() == [
                ("place",), ("program",)
            ]
            for table in ("place", "program"):
                assert saved.execute(f"SELECT COUNT(*) FROM {table}").fetchone() == source.execute(
                    f"SELECT COUNT(*) FROM {table}"
                ).fetchone()
    finally:
        source.close()


def test_retention_only_removes_old_matching_backups(tmp_path):
    source_path = tmp_path / "live.db"
    with sqlite3.connect(source_path) as source:
        source.execute("CREATE TABLE place (id INTEGER)")
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    old = backup_dir / "web-data-20260927-100000.db"
    recent = backup_dir / "web-data-20260928-100000.db"
    unrelated = backup_dir / "manual-copy.db"
    for path in (old, recent, unrelated):
        path.write_bytes(b"old")

    newest = backup_db.backup_database(
        sqlite_url(source_path), backup_dir, keep=2,
        now=datetime(2026, 9, 29, 10, 0, tzinfo=backup_db.KST),
    )
    assert not old.exists()
    assert recent.exists()
    assert newest.exists()
    assert unrelated.exists()


def test_missing_source_never_creates_an_empty_database(tmp_path):
    source_path = tmp_path / "missing.db"
    with pytest.raises(FileNotFoundError):
        backup_db.backup_database(sqlite_url(source_path), tmp_path / "backups")
    assert not source_path.exists()
    assert not (tmp_path / "backups").exists()


def test_new_backup_survives_when_pc_clock_moves_back(tmp_path):
    source_path = tmp_path / "live.db"
    with sqlite3.connect(source_path) as source:
        source.execute("CREATE TABLE place (id INTEGER)")
    backup_dir = tmp_path / "backups"
    backup_dir.mkdir()
    for name in ("web-data-20260930-100000.db", "web-data-20261001-100000.db"):
        (backup_dir / name).write_bytes(b"old")

    saved = backup_db.backup_database(
        sqlite_url(source_path), backup_dir, keep=2,
        now=datetime(2026, 9, 29, 10, 0, tzinfo=backup_db.KST),
    )
    assert saved.exists()
    assert len(list(backup_dir.glob("web-data-*.db"))) == 2


def test_command_uses_web_database_url(tmp_path, monkeypatch):
    source_path = tmp_path / "custom.db"
    with sqlite3.connect(source_path) as source:
        source.execute("CREATE TABLE place (id INTEGER)")
        source.execute("INSERT INTO place VALUES (1)")
    monkeypatch.setenv("WEB_DATABASE_URL", sqlite_url(source_path))
    monkeypatch.setattr(backup_db, "ROOT", tmp_path)

    assert backup_db.main(["--keep", "1"]) == 0
    backups = list((tmp_path / "backups").glob("web-data-*.db"))
    assert len(backups) == 1
    with sqlite3.connect(backups[0]) as saved:
        assert saved.execute("SELECT COUNT(*) FROM place").fetchone() == (1,)
