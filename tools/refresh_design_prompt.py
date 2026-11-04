"""docs/디자인-프롬프트.md 의 '현재 디자인 값' 칸을 web/src/styles.css 기준으로 다시 채운다.

사용법 (저장소 루트에서):
    .\\.venv\\Scripts\\python.exe tools\\refresh_design_prompt.py

표시(<!-- AUTO:START --> ~ <!-- AUTO:END -->) 사이만 바꾸고, 나머지 글은 건드리지 않는다.
styles.css 는 읽기만 한다.
"""

from __future__ import annotations

import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / "web" / "src" / "styles.css"
PROMPT = ROOT / "docs" / "디자인-프롬프트.md"
START, END = "<!-- AUTO:START -->", "<!-- AUTO:END -->"


def build_block(css: str) -> str:
    root = re.search(r":root\{([^}]*)\}", css)
    tokens = re.findall(r"(--[a-z-]+):([^;}]+)", root.group(1)) if root else []
    classes = sorted(set(re.findall(r"\.([a-z][a-z0-9-]*)", css)))
    breakpoints = sorted(
        {int(n) for n in re.findall(r"\((?:max|min)-width:\s*(\d+)px\)", css)}, reverse=True
    )
    kst = datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M KST")

    lines = [START, f"_자동 생성: {kst} · 원본 `web/src/styles.css`_", "", "| 색 변수 | 값 | 쓰인 횟수 |", "|---|---|---|"]
    for name, value in tokens:
        lines.append(f"| `{name}` | `{value.strip()}` | {css.count(f'var({name})')} |")
    lines += ["", f"화면 폭 구간(px): {' / '.join(map(str, breakpoints))}", "", f"클래스 {len(classes)}개:", "", "```"]
    lines.append(" ".join("." + c for c in classes))
    lines += ["```", END]
    return "\n".join(lines)


def main() -> int:
    css = CSS.read_text(encoding="utf-8")
    text = PROMPT.read_text(encoding="utf-8")
    if START not in text or END not in text:
        print(f"표시가 없습니다: {PROMPT}", file=sys.stderr)
        return 1
    head, rest = text.split(START, 1)
    _, tail = rest.split(END, 1)
    PROMPT.write_text(head + build_block(css) + tail, encoding="utf-8")
    print(f"갱신했습니다: {PROMPT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
