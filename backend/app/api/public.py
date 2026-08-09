from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import scheme_to_dict
from app.database import get_db
from app.models.models import Scheme

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/schemes")
def public_schemes(
    category: str | None = None,
    q: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Scheme).filter(Scheme.is_active.is_(True))
    if category:
        query = query.filter(Scheme.category == category)
    if q:
        like = f"%{q}%"
        query = query.filter(Scheme.name.ilike(like) | Scheme.keywords.ilike(like))
    if state and state != "all":
        query = query.filter((Scheme.state_specific == state) | (Scheme.state_specific == "all"))
    items = query.order_by(Scheme.is_trending.desc()).limit(60).all()
    out = [scheme_to_dict(s, include_rules=False) for s in items]
    for r, s in zip(out, items):
        r["is_trending"] = s.is_trending
    cats = db.query(Scheme.category).distinct().all()
    return {
        "items": out,
        "total": len(out),
        "categories": [c[0] for c in cats if c[0]],
        "trending_count": sum(1 for s in items if s.is_trending),
    }


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    total = db.query(Scheme).filter_by(is_active=True).count()
    trending = db.query(Scheme).filter_by(is_trending=True).count()
    return {"total_schemes": total, "trending_schemes": trending,
            "states_covered": 28, "languages": ["English", "हिन्दी", "తెలుగు", "தமிழ்", "ಕನ್ನಡ", "मराठी"]}
