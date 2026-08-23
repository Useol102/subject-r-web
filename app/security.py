"""비밀번호 해싱과 토큰 — 기능 `직원-로그인`, `시스템-권한관리`.

passlib을 쓰지 않는다. bcrypt 4.x 이후 호환이 깨져 있다.
bcrypt를 직접 쓴다.
"""
import datetime as dt
import hashlib
import hmac
import secrets

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


# ---------------------------------------------------------------- 로봇 API 키
API_KEY_PREFIX = "sbr_"


def generate_api_key() -> str:
    """로봇용 API 키. 평문은 발급 순간에만 존재한다."""
    return API_KEY_PREFIX + secrets.token_urlsafe(32)


def hash_api_key(key: str) -> str:
    """SHA-256으로 해싱한다. bcrypt를 쓰지 않는 이유가 두 가지 있다.

    1. 속도 — 로봇이 1Hz로 보고하면 요청마다 bcrypt를 돌리는 건 부담이다.
    2. 조회 — bcrypt는 salt가 매번 달라 해시로 바로 찾을 수 없다.
       모든 로봇을 순회하며 비교해야 한다. SHA-256은 결정적이라 인덱스로 찾는다.

    사람 비밀번호와 달리 API 키는 우리가 만든 256비트 난수다.
    사전 공격 대상이 아니므로 느린 해시가 필요 없다.
    """
    return hashlib.sha256(key.encode()).hexdigest()


def api_key_matches(key: str, stored_hash: str) -> bool:
    """타이밍 공격을 피하려고 compare_digest를 쓴다."""
    return hmac.compare_digest(hash_api_key(key), stored_hash)
