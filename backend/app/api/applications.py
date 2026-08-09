from __future__ import annotations

import base64
import json
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.agents.eligibility_engine import score_scheme
from app.api.deps import profile_to_dict, scheme_to_dict
from app.core.rbac import require_permission
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import AnalyticsEvent, Application, Scheme, User
from app.schemas.schemas import ApplyIn, StatusIn
from app.services.notify import notify
from app.services.qr_service import application_qr_payload, make_qr

router = APIRouter(prefix="/applications", tags=["applications"])

STATUS_FLOW = ["draft", "in_progress", "submitted", "under_review", "approved", "disbursed", "rejected"]
VALID_STATUSES = set(STATUS_FLOW)


def _steps_for(scheme: dict) -> list[dict]:
    return [
        {"step": 1, "title": f"Visit {scheme.get('application_portal') or 'official portal'}",
         "detail": "Open the official application portal."},
        {"step": 2, "title": "Login",
         "detail": "Login with Aadhaar-linked mobile or email."},
        {"step": 3, "title": "Upload Aadhaar",
         "detail": "Upload a clear Aadhaar image."},
        {"step": 4, "title": "Upload Income Certificate",
         "detail": "Upload the revenue department income certificate."},
        {"step": 5, "title": "Submit Application",
         "detail": "Review and submit. Note the reference number."},
    ]


