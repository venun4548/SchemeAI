"""Citizen-facing support centre: raise & track support cases."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.models import SupportCase, User
from app.schemas.schemas import SupportCaseIn

router = APIRouter(prefix="/support", tags=["support"])


def _case_ref(seq: int) -> str:
    return f"SR{datetime.now(timezone.utc).strftime('%y%m')}{seq:04d}"


def _sla_for(priority: str) -> datetime:
    hours = {"critical": 4, "high": 24, "medium": 48, "low": 72}.get(priority, 48)
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def _case_to_dict(c: SupportCase) -> dict:
    return {
        "id": c.id, "case_ref": c.case_ref, "subject": c.subject,
        "description": c.description, "issue_type": c.issue_type,
        "priority": c.priority, "status": c.status,
        "sla_due_at": c.sla_due_at.isoformat() if c.sla_due_at else None,
        "timeline": c.timeline or [],
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
    }


@router.post("/cases", status_code=201)
def raise_case(data: SupportCaseIn, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    if user.role != "citizen":
        raise HTTPException(status_code=403, detail="Only citizens can raise cases")
    seq = db.query(func.count(SupportCase.id)).scalar() or 0
    now = datetime.now(timezone.utc)
    c = SupportCase(
        case_ref=_case_ref(seq + 1),
        user_id=user.id,
        subject=data.subject.strip(),
        description=data.description,
        issue_type=data.issue_type,
        priority=data.priority,
        status="open",
        sla_due_at=_sla_for(data.priority),
        timeline=[{"ts": now.isoformat(), "status": "open", "by": user.full_name, "note": "Case created"}],
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    from app.services.sheets_sync import support_case_row, sync_record
    sync_record("SupportCases", support_case_row(c), id_column="case_id")

    return _case_to_dict(c)


@router.get("/cases")
def my_cases(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(SupportCase).filter_by(user_id=user.id).order_by(SupportCase.updated_at.desc()).all()
    return {"items": [_case_to_dict(c) for c in rows], "total": len(rows)}


@router.get("/cases/{case_id}")
def case_detail(case_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(SupportCase, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    if c.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your case")
    return _case_to_dict(c)


@router.post("/cases/{case_id}/reopen")
def reopen_case(case_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(SupportCase, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    if c.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your case")
    if c.status not in ("resolved", "closed"):
        raise HTTPException(status_code=400, detail="Case is not resolved")
    c.status = "in_progress"
    c.timeline = (c.timeline or []) + [{
        "ts": datetime.now(timezone.utc).isoformat(), "status": "in_progress",
        "by": user.full_name, "note": "Reopened by citizen"}]
    db.commit()
    return _case_to_dict(c)
