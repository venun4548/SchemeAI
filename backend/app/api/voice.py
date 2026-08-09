from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.agents import run_recommendation_workflow
from app.api.deps import profile_to_dict, scheme_to_dict
from app.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import Application, GovernmentOffice, Notification, Scheme, User
from app.schemas.schemas import VoiceCommandIn
from app.services.voice import detect_intent, respond

router = APIRouter(prefix="/voice", tags=["voice"])


@router.get("/languages")
def languages():
    return {"languages": settings.SUPPORTED_LANGUAGES}


@router.post("/command")
def command(data: VoiceCommandIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    intent = detect_intent(data.text)

    context: dict = {}
    profile = profile_to_dict(user.profile)

    if intent in ("find_schemes", "eligibility_explain", "documents"):
        schemes = [scheme_to_dict(s) for s in db.query(Scheme).filter_by(is_active=True).all()]
        result = run_recommendation_workflow(profile, schemes)
        recs = result["recommendations"]
        context["recommendations"] = [
            {
                "name": m["scheme"]["name"],
                "score": m["score"]["score"],
                "status": m["score"]["status"],
            }
            for m in ([recs["best_match"], recs["second_best"]] + recs["alternatives"])
            if m
        ]
        context["explanation"] = result.get("explanation")
        context["document_status"] = result.get("document_status", {})
        context["profile"] = profile

    if intent == "track_application":
        apps = db.query(Application).filter_by(user_id=user.id) \
            .order_by(Application.created_at.desc()).all()
        context["applications"] = [
            {
                "application_id": a.application_id,
                "scheme_name": a.qr_payload.get("scheme", ""),
                "status": a.status,
                "current_step": a.current_step,
                "steps": a.steps,
            } for a in apps
        ]

    if intent == "office":
        offices = db.query(GovernmentOffice).limit(3).all()
        context["offices"] = [
            {"name": o.name, "district": o.district,
             "distance_km": 0.0} for o in offices
        ]

    if intent in ("deadlines", "notifications"):
        context["deadlines"] = []
        for n in db.query(Notification).filter_by(user_id=user.id, type="deadline").limit(3).all():
            context["deadlines"].append(n.title)
        context["unread_count"] = db.query(Notification).filter_by(user_id=user.id, is_read=False).count()

    reply = respond(intent, context, data.language)
    return {"intent": intent, "reply": reply, "context": {k: v for k, v in context.items() if k != "recommendations"}}