def _app_out(a: Application, with_qr: bool = False) -> dict:
    d = {
        "id": a.id, "application_id": a.application_id, "scheme_id": a.scheme_id,
        "scheme_name": a.qr_payload.get("scheme", ""),
        "applicant_name": a.applicant_name, "status": a.status,
        "current_step": a.current_step, "steps": a.steps, "timeline": a.timeline,
        "document_ids": a.document_ids, "risk_flags": a.risk_flags,
        "eligibility_score": a.eligibility_score, "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }
    if with_qr:
        d["qr_payload"] = a.qr_payload
        d["qr_b64"] = base64.b64encode(make_qr(a.qr_payload)).decode()
    return d


def _gen_application_id() -> str:
    return "SCAI" + datetime.now(timezone.utc).strftime("%Y") + secrets.token_hex(4).upper()


@router.post("")
def apply(data: ApplyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scheme = db.get(Scheme, data.scheme_id)
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
    if db.query(Application).filter_by(user_id=user.id, scheme_id=data.scheme_id).filter(
            Application.status.notin_(["rejected"])).first():
        raise HTTPException(status_code=409, detail="You already have an application for this scheme")

    profile = profile_to_dict(user.profile)
    result = score_scheme(profile, scheme_to_dict(scheme))
    steps = _steps_for(scheme_to_dict(scheme))

    member = None
    applicant = data.applicant_name or user.full_name
    if data.family_member_id:
        member = next((m for m in user.family if m.id == data.family_member_id), None)
        if member:
            applicant = member.name

    now = datetime.now(timezone.utc)
    app = Application(
        application_id=_gen_application_id(),
        user_id=user.id,
        family_member_id=data.family_member_id,
        scheme_id=data.scheme_id,
        status="draft",
        applicant_name=applicant,
        current_step=1,
        steps=steps,
        timeline=[{"ts": now.isoformat(), "status": "draft", "note": "Application created by AI guidance"}],
        qr_payload=application_qr_payload("", user.id, scheme.name, "draft"),
        document_ids=[d.id for d in user.documents],
        risk_flags=[],
        eligibility_score=result["score"],
    )
    app.qr_payload = application_qr_payload(app.application_id, user.id, scheme.name, app.status)
    db.add(app)
    db.commit()
    db.refresh(app)

    db.add(AnalyticsEvent(user_id=user.id, event_type="apply", scheme_id=scheme.id,
                          state=profile.get("state", "")))
    db.commit()
    db.refresh(app)

    from app.services.sheets_sync import sync_record, application_row
    sync_record("Applications", application_row(app), id_column="application_id")

    return _app_out(app, with_qr=True)


@router.get("")
def list_applications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    apps = db.query(Application).filter_by(user_id=user.id).order_by(Application.created_at.desc()).all()
    return {"items": [_app_out(a) for a in apps], "total": len(apps)}


@router.get("/{application_id}")
def get_application(application_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    app = db.query(Application).filter_by(id=application_id, user_id=user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return _app_out(app, with_qr=True)


@router.post("/{application_id}/advance")
def advance_application(application_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Move a draft one step forward in the guidance roadmap (simulates portal progress)."""
    app = db.query(Application).filter_by(id=application_id, user_id=user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    total = len(app.steps)
    if app.current_step < total:
        app.current_step += 1
        now = datetime.now(timezone.utc)
        step = app.steps[app.current_step - 1]
        app.timeline.append({"ts": now.isoformat(), "status": "in_progress",
                             "note": f"Completed step {app.current_step}: {step.get('title', '')}"})
    if app.current_step >= total and app.status == "draft":
        app.status = "submitted"
        now = datetime.now(timezone.utc)
        app.timeline.append({"ts": now.isoformat(), "status": "submitted", "note": "Application submitted to portal"})
        app.qr_payload = application_qr_payload(app.application_id, user.id,
                                                app.qr_payload.get("scheme", ""), app.status)
        notify(db, user.id, "application", "Application submitted",
               f"{app.qr_payload.get('scheme', '')} application {app.application_id} submitted successfully.",
               link=f"/applications/{app.id}", priority="high")
    db.commit()
    db.refresh(app)

    from app.services.sheets_sync import sync_record, application_row
    sync_record("Applications", application_row(app), id_column="application_id")

    return _app_out(app, with_qr=True)


@router.get("/verify/{app_ref}")
def verify_public(app_ref: str, db: Session = Depends(get_db)):
    """Public QR verification endpoint - no auth required."""
    app = db.query(Application).filter_by(application_id=app_ref).first()
    if not app:
        return {"valid": False, "message": "Application not found in registry"}
    return {
        "valid": True,
        "application_id": app.application_id,
        "scheme": app.qr_payload.get("scheme", ""),
        "status": app.status,
        "timestamp": app.qr_payload.get("timestamp", ""),
        "eligibility_score": app.eligibility_score,
    }


@router.get("/{application_id}/qr")
def application_qr(application_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    app = db.query(Application).filter_by(id=application_id, user_id=user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    png = make_qr(app.qr_payload)
    return Response(content=png, media_type="image/png",
                    headers={"Content-Disposition": f'inline; filename="{app.application_id}.png"'})


@router.get("/{application_id}/pdf")
def application_pdf(application_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.pdf_service import build_application_pdf

    app = db.query(Application).filter_by(id=application_id, user_id=user.id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    payload = {
        "application_id": app.application_id,
        "scheme_name": app.qr_payload.get("scheme", ""),
        "applicant_name": app.applicant_name,
        "status": app.status,
        "current_step": app.current_step,
        "steps": app.steps,
        "timeline": app.timeline,
        "eligibility_score": app.eligibility_score or 0,
        "qr": base64.b64encode(make_qr(app.qr_payload)).decode(),
    }
    pdf = build_application_pdf(payload)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{app.application_id}.pdf"'})


@router.post("/{application_id}/status", dependencies=[Depends(require_permission("apps.*"))])
def set_status(application_id: str, data: StatusIn, db: Session = Depends(get_db)):
    app = db.get(Application, application_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    app.status = data.status
    now = datetime.now(timezone.utc)
    app.timeline.append({"ts": now.isoformat(), "status": data.status, "note": data.note or "Status updated"})
    app.qr_payload = application_qr_payload(app.application_id, app.user_id,
                                            app.qr_payload.get("scheme", ""), app.status)
    db.commit()
    notify(db, app.user_id, "application", f"Application {data.status}",
           f"{app.qr_payload.get('scheme', '')}: {data.note or 'Your application status changed'}",
           link=f"/applications/{app.id}", priority="high" if data.status in ("approved", "rejected", "disbursed") else "normal")
    db.refresh(app)

    from app.services.sheets_sync import sync_record, application_row
    sync_record("Applications", application_row(app), id_column="application_id")

    return _app_out(app)
