"""첫 관리자 계정 만들기 — 기능 `직원-계정관리`.

계정 생성 API는 admin 권한이 필요한데, 첫 admin은 API로 만들 수 없다.
그래서 이 스크립트로 만든다.

실행:
    .\\.venv\\Scripts\\python.exe tools\\create_admin.py
    .\\.venv\\Scripts\\python.exe tools\\create_admin.py --email me@ex.com --reset
"""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app import models  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.security import hash_password  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email")
    ap.add_argument("--name", default="관리자")
    ap.add_argument("--password", help="생략하면 물어본다")
    ap.add_argument("--reset", action="store_true",
                    help="이미 있는 계정이면 비밀번호를 바꾼다")
    a = ap.parse_args()

    email = a.email or input("이메일: ").strip()
    if not email:
        print("이메일이 필요하다.")
        return 1

    pw = a.password
    if not pw:
        pw = getpass.getpass("비밀번호 (8자 이상): ")
        if pw != getpass.getpass("한 번 더: "):
            print("비밀번호가 서로 다르다.")
            return 1
    if len(pw) < 8:
        print("비밀번호는 8자 이상이어야 한다.")
        return 1

    db = SessionLocal()
    try:
        u = db.scalar(select(models.AppUser).where(models.AppUser.email == email))
        if u:
            if not a.reset:
                print(f"'{email}' 계정이 이미 있다. 비밀번호를 바꾸려면 --reset 을 붙일 것.")
                return 1
            u.hashed_password = hash_password(pw)
            u.is_active = True
            u.role = "admin"
            db.commit()
            print(f"'{email}' 비밀번호를 변경했다.")
        else:
            db.add(models.AppUser(
                email=email, hashed_password=hash_password(pw),
                display_name=a.name, role="admin", is_active=True,
            ))
            db.commit()
            print(f"관리자 계정 '{email}' 을 만들었다.")

        n = db.scalar(select(models.AppUser.id).where(
            models.AppUser.role == "admin", models.AppUser.is_active.is_(True)))
        print("\n로그인해볼 것:")
        print("  POST /auth/login  {\"email\": \"%s\", \"password\": \"...\"}" % email)
        print("  또는 http://localhost:8000/docs 에서 직접")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
