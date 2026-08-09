from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import scheme_to_dict
from app.core.rbac import admin_to_dict, has_permission, require_admin, require_permission
from app.core.security import hash_password
from app.database import get_db
from app.models.models import (
    AgentRun,
    AnalyticsEvent,
    Application,
    Feedback,
    KnowledgeDoc,
    NewsItem,
    Notification,
    Profile,
    Scheme,
    User,
)
from app.rag.vector_store import RAGStore
from app.schemas.schemas import AdminUserCreate, BroadcastIn, FeedbackResolveIn, KnowledgeIn, NewsIn
from app.services.audit import audit

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    return (xff or request.client.host if request.client else "").split(",")[0].strip()


# ------------------------------ Dashboard -------------------------------- #
@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(require_permission("analytics.view"))):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    users = db.query(User).filter(User.role == "citizen").count()
    apps = db.query(Application).count()
    schemes = db.query(Scheme).filter_by(is_active=True).count()
    docs = db.query(KnowledgeDoc).count()
    return {
        "users": users,
        "applications": apps,
        "active_schemes": schemes,
        "knowledge_docs": docs,
        "new_users_7d": db.query(User).filter(User.created_at >= week_ago).count(),
        "applications_7d": db.query(Application).filter(Application.created_at >= week_ago).count(),
        "open_feedback": db.query(Feedback).filter_by(status="open").count(),
        "unresolved_apps": db.query(Application).filter(Application.status.in_(["draft", "in_progress"])).count(),
        "pending_review": db.query(Application).filter_by(status="under_review").count(),
    }


@router.get("/analytics")
def analytics(db: Session = Depends(get_db), user: User = Depends(require_permission("analytics.view"))):
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)

    state_rows = db.query(Profile.state, func.count(Profile.id)).filter(
        Profile.state != "").group_by(Profile.state).all()
    state_usage = [{"state": s or "Unknown", "count": c} for s, c in state_rows]

    scheme_applied = db.query(Application.scheme_id, func.count(Application.id)) \
        .group_by(Application.scheme_id).order_by(func.count(Application.id).desc()).limit(8).all()
    most_applied = []
    for sid, count in scheme_applied:
        s = db.get(Scheme, sid)
        most_applied.append({"scheme": s.name if s else sid, "count": count})

    popular_cats = db.query(Scheme.category, func.count(Scheme.id)) \
        .group_by(Scheme.category).order_by(func.count(Scheme.id).desc()).all()
    categories = [{"category": c, "count": n} for c, n in popular_cats]

    status_rows = db.query(Application.status, func.count(Application.id)).group_by(Application.status).all()
    statuses = [{"status": s, "count": n} for s, n in status_rows]
    total_apps = sum(n for _, n in status_rows) or 1
    approved = sum(n for s, n in status_rows if s in ("approved", "disbursed"))
    rejected = sum(n for s, n in status_rows if s == "rejected")

    daily = db.query(
        func.strftime("%Y-%m-%d", AnalyticsEvent.created_at),
        func.count(AnalyticsEvent.id),
    ).filter(AnalyticsEvent.created_at >= month_ago).group_by(func.strftime("%Y-%m-%d", AnalyticsEvent.created_at)).all()
    activity = [{"date": d, "events": c} for d, c in daily]

    event_counts = db.query(AnalyticsEvent.event_type, func.count(AnalyticsEvent.id)) \
        .group_by(AnalyticsEvent.event_type).all()
    events = [{"type": e, "count": c} for e, c in event_counts]

    return {
        "state_usage": state_usage,
        "most_applied": most_applied,
        "categories": categories,
        "statuses": statuses,
        "success_rate": round(approved / total_apps * 100, 1),
        "rejection_rate": round(rejected / total_apps * 100, 1),
        "activity": activity,
        "events": events,
    }


# ------------------------------ Users ------------------------------------- #
@router.get("/users")
def list_users(db: Session = Depends(get_db), user: User = Depends(require_permission("users.view"))):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {"items": [admin_to_dict(u) for u in users], "total": len(users)}


