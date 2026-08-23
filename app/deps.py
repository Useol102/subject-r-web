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
from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import Header

from app import models
from app.db import get_db
from app.security import api_key_matches, decode_token, hash_api_key

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


# ---------------------------------------------------------------- 로봇 인증
def get_current_robot(
    x_robot_key: str | None = Header(default=None, alias="X-Robot-Key"),
    db: Session = Depends(get_db),
) -> models.Robot:
    """로봇은 사람 계정과 다른 통로로 인증한다.

    사람 토큰(Authorization: Bearer)과 헤더를 나눈 이유:
    로봇 키는 만료가 없고 기기에 저장된다. 사람 세션과 섞으면
    "이 요청이 사람인가 기계인가"를 코드에서 헷갈리게 된다.
    """
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "로봇 인증이 필요하다 (X-Robot-Key 헤더)"
    )
    if not x_robot_key:
        raise unauthorized

    # SHA-256은 결정적이라 해시로 바로 찾는다 (전체 순회 불필요)
    robot = db.scalar(
        select(models.Robot).where(
            models.Robot.api_key_hash == hash_api_key(x_robot_key)
        )
    )
    if not robot or robot.deleted_at:
        raise unauthorized
    if not api_key_matches(x_robot_key, robot.api_key_hash or ""):
        raise unauthorized
    return robot


def robot_or_role(minimum: str) -> Callable:
    """로봇이거나, minimum 이상 역할의 사람이면 통과.

    안내 요청 생성처럼 **키오스크(로봇 위에서 돎)와 직원 대시보드가
    둘 다 호출하는** 엔드포인트에 쓴다.
    """
    need = ROLE_RANK[minimum]

    def checker(
        x_robot_key: str | None = Header(default=None, alias="X-Robot-Key"),
        token: str | None = Depends(oauth2),
        db: Session = Depends(get_db),
    ):
        if x_robot_key:
            return get_current_robot(x_robot_key, db)
        if token:
            user = get_current_user(token, db)
            have = ROLE_RANK.get(
                user.role.value if hasattr(user.role, "value") else str(user.role), 0
            )
            if have < need:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    f"권한이 부족하다. {minimum} 이상 또는 로봇 키가 필요하다",
                )
            return user
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "인증이 필요하다 (로그인 토큰 또는 X-Robot-Key)",
        )

    return checker
