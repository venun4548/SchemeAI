from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.api.deps import user_to_dict
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
    generate_citizen_id,
)
from app.database import get_db
from app.models.models import LoginAttempt, Profile, User
from app.schemas.schemas import LoginIn, RegisterIn, TokenOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    return (xff or request.client.host if request.client else "").split(",")[0].strip()


def _log_attempt(db: Session, email: str, success: bool, request: Request, reason: str = ""):
    db.add(LoginAttempt(
        email=email.lower(),
        success=success,
        ip=_client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:255],
        reason=reason,
    ))
    db.commit()


@router.post("/register", response_model=TokenOut)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=data.email.lower()).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        email=data.email.lower(),
        phone=data.phone,
        full_name=data.full_name.strip(),
        language=data.language,
        password_hash=hash_password(data.password),
        citizen_id=generate_citizen_id(db),
        is_verified=False,
    )
    db.add(user)
    db.flush()
    db.add(Profile(user_id=user.id))
    db.commit()
    db.refresh(user)

    from app.services.sheets_sync import sync_record, user_row
    sync_record("Users", user_row(user), id_column="user_id")

    return TokenOut(access_token=create_access_token(user), user=user_to_dict(user))


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        _log_attempt(db, data.email, False, request, reason="invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        _log_attempt(db, data.email, False, request, reason="account_disabled")
        raise HTTPException(status_code=403, detail="Account is disabled")
    user.last_login_at = datetime.now(timezone.utc)
    _log_attempt(db, data.email, True, request, reason="success")
    db.commit()
    db.refresh(user)

    from app.services.sheets_sync import sync_record, user_row, admin_row
    if user.role == "admin":
        sync_record("Admins", admin_row(user), id_column="admin_id")
    else:
        sync_record("Users", user_row(user), id_column="user_id")

    return TokenOut(access_token=create_access_token(user), user=user_to_dict(user))


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_to_dict(user)
