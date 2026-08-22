"""인코딩 지뢰 검사기.

한국어 Windows(CP949 로캘)에서 터지는 문제를 미리 잡는다.
지금까지 실제로 두 번 터졌다:
  1) alembic.ini 의 한글 주석  -> configparser.ParsingError 로 alembic 사망
  2) psql 의 -c 인자에 넣은 한글 -> UTF8/CP949 불일치로 0xc1 0xa2 에러

실행:  python tools/check_encoding.py
CI나 커밋 전에 돌리면 같은 사고가 반복되지 않는다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".venv", ".git", "__pycache__", "node_modules", "dist", ".pytest_cache"}

# 설정 파일은 로캘 인코딩으로 읽히므로 ASCII만 허용한다
ASCII_ONLY_SUFFIXES = {".ini", ".cfg"}
# PowerShell 5.1은 BOM이 없으면 UTF-8 한글을 CP949로 잘못 읽는다
BOM_REQUIRED_SUFFIXES = {".ps1"}
# UTF-8로 읽혀야 하는 것들
UTF8_SUFFIXES = {".py", ".sql", ".md", ".yml", ".yaml", ".mako", ".example", ".json"}

UTF8_BOM = b"\xef\xbb\xbf"

errors: list[str] = []
warnings: list[str] = []


def iter_files():
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        yield p


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT))


def check_ascii_only(p: Path, data: bytes):
    bad = [(i, b) for i, b in enumerate(data) if b > 127]
    if bad:
        try:
            line = data[: bad[0][0]].decode("utf-8", "replace").count("\n") + 1
        except Exception:
            line = "?"
        errors.append(
            f"{rel(p)}:{line} — 설정 파일에 비ASCII 문자 {len(bad)}바이트. "
            f"로캘 인코딩(CP949)으로 읽히므로 한글을 쓰면 파싱이 깨진다. 영어로 쓸 것."
        )


def check_bom(p: Path, data: bytes):
    if not data.startswith(UTF8_BOM):
        has_korean = any(0xAC00 <= ord(c) <= 0xD7A3
                         for c in data.decode("utf-8", "ignore"))
        if has_korean:
            errors.append(
                f"{rel(p)} — 한글이 있는데 UTF-8 BOM이 없다. "
                f"Windows PowerShell 5.1이 CP949로 잘못 읽어 글자가 깨진다."
            )
        else:
            warnings.append(f"{rel(p)} — BOM 없음 (한글이 없어 당장은 문제 없음)")


def check_utf8(p: Path, data: bytes):
    try:
        data.decode("utf-8")
    except UnicodeDecodeError as e:
        errors.append(f"{rel(p)} — UTF-8로 디코드 불가: {e}")


# psql -c "..." / -tAc "..." 안에 한글이 있으면 안 된다
PSQL_ARG = re.compile(r'psql(?:\.exe)?["\']?[^\n]*?-(?:c|tAc)\s+"([^"]*)"')


def check_psql_args(p: Path, text: str):
    for m in PSQL_ARG.finditer(text):
        arg = m.group(1)
        if any(0xAC00 <= ord(c) <= 0xD7A3 for c in arg):
            line = text[: m.start()].count("\n") + 1
            errors.append(
                f"{rel(p)}:{line} — psql -c 인자에 한글이 있다: {arg[:40]!r}\n"
                f"      콘솔이 CP949로 넘기는데 PGCLIENTENCODING=UTF8과 어긋나 에러가 난다. "
                f"컬럼 별칭 등을 영어로 바꿀 것."
            )


def main() -> int:
    checked = 0
    for p in iter_files():
        data = p.read_bytes()
        suf = p.suffix.lower()
        checked += 1

        if suf in ASCII_ONLY_SUFFIXES:
            check_ascii_only(p, data)
        elif suf in BOM_REQUIRED_SUFFIXES:
            check_bom(p, data)
            check_utf8(p, data)
        elif suf in UTF8_SUFFIXES or p.name.startswith(".env"):
            check_utf8(p, data)

        if suf in (".ps1", ".py", ".sh"):
            check_psql_args(p, data.decode("utf-8", "replace"))

    print(f"검사한 파일: {checked}개\n")
    for w in warnings:
        print(f"  [경고] {w}")
    if warnings:
        print()
    if errors:
        print(f"문제 {len(errors)}건:\n")
        for e in errors:
            print(f"  [오류] {e}")
        return 1
    print("통과 — 인코딩 지뢰 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
