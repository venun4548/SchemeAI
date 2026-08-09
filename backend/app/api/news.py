from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.rbac import require_permission
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import NewsBookmark, NewsItem, User
from app.schemas.schemas import NewsIn

router = APIRouter(prefix="/news", tags=["news"])


def _news_out(n: NewsItem, bookmarked: bool = False) -> dict:
    return {
        "id": n.id, "title": n.title, "summary": n.summary, "ai_summary": n.ai_summary,
        "category": n.category, "level": n.level, "state": n.state, "source": n.source,
        "link": n.link, "is_new": n.is_new, "is_trending": n.is_trending,
        "published_at": n.published_at.isoformat() if n.published_at else None,
        "bookmarked": bookmarked,
    }


@router.get("")
def list_news(
    category: str | None = None,
    level: str | None = None,
    state: str | None = None,
    q: str | None = None,
    trending: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(NewsItem)
    if category:
        query = query.filter(NewsItem.category == category)
    if level:
        query = query.filter(NewsItem.level == level)
    if state and state != "all":
        query = query.filter((NewsItem.state == state) | (NewsItem.state == "all"))
    if trending:
        query = query.filter(NewsItem.is_trending.is_(True))
    if q:
        like = f"%{q}%"
        query = query.filter(NewsItem.title.ilike(like) | NewsItem.summary.ilike(like))
    items = query.order_by(NewsItem.published_at.desc()).all()
    bm = {b.news_id for b in db.query(NewsBookmark).filter_by(user_id=user.id).all()}
    return {"items": [_news_out(n, n.id in bm) for n in items], "total": len(items)}


@router.get("/categories")
def news_categories(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cats = db.query(NewsItem.category).distinct().all()
    return {"categories": [c[0] for c in cats if c[0]]}


@router.get("/{news_id}")
def get_news(news_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(NewsItem, news_id)
    if not n:
        raise HTTPException(status_code=404, detail="News item not found")
    bm = db.query(NewsBookmark).filter_by(user_id=user.id, news_id=news_id).first()
    return _news_out(n, bm is not None)


@router.post("/{news_id}/bookmark")
def bookmark(news_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.get(NewsItem, news_id):
        raise HTTPException(status_code=404, detail="News item not found")
    existing = db.query(NewsBookmark).filter_by(user_id=user.id, news_id=news_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"bookmarked": False}
    db.add(NewsBookmark(user_id=user.id, news_id=news_id))
    db.commit()
    return {"bookmarked": True}


@router.post("/{news_id}/summarize")
def summarize(news_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """AI summary - extractive sentence scoring without an LLM."""
    n = db.get(NewsItem, news_id)
    if not n:
        raise HTTPException(status_code=404, detail="News item not found")
    if n.ai_summary:
        return {"ai_summary": n.ai_summary}
    sentences = [s.strip() for s in n.summary.replace("\n", " ").split(". ") if s.strip()]
    if not sentences:
        sentences = [n.title]
    n.ai_summary = " · ".join(sentences[:2])
    db.commit()
    return {"ai_summary": n.ai_summary}


@router.post("", dependencies=[Depends(require_permission("content.review"))])
def create_news(data: NewsIn, db: Session = Depends(get_db)):
    n = NewsItem(**data.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    return _news_out(n)
