"""Enterprise admin operations: MONITOR -> REVIEW -> DECIDE -> RESOLVE -> PUBLISH -> ANALYZE -> AUDIT.

Every endpoint enforces ROLE -> PERMISSION and logs a permanent audit record.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import profile_to_dict, scheme_to_dict, user_to_dict
from app.core.rbac import (
    ADMIN_ROLES,
    ROLE_LABELS,
    admin_to_dict,
    require_admin,
    require_permission,
)
from app.database import get_db
from app.models.models import (
    AgentRun,
    AgentStatus,
    AIIncident,
    AnalyticsEvent,
    Application,
    AuditLog,
    Feedback,
    KnowledgeDoc,
    LoginAttempt,
    Profile,
    Scheme,
    SchemeVersion,
    SupportCase,
    User,
    UserDocument,
)
from app.schemas.schemas import (
    AgentControlIn,
    ApplicationAssignIn,
    ApplicationDecisionIn,
    ApplicationNoteIn,
    ApplicationPriorityIn,
    ArchiveIn,
    CaseReplyIn,
    DocumentReviewIn,
    IncidentAssignIn,
    RequestDocsIn,
    SchemeEditIn,
    SupportCaseAssignIn,
    SupportCaseIn,
    SupportCaseUpdateIn,
    UserRoleIn,
)
from app.services.audit import audit, audit_to_dict

router = APIRouter(prefix="/admin/ops", tags=["admin-ops"], dependencies=[Depends(require_admin)])

KNOWN_AGENTS = ["profiling", "eligibility", "policy", "recommender", "explainability", "guidance", "fraud", "documents"]


def _ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    return (xff or request.client.host if request.client else "").split(",")[0].strip()


def _case_ref(seq: int) -> str:
    return f"SR{datetime.now(timezone.utc).strftime('%y%m')}{seq:04d}"


def _sla_for(priority: str, now: datetime) -> datetime:
    hours = {"critical": 4, "high": 24, "medium": 48, "low": 72}.get(priority, 48)
    return now + timedelta(hours=hours)


def _app_to_dict(db: Session, a: Application) -> dict:
    u = db.get(User, a.user_id)
    scheme = db.get(Scheme, a.scheme_id) if a.scheme_id else None
    docs = db.query(UserDocument).filter_by(user_id=a.user_id).order_by(UserDocument.uploaded_at.desc()).all()
    return {
        "id": a.id, "application_id": a.application_id,
        "user_id": a.user_id,
        "user": u.full_name if u else "?",
        "user_email": u.email if u else "",
        "phone": u.phone if u else "",
        "scheme_id": a.scheme_id,
        "scheme": scheme.name if scheme else (a.qr_payload.get("scheme", "") if isinstance(a.qr_payload, dict) else ""),
        "scheme_code": scheme.code if scheme else "",
        "applicant_name": a.applicant_name,
        "status": a.status, "review_status": a.review_status,
        "priority": a.priority, "assigned_admin_id": a.assigned_admin_id,
        "eligibility_score": a.eligibility_score,
        "qr_payload": a.qr_payload if isinstance(a.qr_payload, dict) else {},
        "internal_notes": a.internal_notes or [],
        "requested_documents": a.requested_documents or [],
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        "documents": [
            {"id": d.id, "doc_type": d.doc_type, "file_name": d.file_name,
             "review_status": d.review_status, "fake_risk": d.fake_risk,
             "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None}
            for d in docs
        ],
        "profile": profile_to_dict(u.profile if u else None),
        "audit_trail": _app_audit(db, a.id),
    }


def _app_audit(db: Session, app_id: str) -> list[dict]:
    rows = db.query(AuditLog).filter(
        AuditLog.entity == "application", AuditLog.entity_id == app_id
    ).order_by(AuditLog.created_at.desc()).limit(50).all()
    return [audit_to_dict(r) for r in rows]


# ------------------------------ Overview ---------------------------------- #
@router.get("/overview")
def overview(request: Request, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    pending_review = db.query(Application).filter_by(status="under_review").count()
    submitted = db.query(Application).filter_by(status="submitted").count()
    assigned_to_me = db.query(Application).filter(
        Application.assigned_admin_id == user.id,
        Application.status.in_(["submitted", "under_review"]),
    ).count()
    docs_pending = db.query(UserDocument).filter_by(review_status="unreviewed").count()
    open_cases = db.query(SupportCase).filter(SupportCase.status.in_(["open", "assigned", "in_progress", "waiting_for_user"])).count()
    escalated_cases = db.query(SupportCase).filter_by(status="escalated").count()
    pending_pubs = db.query(Scheme).filter(Scheme.lifecycle_status.in_(["draft", "review"])).count()
    open_incidents = db.query(AIIncident).filter_by(status="open").count()
    open_feedback = db.query(Feedback).filter_by(status="open").count()
    low_docs = db.query(UserDocument).filter(
        UserDocument.fake_risk >= 60, UserDocument.review_status != "rejected"
    ).count()
    recent_audit = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(8).all()
    recent_cases = db.query(SupportCase).order_by(SupportCase.updated_at.desc()).limit(5).all()
    now = datetime.now(timezone.utc)
    overdue_sla = db.query(SupportCase).filter(
        SupportCase.status.in_(["open", "assigned", "in_progress", "waiting_for_user", "escalated"]),
        SupportCase.sla_due_at < now,
    ).count()
    return {
        "queues": {
            "pending_review": pending_review,
            "submitted": submitted,
            "assigned_to_me": assigned_to_me,
            "documents_pending": docs_pending,
            "open_cases": open_cases,
            "escalated_cases": escalated_cases,
            "pending_publications": pending_pubs,
            "open_incidents": open_incidents,
            "open_feedback": open_feedback,
            "high_risk_documents": low_docs,
            "overdue_sla": overdue_sla,
        },
        "recent_audit": [audit_to_dict(r) for r in recent_audit],
        "recent_cases": [
            {"id": c.id, "case_ref": c.case_ref, "subject": c.subject, "status": c.status,
             "priority": c.priority,
             "updated_at": c.updated_at.isoformat() if c.updated_at else None}
            for c in recent_cases
        ],
        "now": now.isoformat(),
    }


# --------------------------- Application workflow -------------------------- #
@router.get("/applications")
def list_applications(
    status: str | None = None,
    review_status: str | None = None,
    priority: str | None = None,
    q: str | None = None,
    assigned: str | None = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("apps.view")),
):
    query = db.query(Application)
    if status:
        query = query.filter(Application.status == status)
    if review_status:
        query = query.filter(Application.review_status == review_status)
    if priority:
        query = query.filter(Application.priority == priority)
    if assigned == "me":
        query = query.filter(Application.assigned_admin_id == user.id)
    elif assigned == "unassigned":
        query = query.filter(Application.assigned_admin_id.is_(None))
    elif assigned:
        query = query.filter(Application.assigned_admin_id == assigned)
    if q:
        like = f"%{q.lower()}%"
        ids = [u.id for u in db.query(User).filter(User.full_name.ilike(like) | User.email.ilike(like)).all()]
        query = query.filter(Application.user_id.in_(ids) | Application.applicant_name.ilike(like) | Application.application_id.ilike(like))
    items = query.order_by(Application.created_at.desc()).limit(limit).all()
    return {"items": [_app_to_dict(db, a) for a in items], "total": len(items)}


@router.get("/applications/{app_id}")
def application_detail(app_id: str, db: Session = Depends(get_db),
                       user: User = Depends(require_permission("apps.view"))):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    return _app_to_dict(db, a)


@router.put("/applications/{app_id}/assign")
def assign_application(app_id: str, data: ApplicationAssignIn, request: Request,
                       db: Session = Depends(get_db), user: User = Depends(require_permission("apps.*"))):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    if data.assigned_admin_id and not db.get(User, data.assigned_admin_id):
        raise HTTPException(status_code=404, detail="Admin not found")
    old = a.assigned_admin_id
    a.assigned_admin_id = data.assigned_admin_id
    if a.status in ("draft", "in_progress") and data.assigned_admin_id:
        a.status = "submitted"
        a.review_status = "needs_review"
    db.commit()
    audit(db, user, "application.assigned", "application", a.id,
          entity_name=f"{a.applicant_name} / {a.application_id}",
          old_value={"assigned_admin_id": old}, new_value={"assigned_admin_id": data.assigned_admin_id},
          ip=_ip(request))
    return _app_to_dict(db, a)


@router.put("/applications/{app_id}/priority")
def set_priority(app_id: str, data: ApplicationPriorityIn, request: Request,
                 db: Session = Depends(get_db), user: User = Depends(require_permission("apps.*"))):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    old = a.priority
    a.priority = data.priority
    db.commit()
    audit(db, user, "application.priority_changed", "application", a.id,
          entity_name=f"{a.applicant_name} / {a.application_id}",
          old_value={"priority": old}, new_value={"priority": data.priority}, ip=_ip(request))
    return _app_to_dict(db, a)


@router.post("/applications/{app_id}/notes")
def add_note(app_id: str, data: ApplicationNoteIn, request: Request,
             db: Session = Depends(get_db), user: User = Depends(require_permission("apps.*"))):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    a.internal_notes = (a.internal_notes or []) + [
        {"ts": datetime.now(timezone.utc).isoformat(), "admin": user.full_name, "admin_id": user.id, "note": data.note}
    ]
    db.commit()
    audit(db, user, "application.note_added", "application", a.id,
          entity_name=f"{a.applicant_name} / {a.application_id}",
          new_value={"note": data.note}, ip=_ip(request))
    return _app_to_dict(db, a)


@router.post("/applications/{app_id}/request-documents")
def request_documents(app_id: str, data: RequestDocsIn, request: Request,
                      db: Session = Depends(get_db), user: User = Depends(require_permission("apps.*"))):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    a.requested_documents = (a.requested_documents or []) + [
        {"doc": d, "requested_at": datetime.now(timezone.utc).isoformat(), "by": user.full_name}
        for d in data.documents
    ]
    a.review_status = "documents_required"
    db.commit()
    audit(db, user, "application.documents_requested", "application", a.id,
          entity_name=f"{a.applicant_name} / {a.application_id}",
          new_value={"documents": data.documents, "note": data.note}, ip=_ip(request))
    return _app_to_dict(db, a)


@router.put("/applications/{app_id}/decision")
def decide_application(app_id: str, data: ApplicationDecisionIn, request: Request,
                       db: Session = Depends(get_db), user: User = Depends(require_permission("apps.*"))):
    a = db.get(Application, app_id)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found")
    if a.status in ("approved", "rejected", "disbursed"):
        raise HTTPException(status_code=400, detail=f"Application already finalised ({a.status})")
    old = {"status": a.status, "review_status": a.review_status}
    a.status = "approved" if data.decision == "approve" else "rejected"
    a.review_status = "decision"
    db.commit()
    audit(db, user, f"application.{data.decision}d", "application", a.id,
          entity_name=f"{a.applicant_name} / {a.application_id}",
          old_value=old, new_value={"status": a.status, "reason": data.reason}, reason=data.reason, ip=_ip(request))
    return _app_to_dict(db, a)


# ------------------------------ UserDocument review ---------------------------- #
def _doc_to_dict(doc: UserDocument) -> dict:
    return {
        "id": doc.id, "user_id": doc.user_id, "doc_type": doc.doc_type,
        "file_name": doc.file_name, "file_path": doc.file_path,
        "is_verified": doc.is_verified, "expiry_date": doc.expiry_date,
        "is_blurry": doc.is_blurry, "is_duplicate": doc.is_duplicate,
        "fake_risk": doc.fake_risk, "review_status": doc.review_status,
        "reviewed_by": doc.reviewed_by, "review_note": doc.review_note,
        "analyzer_report": doc.analyzer_report or {},
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
    }


@router.get("/documents")
def list_documents(
    review_status: str | None = None,
    q: str | None = None,
    min_risk: float | None = Query(None, ge=0, le=100),
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("docs.view")),
):
    query = db.query(UserDocument)
    if review_status:
        query = query.filter(UserDocument.review_status == review_status)
    if min_risk is not None:
        query = query.filter(UserDocument.fake_risk >= min_risk)
    if q:
        like = f"%{q.lower()}%"
        ids = [u.id for u in db.query(User).filter(User.full_name.ilike(like) | User.email.ilike(like)).all()]
        query = query.filter(UserDocument.user_id.in_(ids) | UserDocument.doc_type.ilike(like) | UserDocument.file_name.ilike(like))
    docs = query.order_by(UserDocument.uploaded_at.desc()).limit(limit).all()
    items = []
    for d in docs:
        u = db.get(User, d.user_id)
        d = _doc_to_dict(d)
        d["user"] = u.full_name if u else "?"
        d["user_email"] = u.email if u else ""
        items.append(d)
    stats = {
        "unreviewed": db.query(UserDocument).filter_by(review_status="unreviewed").count(),
        "verified": db.query(UserDocument).filter_by(review_status="verified").count(),
        "rejected": db.query(UserDocument).filter_by(review_status="rejected").count(),
        "reupload_requested": db.query(UserDocument).filter_by(review_status="reupload_requested").count(),
        "escalated": db.query(UserDocument).filter_by(review_status="escalated").count(),
        "high_risk": db.query(UserDocument).filter(UserDocument.fake_risk >= 60, UserDocument.review_status != "rejected").count(),
    }
    return {"items": items, "total": len(items), "stats": stats}


@router.get("/documents/{doc_id}")
def document_detail(doc_id: str, db: Session = Depends(get_db),
                    user: User = Depends(require_permission("docs.view"))):
    d = db.get(UserDocument, doc_id)
    if not d:
        raise HTTPException(status_code=404, detail="UserDocument not found")
    u = db.get(User, d.user_id)
    out = _doc_to_dict(d)
    out["user"] = u.full_name if u else "?"
    out["user_email"] = u.email if u else ""
    return out


@router.put("/documents/{doc_id}/review")
def review_document(doc_id: str, data: DocumentReviewIn, request: Request,
                    db: Session = Depends(get_db), user: User = Depends(require_permission("docs.*"))):
    d = db.get(UserDocument, doc_id)
    if not d:
        raise HTTPException(status_code=404, detail="UserDocument not found")
    old = {"review_status": d.review_status, "is_verified": d.is_verified}
    d.review_status = data.decision
    d.reviewed_by = user.id
    d.review_note = data.note
    d.is_verified = data.decision == "verified"
    db.commit()
    audit(db, user, f"UserDocument.{data.decision}", "UserDocument", d.id,
          entity_name=f"{d.doc_type} / {d.file_name}",
          old_value=old, new_value={"review_status": data.decision, "note": data.note},
          reason=data.note, ip=_ip(request))
    return _doc_to_dict(db, d)


# ------------------------------ Support cases ------------------------------ #
def _case_to_dict(db: Session, c: SupportCase) -> dict:
    u = db.get(User, c.user_id)
    assignee = db.get(User, c.assigned_to) if c.assigned_to else None
    return {
        "id": c.id, "case_ref": c.case_ref, "user_id": c.user_id,
        "user": u.full_name if u else "?",
        "user_email": u.email if u else "",
        "phone": u.phone if u else "",
        "subject": c.subject, "description": c.description,
        "issue_type": c.issue_type, "priority": c.priority, "status": c.status,
        "assigned_to": c.assigned_to,
        "assigned_to_name": assignee.full_name if assignee else None,
        "sla_due_at": c.sla_due_at.isoformat() if c.sla_due_at else None,
        "timeline": c.timeline or [],
        "escalated_from": c.escalated_from,
        "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/cases")
def list_cases(
    status: str | None = None,
    priority: str | None = None,
    issue_type: str | None = None,
    assigned: str | None = None,
    q: str | None = None,
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("cases.view")),
):
    query = db.query(SupportCase)
    if status:
        query = query.filter(SupportCase.status == status)
    if priority:
        query = query.filter(SupportCase.priority == priority)
    if issue_type:
        query = query.filter(SupportCase.issue_type == issue_type)
    if assigned == "me":
        query = query.filter(SupportCase.assigned_to == user.id)
    elif assigned == "unassigned":
        query = query.filter(SupportCase.assigned_to.is_(None))
    elif assigned:
        query = query.filter(SupportCase.assigned_to == assigned)
    if q:
        like = f"%{q.lower()}%"
        ids = [u.id for u in db.query(User).filter(User.full_name.ilike(like) | User.email.ilike(like)).all()]
        query = query.filter(SupportCase.user_id.in_(ids) | SupportCase.subject.ilike(like) | SupportCase.case_ref.ilike(like))
    cases = query.order_by(SupportCase.updated_at.desc()).limit(limit).all()
    return {"items": [_case_to_dict(db, c) for c in cases], "total": len(cases)}


@router.post("/cases", status_code=201)
def create_case(data: SupportCaseIn, request: Request,
                db: Session = Depends(get_db), user: User = Depends(require_permission("cases.*"))):
    target = db.get(User, data.user_id)
    if not target or target.role != "citizen":
        raise HTTPException(status_code=404, detail="Citizen not found")
    seq = db.query(func.count(SupportCase.id)).scalar() or 0
    now = datetime.now(timezone.utc)
    c = SupportCase(
        case_ref=_case_ref(seq + 1),
        user_id=data.user_id,
        subject=data.subject.strip(),
        description=data.description,
        issue_type=data.issue_type,
        priority=data.priority,
        status="open",
        sla_due_at=_sla_for(data.priority, now),
        timeline=[{"ts": now.isoformat(), "status": "open", "by": user.full_name, "note": "Case created"}],
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    audit(db, user, "case.created", "case", c.id, entity_name=c.case_ref,
          new_value={"subject": c.subject, "priority": c.priority}, ip=_ip(request))
    return _case_to_dict(db, c)


@router.get("/cases/{case_id}")
def case_detail(case_id: str, db: Session = Depends(get_db),
                user: User = Depends(require_permission("cases.view"))):
    c = db.get(SupportCase, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return _case_to_dict(db, c)


@router.put("/cases/{case_id}/assign")
def assign_case(case_id: str, data: SupportCaseAssignIn, request: Request,
                db: Session = Depends(get_db), user: User = Depends(require_permission("cases.*"))):
    c = db.get(SupportCase, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    if data.assigned_to and not db.get(User, data.assigned_to):
        raise HTTPException(status_code=404, detail="Admin not found")
    old = c.assigned_to
    c.assigned_to = data.assigned_to
    if data.assigned_to and c.status == "open":
        c.status = "assigned"
    c.timeline = (c.timeline or []) + [{
        "ts": datetime.now(timezone.utc).isoformat(), "status": c.status,
        "by": user.full_name, "note": f"Assigned to {db.get(User, data.assigned_to).full_name if data.assigned_to else 'unassigned'}"}]
    db.commit()
    audit(db, user, "case.assigned", "case", c.id, entity_name=c.case_ref,
          old_value={"assigned_to": old}, new_value={"assigned_to": data.assigned_to}, ip=_ip(request))
    return _case_to_dict(db, c)


@router.put("/cases/{case_id}/status")
def update_case_status(case_id: str, data: SupportCaseUpdateIn, request: Request,
                       db: Session = Depends(get_db), user: User = Depends(require_permission("cases.*"))):
    c = db.get(SupportCase, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    old = {"status": c.status, "priority": c.priority}
    now = datetime.now(timezone.utc)
    c.status = data.status
    if data.priority:
        c.priority = data.priority
        c.sla_due_at = _sla_for(c.priority, now)
    if data.status == "escalated":
        c.escalated_from = c.assigned_to or user.id
        c.sla_due_at = _sla_for(c.priority, now)
    if data.status == "resolved" or data.status == "closed":
        c.resolved_at = now
    c.timeline = (c.timeline or []) + [{
        "ts": now.isoformat(), "status": data.status,
        "by": user.full_name, "note": data.note or ""}]
    db.commit()
    audit(db, user, f"case.{data.status}", "case", c.id, entity_name=c.case_ref,
          old_value=old, new_value={"status": data.status, "note": data.note},
          reason=data.note, ip=_ip(request))
    return _case_to_dict(db, c)


@router.post("/cases/{case_id}/reply")
def reply_case(case_id: str, data: CaseReplyIn, request: Request,
               db: Session = Depends(get_db), user: User = Depends(require_permission("cases.*"))):
    c = db.get(SupportCase, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    c.timeline = (c.timeline or []) + [{
        "ts": datetime.now(timezone.utc).isoformat(), "status": c.status,
        "by": user.full_name, "note": data.message}]
    db.commit()
    audit(db, user, "case.reply", "case", c.id, entity_name=c.case_ref,
          new_value={"message": data.message}, ip=_ip(request))
    return _case_to_dict(db, c)


# ------------------------------ Scheme operations -------------------------- #
def _scheme_lifecycle(db: Session, s: Scheme) -> dict:
    d = scheme_to_dict(s)
    d["lifecycle_status"] = s.lifecycle_status
    d["version"] = s.version
    d["updated_at"] = s.updated_at.isoformat() if s.updated_at else None
    versions = db.query(SchemeVersion).filter_by(scheme_id=s.id).order_by(SchemeVersion.version.desc()).limit(20).all()
    d["versions"] = [
        {"id": v.id, "version": v.version, "status": v.status, "reason": v.reason,
         "changed_fields": v.changed_fields, "submitted_by": v.submitted_by,
         "approved_by": v.approved_by,
         "created_at": v.created_at.isoformat() if v.created_at else None}
        for v in versions
    ]
    return d


@router.get("/schemes")
def list_schemes(
    lifecycle_status: str | None = None,
    category: str | None = None,
    q: str | None = None,
    limit: int = Query(300, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("schemes.view")),
):
    query = db.query(Scheme)
    if lifecycle_status:
        query = query.filter(Scheme.lifecycle_status == lifecycle_status)
    if category:
        query = query.filter(Scheme.category == category)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(Scheme.name.ilike(like) | Scheme.code.ilike(like) | Scheme.ministry.ilike(like))
    schemes = query.order_by(Scheme.updated_at.desc()).limit(limit).all()
    return {"items": [_scheme_lifecycle(db, s) for s in schemes], "total": len(schemes)}


@router.get("/schemes/{scheme_id}")
def scheme_detail(scheme_id: str, db: Session = Depends(get_db),
                  user: User = Depends(require_permission("schemes.view"))):
    s = db.get(Scheme, scheme_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return _scheme_lifecycle(db, s)


@router.put("/schemes/{scheme_id}/edit")
def edit_scheme(scheme_id: str, data: SchemeEditIn, request: Request,
                db: Session = Depends(get_db), user: User = Depends(require_permission("schemes.edit"))):
    s = db.get(Scheme, scheme_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")
    changes = {}
    for field in data.model_fields:
        if field == "reason":
            continue
        new_val = getattr(data, field)
        if new_val is None:
            continue
        old_val = getattr(s, field)
        if old_val != new_val:
            changes[field] = {"old": old_val, "new": new_val}
            setattr(s, field, new_val)
    if not changes:
        raise HTTPException(status_code=400, detail="No changes supplied")
    s.version = (s.version or 1) + 1
    s.lifecycle_status = "review"
    db.commit()
    v = SchemeVersion(
        scheme_id=s.id, version=s.version, status="review",
        changed_fields=changes, submitted_by=user.id, reason=data.reason,
    )
    db.add(v)
    db.commit()
    audit(db, user, "scheme.edited", "scheme", s.id, entity_name=s.name,
          old_value={k: c["old"] for k, c in changes.items()},
          new_value={k: c["new"] for k, c in changes.items()},
          reason=data.reason, ip=_ip(request))
    from app.services.sheets_sync import scheme_row, sync_record
    sync_record("Schemes", scheme_row(s), id_column="scheme_id")
    return _scheme_lifecycle(db, s)


@router.post("/schemes/{scheme_id}/publish")
def publish_scheme(scheme_id: str, request: Request, reason: str = "",
                   db: Session = Depends(get_db), user: User = Depends(require_permission("schemes.publish"))):
    s = db.get(Scheme, scheme_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")
    if s.lifecycle_status == "archived":
        raise HTTPException(status_code=400, detail="Archived scheme cannot be published directly")
    old = {"lifecycle_status": s.lifecycle_status}
    s.lifecycle_status = "published"
    s.is_active = True
    db.commit()
    v = db.query(SchemeVersion).filter_by(scheme_id=s.id, version=s.version).first()
    if v:
        v.status = "published"
        v.approved_by = user.id
        db.commit()
    audit(db, user, "scheme.published", "scheme", s.id, entity_name=s.name,
          old_value=old, new_value={"lifecycle_status": "published", "version": s.version},
          reason=reason, ip=_ip(request) if request else "")
    from app.services.sheets_sync import scheme_row, sync_record
    sync_record("Schemes", scheme_row(s), id_column="scheme_id")
    return _scheme_lifecycle(db, s)


@router.post("/schemes/{scheme_id}/archive")
def archive_scheme(scheme_id: str, data: ArchiveIn | None = None, request: Request = None,
                   db: Session = Depends(get_db), user: User = Depends(require_permission("schemes.publish"))):
    reason = data.reason if data else ""
    s = db.get(Scheme, scheme_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")
    if s.lifecycle_status == "archived":
        raise HTTPException(status_code=400, detail="Already archived")
    old = {"lifecycle_status": s.lifecycle_status, "is_active": s.is_active}
    s.lifecycle_status = "archived"
    s.is_active = False
    db.commit()
    audit(db, user, "scheme.archived", "scheme", s.id, entity_name=s.name,
          old_value=old, new_value={"lifecycle_status": "archived", "reason": reason},
          reason=reason, ip=_ip(request) if request else "")
    from app.services.sheets_sync import scheme_row, sync_record
    sync_record("Schemes", scheme_row(s), id_column="scheme_id")
    return _scheme_lifecycle(db, s)


@router.get("/publication-queue")
def publication_queue(db: Session = Depends(get_db),
                      user: User = Depends(require_permission("schemes.review"))):
    pending = db.query(Scheme).filter(Scheme.lifecycle_status.in_(["draft", "review"])).all()
    return {"items": [_scheme_lifecycle(db, s) for s in pending], "total": len(pending)}


# ------------------------------- AI operations ----------------------------- #
@router.get("/agents")
def agent_status(db: Session = Depends(get_db), user: User = Depends(require_permission("ai.view"))):
    for name in KNOWN_AGENTS:
        if not db.query(AgentStatus).filter_by(agent_name=name).first():
            db.add(AgentStatus(agent_name=name))
    db.commit()
    rows = db.query(AgentStatus).all()
    # enrich with recent run stats
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    items = []
    for r in rows:
        ok = db.query(func.count(AgentRun.id)).filter(
            AgentRun.agent_name == r.agent_name, AgentRun.created_at >= since, AgentRun.status == "success").scalar()
        fail = db.query(func.count(AgentRun.id)).filter(
            AgentRun.agent_name == r.agent_name, AgentRun.created_at >= since, AgentRun.status == "failed").scalar()
        items.append({
            "agent_name": r.agent_name,
            "label": r.agent_name.replace("_", " ").title(),
            "is_paused": r.is_paused,
            "failure_count": r.failure_count,
            "success_count": r.success_count,
            "last_status": r.last_status,
            "paused_by": r.paused_by,
            "paused_reason": r.paused_reason,
            "last_run_at": r.last_run_at.isoformat() if r.last_run_at else None,
            "runs_24h": {"success": ok, "failed": fail},
        })
    return {"items": items, "agents": KNOWN_AGENTS}


@router.post("/agents/{agent_name}/pause")
def pause_agent(agent_name: str, data: AgentControlIn, request: Request,
                db: Session = Depends(get_db), user: User = Depends(require_permission("ai.control"))):
    r = db.query(AgentStatus).filter_by(agent_name=agent_name).first()
    if not r:
        raise HTTPException(status_code=404, detail="Agent not found")
    old = {"is_paused": r.is_paused, "last_status": r.last_status}
    r.is_paused = True
    r.last_status = "paused"
    r.paused_by = user.id
    r.paused_reason = data.reason
    r.updated_by = user.id
    db.commit()
    audit(db, user, "agent.paused", "agent", agent_name, entity_name=agent_name,
          old_value=old, new_value={"paused": True, "reason": data.reason}, ip=_ip(request))
    return {"ok": True, "is_paused": True}


@router.post("/agents/{agent_name}/resume")
def resume_agent(agent_name: str, data: AgentControlIn, request: Request,
                 db: Session = Depends(get_db), user: User = Depends(require_permission("ai.control"))):
    r = db.query(AgentStatus).filter_by(agent_name=agent_name).first()
    if not r:
        raise HTTPException(status_code=404, detail="Agent not found")
    old = {"is_paused": r.is_paused, "last_status": r.last_status}
    r.is_paused = False
    r.last_status = "idle"
    r.paused_reason = ""
    r.updated_by = user.id
    db.commit()
    audit(db, user, "agent.resumed", "agent", agent_name, entity_name=agent_name,
          old_value=old, new_value={"paused": False}, ip=_ip(request))
    return {"ok": True, "is_paused": False}


def _incident_to_dict(db: Session, inc: AIIncident) -> dict:
    assignee = db.get(User, inc.assigned_to) if inc.assigned_to else None
    return {
        "id": inc.id, "agent_name": inc.agent_name, "severity": inc.severity,
        "status": inc.status, "failure_count": inc.failure_count,
        "started_at": inc.started_at.isoformat() if inc.started_at else None,
        "last_error": inc.last_error,
        "last_error_at": inc.last_error_at.isoformat() if inc.last_error_at else None,
        "assigned_to": inc.assigned_to,
        "assigned_to_name": assignee.full_name if assignee else None,
        "timeline": inc.timeline or [],
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
    }


@router.get("/incidents")
def list_incidents(status: str | None = None, severity: str | None = None,
                   db: Session = Depends(get_db), user: User = Depends(require_permission("ai.view"))):
    query = db.query(AIIncident)
    if status:
        query = query.filter(AIIncident.status == status)
    if severity:
        query = query.filter(AIIncident.severity == severity)
    incs = query.order_by(AIIncident.created_at.desc()).limit(100).all()
    return {"items": [_incident_to_dict(db, i) for i in incs], "total": len(incs)}


@router.post("/incidents/{incident_id}/assign")
def assign_incident(incident_id: str, data: IncidentAssignIn, request: Request,
                    db: Session = Depends(get_db), user: User = Depends(require_permission("ai.control"))):
    inc = db.get(AIIncident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    old = inc.assigned_to
    inc.assigned_to = data.assigned_to
    inc.timeline = (inc.timeline or []) + [{
        "ts": datetime.now(timezone.utc).isoformat(), "by": user.full_name, "note": "Incident assigned"}]
    db.commit()
    audit(db, user, "incident.assigned", "incident", inc.id,
          entity_name=f"{inc.agent_name} / {inc.id}",
          old_value={"assigned_to": old}, new_value={"assigned_to": data.assigned_to}, ip=_ip(request))
    return _incident_to_dict(db, inc)


@router.post("/incidents/{incident_id}/resolve")
def resolve_incident(incident_id: str, request: Request, reason: str = "",
                     db: Session = Depends(get_db), user: User = Depends(require_permission("ai.control"))):
    inc = db.get(AIIncident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    old = inc.status
    inc.status = "resolved"
    inc.resolved_at = datetime.now(timezone.utc)
    inc.timeline = (inc.timeline or []) + [{
        "ts": inc.resolved_at.isoformat(), "by": user.full_name, "note": "Incident resolved"}]
    db.commit()
    audit(db, user, "incident.resolved", "incident", inc.id,
          entity_name=f"{inc.agent_name} / {inc.id}",
          old_value={"status": old}, new_value={"status": "resolved", "reason": reason}, ip=_ip(request) if request else "")
    return _incident_to_dict(db, inc)


@router.post("/incidents/{incident_id}/pause-agent")
def pause_agent_from_incident(incident_id: str, data: AgentControlIn, request: Request,
                              db: Session = Depends(get_db), user: User = Depends(require_permission("ai.control"))):
    inc = db.get(AIIncident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    r = db.query(AgentStatus).filter_by(agent_name=inc.agent_name).first()
    if r:
        r.is_paused = True
        r.last_status = "paused"
        r.paused_by = user.id
        r.paused_reason = data.reason or inc.last_error
        r.updated_by = user.id
    inc.status = "paused"
    inc.timeline = (inc.timeline or []) + [{
        "ts": datetime.now(timezone.utc).isoformat(), "by": user.full_name, "note": "Agent paused"}]
    db.commit()
    audit(db, user, "agent.paused_from_incident", "incident", inc.id,
          entity_name=f"{inc.agent_name} / {inc.id}",
          new_value={"agent_paused": True, "reason": data.reason}, ip=_ip(request))
    return _incident_to_dict(db, inc)


# ---------------------------------- Audit ---------------------------------- #
@router.get("/audit")
def audit_log(
    entity: str | None = None,
    action: str | None = None,
    actor: str | None = None,
    result: str | None = None,
    q: str | None = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("audit.view")),
):
    query = db.query(AuditLog)
    if entity:
        query = query.filter(AuditLog.entity == entity)
    if action:
        query = query.filter(AuditLog.action == action)
    if actor:
        query = query.filter(AuditLog.actor_id == actor)
    if result:
        query = query.filter(AuditLog.result == result)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            AuditLog.actor_name.ilike(like) | AuditLog.entity_name.ilike(like) |
            AuditLog.action.ilike(like) | AuditLog.entity_id.ilike(like))
    rows = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    counts = db.query(AuditLog.action, func.count(AuditLog.id)) \
        .group_by(AuditLog.action).order_by(func.count(AuditLog.id).desc()).limit(20).all()
    return {
        "items": [audit_to_dict(r) for r in rows],
        "total": len(rows),
        "top_actions": [{"action": a, "count": c} for a, c in counts],
    }


@router.get("/audit/{log_id}")
def audit_detail(log_id: str, db: Session = Depends(get_db),
                 user: User = Depends(require_permission("audit.view"))):
    r = db.get(AuditLog, log_id)
    if not r:
        raise HTTPException(status_code=404, detail="Audit record not found")
    return audit_to_dict(r)


# --------------------------------- Security -------------------------------- #
@router.get("/security/login-attempts")
def login_attempts(
    success: bool | None = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("security.view")),
):
    query = db.query(LoginAttempt)
    if success is not None:
        query = query.filter(LoginAttempt.success == success)
    rows = query.order_by(LoginAttempt.created_at.desc()).limit(limit).all()
    return {"items": [
        {"id": r.id, "email": r.email, "success": r.success, "ip": r.ip,
         "user_agent": r.user_agent, "reason": r.reason,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ], "total": len(rows)}


@router.get("/security/overview")
def security_overview(db: Session = Depends(get_db),
                      user: User = Depends(require_permission("security.view"))):
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    failed_24h = db.query(LoginAttempt).filter(
        LoginAttempt.success == False, LoginAttempt.created_at >= day_ago).count()  # noqa: E712
    total_24h = db.query(LoginAttempt).filter(LoginAttempt.created_at >= day_ago).count()
    unique_ips = db.query(LoginAttempt.ip).filter(LoginAttempt.created_at >= day_ago).distinct().count()
    top_failers = db.query(LoginAttempt.email, func.count(LoginAttempt.id)) \
        .filter(LoginAttempt.success == False, LoginAttempt.created_at >= day_ago) \
        .group_by(LoginAttempt.email).order_by(func.count(LoginAttempt.id).desc()).limit(8).all()
    disabled = db.query(User).filter(User.is_active == False).count()  # noqa: E712
    admins = db.query(User).filter_by(role="admin").all()
    role_dist = {}
    for a in admins:
        role_dist[a.admin_role] = role_dist.get(a.admin_role, 0) + 1
    return {
        "failed_24h": failed_24h,
        "total_24h": total_24h,
        "success_rate_24h": round((total_24h - failed_24h) / total_24h * 100, 1) if total_24h else 100.0,
        "unique_ips_24h": unique_ips,
        "top_failed_emails": [{"email": e, "count": c} for e, c in top_failers],
        "disabled_accounts": disabled,
        "admin_count": len(admins),
        "role_distribution": role_dist,
        "admins": [admin_to_dict(a) for a in admins],
    }


# ---------------------------------- Reports -------------------------------- #
@router.get("/reports/applications")
def report_applications(
    from_date: str | None = None,
    to_date: str | None = None,
    group_by: str = Query("status", pattern="^(status|state|scheme|category)$"),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("analytics.view")),
):
    q = db.query(Application)
    if from_date:
        q = q.filter(Application.created_at >= from_date)
    if to_date:
        q = q.filter(Application.created_at <= to_date + "T23:59:59")
    apps = q.all()
    buckets: dict[str, int] = {}
    for a in apps:
        key = a.status
        if group_by == "state":
            key = db.get(User, a.user_id).profile.state if db.get(User, a.user_id) and db.get(User, a.user_id).profile else ""
            key = key or "Unknown"
        elif group_by == "scheme":
            s = db.get(Scheme, a.scheme_id)
            key = s.name if s else (a.qr_payload.get("scheme", "") if isinstance(a.qr_payload, dict) else "Unknown")
        elif group_by == "category":
            s = db.get(Scheme, a.scheme_id)
            key = s.category if s else "Unknown"
        buckets[key] = buckets.get(key, 0) + 1
    total = len(apps) or 1
    approved = sum(1 for a in apps if a.status in ("approved", "disbursed"))
    rejected = sum(1 for a in apps if a.status == "rejected")
    pending = sum(1 for a in apps if a.status in ("submitted", "under_review", "draft", "in_progress"))
    return {
        "group_by": group_by,
        "total": len(apps),
        "rows": [{"key": k, "count": c, "pct": round(c / total * 100, 1)} for k, c in sorted(buckets.items(), key=lambda x: -x[1])],
        "summary": {
            "approved": approved, "rejected": rejected, "pending": pending,
            "approval_rate": round(approved / total * 100, 1),
            "rejection_rate": round(rejected / total * 100, 1),
        },
    }


@router.get("/reports/cases")
def report_cases(db: Session = Depends(get_db), user: User = Depends(require_permission("analytics.view"))):
    all_cases = db.query(SupportCase).all()
    total = len(all_cases)
    resolved = sum(1 for c in all_cases if c.status in ("resolved", "closed"))
    open_count = total - resolved
    by_type: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    for c in all_cases:
        by_type[c.issue_type] = by_type.get(c.issue_type, 0) + 1
        by_priority[c.priority] = by_priority.get(c.priority, 0) + 1
    return {
        "total": total,
        "resolved": resolved,
        "open": open_count,
        "resolution_rate": round(resolved / total * 100, 1) if total else 0,
        "by_type": [{"key": k, "count": v} for k, v in sorted(by_type.items(), key=lambda x: -x[1])],
        "by_priority": [{"key": k, "count": v} for k, v in sorted(by_priority.items(), key=lambda x: -x[1])],
    }


@router.get("/reports/export/audit")
def export_audit_csv(request: Request, db: Session = Depends(get_db),
                     user: User = Depends(require_permission("reports.export"))):
    import csv
    import io

    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(5000).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["timestamp", "actor", "role", "action", "entity", "entity_name", "result", "ip", "reason"])
    for r in rows:
        w.writerow([
            r.created_at.isoformat() if r.created_at else "",
            r.actor_name, r.actor_role, r.action, r.entity, r.entity_name,
            r.result, r.ip, r.reason.replace("\n", " "),
        ])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="audit_export.csv"'})


# ---------------------------------- RBAC ------------------------------------ #
@router.get("/roles")
def list_roles(db: Session = Depends(get_db), user: User = Depends(require_permission("roles.manage"))):
    admins = db.query(User).filter_by(role="admin").all()
    return {
        "roles": [{"value": r, "label": ROLE_LABELS[r]} for r in ADMIN_ROLES],
        "admins": [admin_to_dict(a) for a in admins],
    }


@router.put("/users/{user_id}/role")
def update_user_role(user_id: str, data: UserRoleIn, request: Request,
                     db: Session = Depends(get_db), user: User = Depends(require_permission("roles.manage"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == u.id and (data.role != "admin" or (data.admin_role and data.admin_role != "super_admin")):
        raise HTTPException(status_code=400, detail="You cannot demote your own super admin role")
    super_admin_count = db.query(User).filter_by(role="admin", admin_role="super_admin").count()
    if u.role == "admin" and u.admin_role == "super_admin" and super_admin_count <= 1:
        new_is_super = data.role == "admin" and (data.admin_role or "super_admin") == "super_admin"
        if not new_is_super:
            raise HTTPException(status_code=400, detail="Cannot demote the last super admin account")
    old = {"role": u.role, "admin_role": u.admin_role}
    u.role = data.role
    if data.admin_role:
        u.admin_role = data.admin_role
    if u.role == "admin" and u.admin_role not in ADMIN_ROLES:
        u.admin_role = "operations_admin"
    db.commit()
    audit(db, user, "user.role_changed", "user", u.id, entity_name=u.email,
          old_value=old, new_value={"role": u.role, "admin_role": u.admin_role},
          ip=_ip(request))
    return admin_to_dict(u) if u.role == "admin" else user_to_dict(u)


# ----------------------------- Support & user facing ------------------------ #

