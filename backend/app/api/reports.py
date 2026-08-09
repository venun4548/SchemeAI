from __future__ import annotations

import base64
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.agents.agents import run_recommendation_workflow
from app.api.deps import profile_to_dict, scheme_to_dict
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import Scheme, User
from app.services.notify import send_report_by_email
from app.services.pdf_service import build_comparison_report, build_eligibility_report
from app.services.qr_service import make_qr

router = APIRouter(prefix="/reports", tags=["reports"])


def _eligibility_payload(user: User, db: Session) -> dict:
    profile = profile_to_dict(user.profile)
    schemes = [scheme_to_dict(s) for s in db.query(Scheme).filter_by(is_active=True).all()]
    result = run_recommendation_workflow(profile, schemes)
    link_map = {s["id"]: s.get("official_link", "") for s in schemes}
    for sc in result["scores"]:
        sc["official_link"] = link_map.get(sc["scheme_id"], "")
    qr_payload = {
        "type": "schemeai_eligibility_report",
        "user_id": user.id,
        "timestamp": datetime.now().isoformat(),
    }
    return {
        "profile": {**profile, "full_name": user.full_name, "email": user.email},
        "scores": result["scores"][:8],
        "explanation": result.get("explanation"),
        "guidance": result.get("guidance"),
        "document_status": result.get("document_status", {}),
        "runtime_ms": result.get("runtime_ms", 0),
        "qr": base64.b64encode(make_qr(qr_payload)).decode(),
    }


@router.get("/eligibility/pdf")
def eligibility_report(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pdf = build_eligibility_report(_eligibility_payload(user, db))
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": 'inline; filename="schemeai-eligibility-report.pdf"'})


@router.post("/eligibility/email")
def email_eligibility_report(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pdf = build_eligibility_report(_eligibility_payload(user, db))
    sent = send_report_by_email(db, user, pdf, "Your SchemeAI Eligibility Report")
    if not sent:
        raise HTTPException(status_code=501, detail="SMTP is not configured. Add SMTP_* env vars to enable email.")
    return {"sent": True}


@router.post("/comparison/pdf")
def comparison_report(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = payload.get("scheme_ids", [])
    schemes = []
    for sid in ids:
        s = db.get(Scheme, sid)
        if s:
            schemes.append(scheme_to_dict(s))
    analysis = payload.get("analysis") or {}
    pdf = build_comparison_report({"schemes": schemes, "analysis": analysis})
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": 'inline; filename="schemeai-comparison.pdf"'})
