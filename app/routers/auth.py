"""로그인 — 기능 `직원-로그인`, `직원-계정관리`.

노인 이용자는 여기 등장하지 않는다. 로봇 터치스크린은 로그인 없이 쓴다.
이 API는 복지관 직원과 우리 팀만 쓴다.
"""
import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_role
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth (인증)"])


@router.post("/login", response_model=schemas.TokenOut)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    """`직원-로그인`.

    이메일이 없는 경우와 비밀번호가 틀린 경우를 **같은 메시지로** 돌려준다.
    구분해서 알려주면 어떤 이메일이 가입돼 있는지 알아낼 수 있다.
    """
    user = db.scalar(select(models.AppUser).where(models.AppUser.email == body.email))
    fail = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "이메일 또는 비밀번호가 맞지 않다"
    )
    if not user or not verify_password(body.password, user.hashed_password):
        raise fail
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "비활성화된 계정이다")

    user.last_login_at = dt.datetime.now(dt.timezone.utc)
    db.commit()
    db.refresh(user)

    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    return schemas.TokenOut(
        access_token=create_access_token(user.id, role),
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        user=schemas.UserOut.model_validate(user),
    )


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.AppUser = Depends(get_current_user)):
    """내 정보. 프론트가 새로고침 후 로그인 상태를 확인할 때 쓴다."""
    return user


@router.post("/change-password", status_code=204)
def change_password(body: schemas.PasswordChange,
                    user: models.AppUser = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(400, "현재 비밀번호가 맞지 않다")
    user.hashed_password = hash_password(body.new_password)
    db.commit()


# ---------------------------------------------------------------- 계정 관리
users = APIRouter(prefix="/users", tags=["users (계정)"])


@users.get("", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db),
               _: models.AppUser = Depends(require_role("admin"))):
    """`직원-계정관리`."""
    return db.scalars(select(models.AppUser).order_by(models.AppUser.email)).all()


@users.post("", response_model=schemas.UserOut, status_code=201)
def create_user(body: schemas.UserCreate, db: Session = Depends(get_db),
                _: models.AppUser = Depends(require_role("admin"))):
    u = models.AppUser(
        email=body.email, hashed_password=hash_password(body.password),
        display_name=body.display_name, role=body.role,
        facility_id=body.facility_id, is_active=True,
    )
    db.add(u)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(409, f"이미 있는 이메일이다: {body.email}") from e
    db.refresh(u)
    return u


@users.delete("/{user_id}", response_model=schemas.UserOut)
def deactivate_user(user_id: int, db: Session = Depends(get_db),
                    me_: models.AppUser = Depends(require_role("admin"))):
    """계정 비활성화. 물리 삭제하지 않는다 — 과거 trip이 참조한다."""
    if user_id == me_.id:
        raise HTTPException(400, "자기 계정은 비활성화할 수 없다")
    u = db.get(models.AppUser, user_id)
    if not u:
        raise HTTPException(404, f"user {user_id} 없음")

    if u.role.value == "admin" or str(u.role) == "admin":
        n = db.scalar(select(func.count()).select_from(models.AppUser).where(
            models.AppUser.role == "admin", models.AppUser.is_active.is_(True)))
        if n <= 1:
            raise HTTPException(409, "마지막 admin 계정은 비활성화할 수 없다")

    u.is_active = False
    db.commit()
    db.refresh(u)
    return u
