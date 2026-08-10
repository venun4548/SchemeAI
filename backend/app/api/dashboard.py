from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.agents import run_recommendation_workflow
from app.api.deps import profile_to_dict, scheme_to_dict
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import (
    Application,
    FamilyMember,
    NewsItem,
    Notification,
    SavedScheme,
    Scheme,
    User,
    SupportCase,
    EligibilityEvaluation,
    AnalyticsEvent,
)
from app.schemas.schemas import FeedbackIn

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/home")
def dashboard_home(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Aggregate everything the dashboard home renders in one call."""
    profile = profile_to_dict(user.profile)
    schemes = [scheme_to_dict(s) for s in db.query(Scheme).filter_by(is_active=True).all()]

    saved_ids = {r.scheme_id for r in db.query(SavedScheme).filter_by(user_id=user.id).all()}
    applied_ids = {a.scheme_id for a in db.query(Application).filter_by(user_id=user.id).all()}
    uploaded_docs = {d.doc_type for d in user.documents}

    result = run_recommendation_workflow(
        profile, schemes, saved_scheme_ids=saved_ids, applied_scheme_ids=applied_ids,
        uploaded_docs=uploaded_docs, check_fraud=False,
    )
    recs = result["recommendations"]
    scores = result["scores"]
    avg = round(sum(s["score"] for s in scores) / len(scores), 1) if scores else 0
    top = scores[0] if scores else None

    apps = db.query(Application).filter_by(user_id=user.id).order_by(Application.created_at.desc()).all()
    active_apps = [a for a in apps if a.status not in ("approved", "rejected", "disbursed")]
    notifications = db.query(Notification).filter_by(user_id=user.id, is_read=False) \
        .order_by(Notification.created_at.desc()).limit(6).all()
    unread = db.query(Notification).filter_by(user_id=user.id, is_read=False).count()

    news = db.query(NewsItem).filter_by(is_new=True).order_by(NewsItem.published_at.desc()).limit(4).all()

    family = db.query(FamilyMember).filter_by(user_id=user.id).count()
    
    support_cases = db.query(SupportCase).filter_by(user_id=user.id).count()
    eligibility_checks = db.query(EligibilityEvaluation).filter_by(user_id=user.id).count()
    official_clicks = db.query(AnalyticsEvent).filter_by(user_id=user.id, event_type="open_official_portal").count()
    
    profile_completeness = round(sum(1 for f in ["age", "gender", "state", "occupation", "annual_income", "education"]
                                       if profile.get(f) not in (None, "", 0, False)) / 6 * 100)
    
    # Calculate journey stages
    journey = {
        "profile_created": profile_completeness > 0,
        "needs_identified": bool(profile.get("occupation") or profile.get("annual_income")),
        "schemes_discovered": bool(top),
        "eligibility_checked": eligibility_checks > 0,
        "eligibility_explained": eligibility_checks > 0,
        "documents_checked": len(uploaded_docs) > 0,
        "application_ready": len(uploaded_docs) >= 1 and eligibility_checks > 0,
        "official_application": official_clicks > 0,
        "track_status": len(apps) > 0,
        "support": support_cases > 0,
        "notifications": notifications_count > 0 if 'notifications_count' in locals() else len(notifications) > 0,
    }
    
    # Determine current stage string based on logic order
    current_stage = "CREATE PROFILE"
    if not journey["profile_created"] or profile_completeness < 100:
        current_stage = "CREATE PROFILE"
    elif not journey["needs_identified"]:
        current_stage = "UNDERSTAND NEEDS"
    elif not journey["schemes_discovered"]:
        current_stage = "DISCOVER SCHEMES"
    elif not journey["eligibility_checked"]:
        current_stage = "CHECK ELIGIBILITY"
    elif not journey["documents_checked"]:
        current_stage = "CHECK DOCUMENTS"
    elif not journey["application_ready"]:
        current_stage = "APPLICATION READY"
    elif not journey["official_application"]:
        current_stage = "OFFICIAL APPLICATION"
    elif not journey["track_status"]:
        current_stage = "TRACK STATUS"
    else:
        current_stage = "TRACK STATUS"

    return {
        "profile": profile,
        "profile_completeness": profile_completeness,
        "journey": journey,
        "current_stage": current_stage,
        "top_score": top,
        "average_score": avg,
        "counts": {
            "high": len([s for s in scores if s["score"] >= 75]),
            "partial": len([s for s in scores if 45 <= s["score"] < 75]),
            "low": len([s for s in scores if s["score"] < 45]),
        },
        "best_match": recs["best_match"],
        "second_best": recs["second_best"],
        "alternatives": recs["alternatives"][:3],
        "total_matches": recs["total_matches"],
        "explanation": result.get("explanation"),
        "guidance": result.get("guidance"),
        "document_status": result.get("document_status", {}),
        "agent_logs": result.get("agent_logs", []),
        "trace": result.get("__trace__", []),
        "saved_count": len(saved_ids),
        "active_applications": len(active_apps),
        "applications": [
            {"id": a.id, "application_id": a.application_id, "scheme_name": a.qr_payload.get("scheme", ""),
             "status": a.status, "current_step": a.current_step, "total_steps": len(a.steps or [])}
            for a in apps[:5]
        ],
        "notifications": [
            {"id": n.id, "type": n.type, "title": n.title, "body": n.body,
             "link": n.link, "priority": n.priority, "created_at": n.created_at.isoformat()}
            for n in notifications
        ],
        "unread_count": unread,
        "news": [
            {"id": n.id, "title": n.title, "category": n.category, "ai_summary": n.ai_summary,
             "published_at": n.published_at.isoformat() if n.published_at else None}
            for n in news
        ],
        "family_count": family,
        "uploaded_docs": len(user.documents),
        "runtime_ms": result.get("runtime_ms", 0),
    }


@router.get("/deadlines")
def upcoming_deadlines(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Simulated deadline feed from notifications + trending schemes."""
    now = datetime.now(timezone.utc)
    items = []
    trending = db.query(Scheme).filter_by(is_trending=True).all()
    from datetime import timedelta

    for i, s in enumerate(trending[:4]):
        items.append({
            "id": s.id, "title": s.name, "scheme_id": s.id,
            "due_in_days": 5 + i * 6,
            "date": (now + timedelta(days=5 + i * 6)).isoformat(),
            "kind": "scheme_window",
        })
    for n in db.query(Notification).filter_by(user_id=user.id, type="deadline").limit(3).all():
        items.append({"id": n.id, "title": n.title, "due_in_days": 7, "kind": "deadline"})
    items.sort(key=lambda x: x["due_in_days"])
    return {"items": items}


@router.post("/feedback")
def submit_feedback(data: FeedbackIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.models import Feedback

    f = Feedback(user_id=user.id, subject=data.subject, message=data.message, rating=data.rating)
    db.add(f)
    db.commit()
    return {"ok": True}