@router.post("/users", status_code=201)
def create_user(data: AdminUserCreate, request: Request,
                db: Session = Depends(get_db), user: User = Depends(require_permission("admins.create"))):
    if db.query(User).filter_by(email=data.email.lower()).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    u = User(
        email=data.email.lower(),
        phone=data.phone,
        full_name=data.full_name.strip(),
        language=data.language,
        role=data.role,
        admin_role=data.admin_role if data.role == "admin" else "operations_admin",
        password_hash=hash_password(data.password),
        is_verified=True,
    )
    db.add(u)
    db.flush()
    db.add(Profile(user_id=u.id))
    db.commit()
    db.refresh(u)
    audit(db, user, "user.created", "user", u.id, entity_name=u.email,
          new_value={"full_name": u.full_name, "role": u.role, "admin_role": u.admin_role},
          ip=_ip(request))
    return admin_to_dict(u)


@router.delete("/users/{user_id}")
def delete_user(user_id: str, request: Request,
                db: Session = Depends(get_db), user: User = Depends(require_permission("users.suspend"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if u.role == "admin" and db.query(User).filter_by(role="admin").count() <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last admin account")
    from app.models.models import (
        Feedback,
        NewsBookmark,
        Notification,
        QuestionnaireSession,
        SavedScheme,
    )

    db.query(SavedScheme).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(NewsBookmark).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(Notification).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(Feedback).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.query(QuestionnaireSession).filter_by(user_id=user_id).delete(synchronize_session=False)
    db.delete(u)
    db.commit()
    audit(db, user, "user.deleted", "user", user_id, entity_name=u.email,
          new_value={"deleted": True}, ip=_ip(request))
    return {"ok": True}


@router.put("/users/{user_id}/toggle")
def toggle_user(user_id: str, request: Request,
                db: Session = Depends(get_db), user: User = Depends(require_permission("users.suspend"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.id == user.id and u.is_active:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")
    if u.role == "admin" and db.query(User).filter_by(role="admin", is_active=True).count() <= 1 and u.is_active:
        raise HTTPException(status_code=400, detail="Cannot disable the last active admin account")
    old = u.is_active
    u.is_active = not u.is_active
    db.commit()
    audit(db, user, "user.disabled" if not u.is_active else "user.enabled",
          "user", user_id, entity_name=u.email,
          old_value={"is_active": old}, new_value={"is_active": u.is_active}, ip=_ip(request))
    return {"ok": True, "is_active": u.is_active}


@router.put("/users/{user_id}/verify")
def verify_user(user_id: str, request: Request,
                db: Session = Depends(get_db), user: User = Depends(require_permission("users.edit"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.is_verified = True
    db.commit()
    audit(db, user, "user.verified", "user", user_id, entity_name=u.email,
          new_value={"is_verified": True}, ip=_ip(request))
    return {"ok": True}


# ------------------------------ Applications ------------------------------ #
@router.get("/applications")
def list_applications(db: Session = Depends(get_db), user: User = Depends(require_permission("applications.view"))):
    apps = db.query(Application).order_by(Application.created_at.desc()).limit(100).all()
    items = []
    for a in apps:
        u = db.get(User, a.user_id)
        items.append({
            "id": a.id, "application_id": a.application_id,
            "user": u.full_name if u else "?",
            "user_email": u.email if u else "",
            "scheme": a.qr_payload.get("scheme", ""),
            "applicant_name": a.applicant_name,
            "status": a.status, "eligibility_score": a.eligibility_score,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return {"items": items, "total": len(items)}


# ------------------------------ Knowledge Base ---------------------------- #
@router.get("/knowledge")
def list_knowledge(db: Session = Depends(get_db), user: User = Depends(require_permission("knowledge.view"))):
    docs = db.query(KnowledgeDoc).all()
    return {"items": [
        {"id": d.id, "title": d.title, "source": d.source, "category": d.category,
         "level": d.level, "state": d.state, "chunk_count": d.chunk_count,
         "is_indexed": d.is_indexed, "created_at": d.created_at.isoformat() if d.created_at else None}
        for d in docs
    ], "total": len(docs), "rag_backend": RAGStore().backend, "chunks": RAGStore().count()}


@router.post("/knowledge")
def add_knowledge(data: KnowledgeIn, db: Session = Depends(get_db), user: User = Depends(require_permission("knowledge.edit"))):
    k = KnowledgeDoc(title=data.title, content=data.content, source=data.source,
                     category=data.category, level=data.level, state=data.state)
    db.add(k)
    db.commit()
    db.refresh(k)
    return {"id": k.id}


@router.delete("/knowledge/{doc_id}")
def delete_knowledge(doc_id: str, db: Session = Depends(get_db), user: User = Depends(require_permission("knowledge.edit"))):
    k = db.get(KnowledgeDoc, doc_id)
    if not k:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(k)
    db.commit()
    return {"ok": True}


@router.post("/knowledge/index")
def index_knowledge(db: Session = Depends(get_db), user: User = Depends(require_permission("knowledge.review"))):
    store = RAGStore()
    store.clear()
    docs = []
    for k in db.query(KnowledgeDoc).all():
        docs.append((k.content or k.title, {"title": k.title, "source": k.source,
                                            "category": k.category, "level": k.level, "state": k.state}))
    count = store.add_documents(docs) if docs else 0
    db.query(KnowledgeDoc).update({"is_indexed": True})
    db.commit()
    return {"indexed_chunks": count, "backend": store.backend}


@router.post("/knowledge/search")
def search_knowledge(payload: dict, db: Session = Depends(get_db), user: User = Depends(require_permission("knowledge.view"))):
    store = RAGStore()
    results = store.search(payload.get("query", ""), k=6)
    return {"results": results}


# ------------------------------ Broadcast & News -------------------------- #
@router.post("/broadcast")
def broadcast(data: BroadcastIn, db: Session = Depends(get_db), user: User = Depends(require_permission("content.review"))):
    from app.services.notify import broadcast as do_broadcast

    n = do_broadcast(db, data.type, data.title, data.body, data.link, data.priority)
    return {"sent_to": n}


@router.post("/news", status_code=201)
def create_news(data: NewsIn, db: Session = Depends(get_db), user: User = Depends(require_permission("content.review"))):
    item = NewsItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id}


# ------------------------------ Feedback ---------------------------------- #
@router.get("/feedback")
def list_feedback(db: Session = Depends(get_db), user: User = Depends(require_permission("cases.view"))):
    items = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    out = []
    for f in items:
        u = db.get(User, f.user_id)
        out.append({"id": f.id, "user": u.full_name if u else "?", "email": u.email if u else "",
                    "subject": f.subject, "message": f.message, "rating": f.rating,
                    "status": f.status, "created_at": f.created_at.isoformat() if f.created_at else None})
    return {"items": out, "total": len(out)}


@router.put("/feedback/{fid}")
def resolve_feedback(fid: str, data: FeedbackResolveIn, db: Session = Depends(get_db), user: User = Depends(require_permission("support.resolve"))):
    f = db.get(Feedback, fid)
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")
    f.status = data.status
    db.commit()
    return {"ok": True}


@router.get("/agent-runs")
def agent_runs(db: Session = Depends(get_db), user: User = Depends(require_permission("ai.view"))):
    runs = db.query(AgentRun).order_by(AgentRun.created_at.desc()).limit(40).all()
    return {"items": [
        {"id": r.id, "agent": r.agent_name, "task": r.task, "status": r.status,
         "duration_ms": r.duration_ms,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in runs
    ]}


@router.get("/export/schemes")
def export_schemes(db: Session = Depends(get_db), user: User = Depends(require_permission("reports.export"))):
    import csv
    import io

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["code", "name", "ministry", "level", "category", "amount", "link"])
    for s in db.query(Scheme).all():
        w.writerow([s.code, s.name, s.ministry, s.level, s.category, s.amount, s.official_link])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="schemes.csv"'})
