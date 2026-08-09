from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.models import Notification, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _n_out(n: Notification) -> dict:
    return {
        "id": n.id, "type": n.type, "title": n.title, "body": n.body,
        "link": n.link, "priority": n.priority, "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(Notification).filter_by(user_id=user.id) \
        .order_by(Notification.created_at.desc()).limit(50).all()
    return {"items": [_n_out(n) for n in items], "total": len(items)}


@router.get("/unread-count")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.query(Notification).filter_by(user_id=user.id, is_read=False).count()
    return {"unread": count}


@router.post("/{nid}/read")
def mark_read(nid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter_by(id=nid, user_id=user.id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter_by(user_id=user.id, is_read=False).update({"is_read": True})
    db.commit()
    return {"ok": True}
