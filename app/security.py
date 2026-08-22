"""비밀번호 해싱과 토큰 — 기능 `직원-로그인`, `시스템-권한관리`.

passlib을 쓰지 않는다. bcrypt 4.x 이후 호환이 깨져 있다.
bcrypt를 직접 쓴다.
"""
import datetime as dt

import bcrypt
import jwt

from app.config import settings

ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    # bcrypt는 72바이트까지만 본다. 그 이상은 조용히 잘리므로 미리 자른다.
    return bcrypt.hashpw(plain.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode()[:72], hashed.encode())
    except ValueError:
        # 해시 형식이 깨진 경우. 로그인 실패로 처리한다.
        return False


def create_access_token(user_id: int, role: str) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + dt.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """만료·서명 오류는 예외를 그대로 올린다. 라우터에서 401로 바꾼다."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
