import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.models import User, TokenBlocklist
import string
import random

_PBKDF2_ITERATIONS = 260_000

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def generate_citizen_id(db: Session) -> str:
    """Generates a permanent, unique public Citizen ID for a user."""
    chars = string.ascii_uppercase + string.digits
    while True:
        random_str = ''.join(secrets.choice(chars) for _ in range(8))
        citizen_id = f"SCAI-CIT-{random_str}"
        if not db.query(User).filter_by(citizen_id=citizen_id).first():
            return citizen_id


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt_hex, digest_hex = stored.split("$")
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iters)
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(user: User, secondary_verified: bool = False) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "secondary_verified": secondary_verified,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        ) from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    
    jti = payload.get("jti")
    if jti and db.get(TokenBlocklist, jti):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Account is inactive")
        
    iat = payload.get("iat")
    if iat and user.sessions_valid_after:
        iat_dt = datetime.fromtimestamp(iat, tz=timezone.utc)
        valid_after = user.sessions_valid_after
        if valid_after.tzinfo is None:
            valid_after = valid_after.replace(tzinfo=timezone.utc)
        if iat_dt < valid_after:
            raise HTTPException(status_code=401, detail="Session expired")
            
    # Attach transient token claims to user object
    user.secondary_verified = payload.get("secondary_verified", False)
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    """Return the authenticated user, or None for anonymous visitors (used by the chat API)."""
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        jti = payload.get("jti")
        if jti and db.get(TokenBlocklist, jti):
            return None
    except HTTPException:
        return None
        
    user = db.get(User, payload.get("sub"))
    if user is None or not user.is_active:
        return None
        
    iat = payload.get("iat")
    if iat and user.sessions_valid_after:
        iat_dt = datetime.fromtimestamp(iat, tz=timezone.utc)
        valid_after = user.sessions_valid_after
        if valid_after.tzinfo is None:
            valid_after = valid_after.replace(tzinfo=timezone.utc)
        if iat_dt < valid_after:
            return None
            
    user.secondary_verified = payload.get("secondary_verified", False)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if not getattr(user, "secondary_verified", False):
        raise HTTPException(
            status_code=403,
            detail="Admin secondary security verification required. Access denied."
        )
    return user
