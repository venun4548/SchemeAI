from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import scheme_to_dict
from app.core.rbac import require_permission
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import AnalyticsEvent, SavedScheme, Scheme, User
from app.schemas.schemas import SchemeIn

router = APIRouter(prefix="/schemes", tags=["schemes"])


def _query_params(q: str | None, state: str | None, category: str | None,
                  level: str | None, only_trending: bool = False):
    return {"q": q, "state": state, "category": category, "level": level, "only_trending": only_trending}


@router.get("")
def list_schemes(
    q: str | None = None,
    state: str | None = None,
    category: str | None = None,
    level: str | None = None,
    trending: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Scheme).filter(Scheme.is_active.is_(True))
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            (Scheme.name.ilike(like)) | (Scheme.keywords.ilike(like)) | (Scheme.code.ilike(like))
        )
    if state and state != "all":
        query = query.filter((Scheme.state_specific == state) | (Scheme.state_specific == "all"))
    if category:
        query = query.filter(Scheme.category == category)
    if level:
        query = query.filter(Scheme.level == level)
    if trending:
        query = query.filter(Scheme.is_trending.is_(True))

    total = query.count()
    items = query.order_by(Scheme.is_trending.desc(), Scheme.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()

    saved = {s.scheme_id for s in db.query(SavedScheme).filter_by(user_id=user.id).all()}
    results = [scheme_to_dict(s) for s in items]
    for r in results:
        r["is_saved"] = r["id"] in saved

    if q:
        db.add(AnalyticsEvent(user_id=user.id, event_type="search", state=user.profile.state if user.profile else "",
                              metadata={"q": q}))
        db.commit()
    return {"items": results, "total": total, "page": page, "page_size": page_size}


@router.get("/categories")
def categories(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cats = db.query(Scheme.category).distinct().all()
    return {"categories": [c[0] for c in cats if c[0]]}


@router.get("/saved")
def saved_schemes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(SavedScheme).filter_by(user_id=user.id).all()
    schemes = []
    for row in rows:
        s = db.get(Scheme, row.scheme_id)
        if s:
            schemes.append(scheme_to_dict(s))
    return {"items": schemes, "total": len(schemes)}


@router.get("/{scheme_id}")
def get_scheme(scheme_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.get(Scheme, scheme_id)
    if not s or not s.is_active:
        raise HTTPException(status_code=404, detail="Scheme not found")
    saved = db.query(SavedScheme).filter_by(user_id=user.id, scheme_id=scheme_id).first()
    d = scheme_to_dict(s)
    d["is_saved"] = saved is not None
    db.add(AnalyticsEvent(user_id=user.id, event_type="view_scheme", scheme_id=scheme_id,
                          state=user.profile.state if user.profile else ""))
    db.commit()
    return d


@router.post("/{scheme_id}/save")
def save_scheme(scheme_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.get(Scheme, scheme_id):
        raise HTTPException(status_code=404, detail="Scheme not found")
    if not db.query(SavedScheme).filter_by(user_id=user.id, scheme_id=scheme_id).first():
        db.add(SavedScheme(user_id=user.id, scheme_id=scheme_id))
        db.commit()
    return {"saved": True}


@router.delete("/{scheme_id}/save")
def unsave_scheme(scheme_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(SavedScheme).filter_by(user_id=user.id, scheme_id=scheme_id).delete()
    db.commit()
    return {"saved": False}


# ------------------------------ Admin -------------------------------------- #
@router.post("", dependencies=[Depends(require_permission("schemes.edit"))])
def create_scheme(data: SchemeIn, _: User = Depends(require_permission("schemes.edit")), db: Session = Depends(get_db)):
    if db.query(Scheme).filter_by(code=data.code).first():
        raise HTTPException(status_code=409, detail="Scheme code already exists")
    s = Scheme(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    from app.services.sheets_sync import scheme_row, sync_record
    sync_record("Schemes", scheme_row(s), id_column="scheme_id")
    return scheme_to_dict(s)


@router.put("/{scheme_id}", dependencies=[Depends(require_permission("schemes.edit"))])
def update_scheme(scheme_id: str, data: SchemeIn, db: Session = Depends(get_db)):
    s = db.get(Scheme, scheme_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")
    for k, v in data.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    from app.services.sheets_sync import scheme_row, sync_record
    sync_record("Schemes", scheme_row(s), id_column="scheme_id")
    return scheme_to_dict(s)


@router.delete("/{scheme_id}", dependencies=[Depends(require_permission("schemes.publish"))])
def delete_scheme(scheme_id: str, db: Session = Depends(get_db)):
    s = db.get(Scheme, scheme_id)
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")
    db.delete(s)
    db.commit()
    return {"ok": True}
