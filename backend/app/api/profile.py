from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.profile import derive, normalize
from app.api.deps import family_to_dict, get_or_create_profile, profile_to_dict
from app.core.security import get_current_user, _bearer, decode_token
from app.database import get_db
from app.models.models import FamilyMember, Profile, User, AuditLog, LoginAttempt, TokenBlocklist
from app.schemas.schemas import FamilyIn, ProfileIn
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timezone

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("")
def get_profile(user: User = Depends(get_current_user)):
    return profile_to_dict(user.profile)


@router.put("")
def update_profile(data: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = get_or_create_profile(db, user)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    
    from app.services.sheets_sync import sync_record, user_row
    sync_record("Users", user_row(user), id_column="user_id")
    
    return profile_to_dict(p)


@router.get("/completeness")
def completeness(user: User = Depends(get_current_user)):
    p = user.profile
    from app.agents.eligibility_engine import schema_completeness

    return schema_completeness(profile_to_dict(p))


@router.get("/activity")
def get_activity(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter_by(actor_id=user.id).order_by(AuditLog.created_at.desc()).limit(50).all()
    return logs


@router.get("/security/sessions")
def get_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logins = db.query(LoginAttempt).filter_by(email=user.email, success=True).order_by(LoginAttempt.created_at.desc()).limit(10).all()
    return logins


@router.post("/logout")
def logout(
    user: User = Depends(get_current_user), 
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)
):
    if credentials:
        payload = decode_token(credentials.credentials)
        jti = payload.get("jti")
        if jti and not db.get(TokenBlocklist, jti):
            db.add(TokenBlocklist(jti=jti))
            db.commit()
    return {"ok": True}


@router.post("/logout-all")
def logout_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.sessions_valid_after = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# ---------------------------- Family --------------------------------------- #
@router.get("/family")
def list_family(user: User = Depends(get_current_user)):
    return [family_to_dict(m) for m in user.family]


@router.post("/family")
def add_family(data: FamilyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    exists = db.query(FamilyMember).filter_by(user_id=user.id, name=data.name.strip()).first()
    if exists:
        raise HTTPException(status_code=409, detail="A member with this name already exists")
    m = FamilyMember(user_id=user.id, **data.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return family_to_dict(m)


@router.put("/family/{member_id}")
def update_family(member_id: str, data: FamilyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.query(FamilyMember).filter_by(id=member_id, user_id=user.id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    for k, v in data.model_dump().items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return family_to_dict(m)


@router.delete("/family/{member_id}")
def delete_family(member_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.query(FamilyMember).filter_by(id=member_id, user_id=user.id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.post("/family/{member_id}/recommend")
def family_recommend(member_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Run the full agent workflow for a family member's synthetic profile."""
    m = db.query(FamilyMember).filter_by(id=member_id, user_id=user.id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    base = profile_to_dict(user.profile)
    merged = normalize({
        **base,
        "age": m.age, "gender": m.gender, "occupation": m.occupation,
        "annual_income": m.annual_income, "education": m.education,
        "disability": m.disability,
    })
    if m.is_student:
        merged["occupation"] = "student"
    from app.agents.agents import run_recommendation_workflow
    from app.api.deps import scheme_to_dict
    from app.models.models import Scheme

    schemes = [scheme_to_dict(s) for s in db.query(Scheme).filter_by(is_active=True).all()]
    result = run_recommendation_workflow(merged, schemes, check_fraud=False)
    top = result["recommendations"]["best_match"]
    return {
        "member": family_to_dict(m),
        "profile": merged,
        "scores": result["scores"][:10],
        "top_schemes": [r["scheme"] for r in result["recommendations"]["alternatives"]][:4],
        "explanation": result.get("explanation"),
    }
