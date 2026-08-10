from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.eligibility_engine import evaluate_scheme_tri
from app.agents.investigator import run_eligibility_evaluation, run_investigation
from app.api.deps import profile_to_dict, scheme_to_dict
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import (
    AgentExecution,
    Investigation,
    InvestigationResult,
    Scheme,
    User,
)

router = APIRouter(prefix="/investigator", tags=["investigator"])


class InvestigateIn(BaseModel):
    scheme_id: str | None = None


def _user_context(user: User) -> tuple[set, dict]:
    uploaded = {d.doc_type for d in user.documents}
    expiry = {d.doc_type: d.expiry_date for d in user.documents if d.expiry_date}
    return uploaded, expiry


def _scheme_name(db: Session, scheme_id: str | None) -> str:
    if not scheme_id:
        return ""
    s = db.get(Scheme, scheme_id)
    return s.name if s else ""


@router.post("/start")
def start_investigation(
    data: InvestigateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run the six-agent scheme investigator for the current user.

    With no scheme_id the whole catalogue is investigated; with a scheme_id
    the run focuses on that scheme (deep-dive) and ranks the rest around it.
    """
    from app.models.models import Application, SavedScheme

    profile = profile_to_dict(user.profile)
    query = db.query(Scheme).filter_by(is_active=True)
    if data.scheme_id:
        s = db.get(Scheme, data.scheme_id)
        if not s or not s.is_active:
            raise HTTPException(status_code=404, detail="Scheme not found")
        query = query.filter(Scheme.id == data.scheme_id)
    schemes = [scheme_to_dict(s) for s in query.all()]
    if not schemes:
        raise HTTPException(status_code=404, detail="No active schemes to investigate")

    uploaded, expiry = _user_context(user)
    saved_ids = {r.scheme_id for r in db.query(SavedScheme).filter_by(user_id=user.id).all()}
    applied_ids = {a.scheme_id for a in db.query(Application).filter_by(user_id=user.id).all()}

    return run_investigation(
        db, user, profile, schemes,
        focus_scheme_id=data.scheme_id,
        scheme_name=_scheme_name(db, data.scheme_id),
        saved_scheme_ids=saved_ids,
        applied_scheme_ids=applied_ids,
        uploaded_docs=uploaded,
        doc_expiry=expiry,
    )


@router.get("/history")
def investigation_history(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(Investigation).filter_by(user_id=user.id) \
        .order_by(Investigation.created_at.desc()).limit(limit).all()
    return {
        "items": [
            {
                "investigation_id": i.id,
                "status": i.status,
                "focus": i.focus,
                "scheme_id": i.scheme_id,
                "scheme_name": i.scheme_name,
                "total_schemes": i.total_schemes,
                "summary": i.summary,
                "elapsed_ms": i.elapsed_ms,
                "created_at": i.created_at.isoformat() if i.created_at else None,
                "completed_at": i.completed_at.isoformat() if i.completed_at else None,
            }
            for i in rows
        ],
        "total": len(rows),
    }


@router.get("/history/{investigation_id}")
def investigation_detail(
    investigation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.get(Investigation, investigation_id)
    if not inv or inv.user_id != user.id:
        raise HTTPException(status_code=404, detail="Investigation not found")

    results = db.query(InvestigationResult).filter_by(investigation_id=inv.id) \
        .order_by(InvestigationResult.rank).all()
    executions = db.query(AgentExecution).filter_by(investigation_id=inv.id) \
        .order_by(AgentExecution.step).all()
    return {
        "investigation_id": inv.id,
        "run_id": inv.run_id,
        "status": inv.status,
        "focus": inv.focus,
        "scheme_id": inv.scheme_id,
        "scheme_name": inv.scheme_name,
        "summary": inv.summary,
        "total_schemes": inv.total_schemes,
        "elapsed_ms": inv.elapsed_ms,
        "error": inv.error,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "completed_at": inv.completed_at.isoformat() if inv.completed_at else None,
        "agent_executions": [
            {
                "step": e.step, "agent_key": e.agent_key, "agent_name": e.agent_name,
                "status": e.status, "task": e.task, "detail": e.detail,
                "duration_ms": e.duration_ms,
            }
            for e in executions
        ],
        "recommendations": [
            {
                "rank": r.rank, "scheme_id": r.scheme_id, "scheme_name": r.scheme_name,
                "category": r.category, "eligibility_status": r.eligibility_status,
                "score": r.score, "confidence": r.confidence,
                "matched_count": r.matched_count, "failed_count": r.failed_count,
                "unknown_count": r.unknown_count, "reasons": r.reasons,
                "next_steps": r.next_steps, "document_status": r.document_status,
                **(r.detail or {}),
            }
            for r in results
        ],
    }


@router.get("/evaluate/{scheme_id}")
def why_not_eligible(
    scheme_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Explainable "Why am I not eligible?" deep-dive for one scheme."""
    s = db.get(Scheme, scheme_id)
    if not s or not s.is_active:
        raise HTTPException(status_code=404, detail="Scheme not found")
    profile = profile_to_dict(user.profile)
    uploaded, expiry = _user_context(user)
    evaluation = run_eligibility_evaluation(
        db, user, profile, scheme_to_dict(s), uploaded_docs=uploaded, doc_expiry=expiry,
    )

    # Find alternative schemes: top 3 other schemes by tri score.
    alternatives = []
    for other in db.query(Scheme).filter(Scheme.is_active.is_(True), Scheme.id != scheme_id).all():
        ev = evaluate_scheme_tri(profile, scheme_to_dict(other))
        alternatives.append({
            "scheme_id": other.id, "scheme_name": other.name,
            "status": ev["status"], "category": ev["category"],
            "score": ev["score"], "confidence": ev["confidence"],
            "official_link": other.official_link,
        })
    alternatives.sort(key=lambda a: a["score"], reverse=True)
    evaluation["alternatives"] = alternatives[:4]

    return evaluation
