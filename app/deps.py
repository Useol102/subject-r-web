"""인증 의존성 — 기능 `시스템-권한관리`.

역할 위계: admin > staff > viewer

    Depends(require_role("staff"))  ->  staff 이상만 통과 (admin 포함)

로봇은 사람 계정이 아니다. 로봇 API는 이 의존성을 쓰지 않는다.
(로봇 인증은 별도 과제 — `로봇-상태보고` 만들 때 다룬다)
"""
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.security import decode_token

oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

ROLE_RANK = {"viewer": 1, "staff": 2, "admin": 3}


def get_current_user(
    token: str | None = Depends(oauth2),
    db: Session = Depends(get_db),
) -> models.AppUser:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "로그인이 필요하다",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise unauthorized
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "토큰이 만료됐다. 다시 로그인할 것",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except jwt.PyJWTError as e:
        raise unauthorized from e

    user = db.get(models.AppUser, int(payload.get("sub", 0)))
    if not user or not user.is_active:
        raise unauthorized
    return user


def require_role(minimum: str) -> Callable:
    """minimum 이상의 역할만 통과시킨다."""
    need = ROLE_RANK[minimum]

    def checker(user: models.AppUser = Depends(get_current_user)) -> models.AppUser:
        have = ROLE_RANK.get(
            user.role.value if hasattr(user.role, "value") else str(user.role), 0
        )
        if have < need:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"권한이 부족하다. 이 작업은 {minimum} 이상이 필요하다",
            )
        return user

    return checker
