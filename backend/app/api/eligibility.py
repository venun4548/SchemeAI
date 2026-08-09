from __future__ import annotations

import json
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.agents import run_recommendation_workflow
from app.agents.eligibility_engine import score_scheme
from app.agents.graph import serialize_trace
from app.api.deps import profile_to_dict, scheme_to_dict
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import AgentRun, AnalyticsEvent, Scheme, User
from app.schemas.schemas import CompareIn

router = APIRouter(prefix="/eligibility", tags=["eligibility"])


def _log_agents(db: Session, user_id: str, run_id: str, state: dict) -> None:
    now = datetime.now(timezone.utc)
    for log in state.get("agent_logs", []):
        db.add(AgentRun(run_id=run_id, user_id=user_id, agent_name=log["agent"],
                        task=log["task"], status="completed",
                        result={"detail": log.get("detail", "")},
                        duration_ms=state.get("runtime_ms", 0) // max(len(state.get("agent_logs", [])) or 1, 1),
                        created_at=now))
    db.commit()


def _build_context(user: User, db: Session) -> tuple[dict, list[dict]]:
    profile = profile_to_dict(user.profile)
    schemes = [scheme_to_dict(s) for s in db.query(Scheme).filter_by(is_active=True).all()]
    return profile, schemes


@router.get("/score")
def overall_score(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Eligibility score for the current user across all schemes."""
    profile, schemes = _build_context(user, db)
    run_id = _runid()
    result = run_recommendation_workflow(profile, schemes)
    _log_agents(db, user.id, run_id, result)
    scores = result["scores"]
    top = scores[0] if scores else None
    avg = round(sum(s["score"] for s in scores) / len(scores), 1) if scores else 0
    high = len([s for s in scores if s["score"] >= 75])
    partial = len([s for s in scores if 45 <= s["score"] < 75])
    return {
        "top_score": top,
        "average_score": avg,
        "counts": {"high": high, "partial": partial, "low": len(scores) - high - partial},
        "total_schemes": len(scores),
        "profile_completeness": top.get("profile_completeness", 0) if top else 0,
        "run_id": run_id,
        "trace": serialize_trace(result.get("__trace__", [])),
        "agent_logs": result.get("agent_logs", []),
        "runtime_ms": result.get("runtime_ms", 0),
    }


@router.get("/score/{scheme_id}")
def scheme_score(scheme_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.get(Scheme, scheme_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")
    profile = profile_to_dict(user.profile)
    result = score_scheme(profile, scheme_to_dict(s))
    result["official_link"] = s.official_link
    result["application_portal"] = s.application_portal
    result["amount"] = s.amount
    result["amount_max"] = s.amount_max
    return result


@router.post("/evaluate")
def evaluate(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Score a partial or ad-hoc profile payload."""
    profile = profile_to_dict(user.profile)
    profile.update(payload.get("profile", {}))
    schemes = [scheme_to_dict(s) for s in db.query(Scheme).filter_by(is_active=True).all()]
    result = run_recommendation_workflow(profile, schemes)
    return {
        "scores": result["scores"][:15],
        "top_score": result["scores"][0] if result["scores"] else None,
        "trace": serialize_trace(result.get("__trace__", [])),
    }


@router.get("/recommendations")
def recommendations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Full multi-agent pipeline: profiling -> eligibility -> policy -> recommender
    -> explainability -> guidance -> fraud -> documents."""
    profile, schemes = _build_context(user, db)
    from app.models.models import SavedScheme, Application

    saved_ids = {r.scheme_id for r in db.query(SavedScheme).filter_by(user_id=user.id).all()}
    applied_ids = {a.scheme_id for a in db.query(Application).filter_by(user_id=user.id).all()}
    uploaded_docs = {d.doc_type for d in user.documents}

    run_id = _runid()
    t0 = time.perf_counter()
    result = run_recommendation_workflow(
        profile, schemes, saved_scheme_ids=saved_ids, applied_scheme_ids=applied_ids,
        uploaded_docs=uploaded_docs, check_fraud=False,
    )
    result["runtime_ms"] = int((time.perf_counter() - t0) * 1000)
    _log_agents(db, user.id, run_id, result)

    db.add(AnalyticsEvent(user_id=user.id, event_type="recommendation_click",
                          state=profile.get("state", ""), metadata={"run": run_id}))
    db.commit()

    recs = result["recommendations"]
    return {
        "goal": recs["goal"],
        "best_match": _serialize_match(recs["best_match"]),
        "second_best": _serialize_match(recs["second_best"]),
        "alternatives": [_serialize_match(m) for m in recs["alternatives"]],
        "total_matches": recs["total_matches"],
        "explanation": result.get("explanation"),
        "guidance": result.get("guidance"),
        "fraud_flags": result.get("fraud_flags", []),
        "document_status": result.get("document_status", {}),
        "policy_snippets": result.get("policy_snippets", []),
        "agent_logs": result.get("agent_logs", []),
        "trace": serialize_trace(result.get("__trace__", [])),
        "runtime_ms": result["runtime_ms"],
        "run_id": run_id,
    }


def _serialize_match(match: dict | None) -> dict | None:
    if not match:
        return None
    return {
        "scheme": match["scheme"],
        "score": match["score"]["score"],
        "confidence": match["score"]["confidence"],
        "status": match["score"]["status"],
        "approval_probability": match["score"]["approval_probability"],
        "matched_rules": match["score"]["matched_rules"],
        "missing_rules": match["score"]["missing_rules"],
        "next_steps": match["score"]["next_steps"],
        "final_score": match["final_score"],
        "is_saved": match["is_saved"],
        "has_applied": match["has_applied"],
    }


def _runid() -> str:
    return f"{datetime.now(timezone.utc).strftime('%H%M%S')}{int(time.time() * 1000) % 100000}"


@router.post("/compare")
def compare(data: CompareIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.models import Comparison
    from app.services.comparison import analyze_comparison

    schemes = []
    scores = []
    for sid in data.scheme_ids:
        s = db.get(Scheme, sid)
        if not s:
            raise HTTPException(status_code=404, detail=f"Scheme {sid} not found")
        sd = scheme_to_dict(s)
        schemes.append(sd)
        sc = score_scheme(profile_to_dict(user.profile), sd)
        scores.append({"score": sc})

    analysis = analyze_comparison(schemes, scores)
    comp = Comparison(user_id=user.id, scheme_ids=data.scheme_ids, ai_analysis=analysis)
    db.add(comp)
    db.commit()
    return {"schemes": schemes, "scores": scores, "analysis": analysis, "comparison_id": comp.id}
