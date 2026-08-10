"""Chat API: multi-agent citizen assistant with conversation memory."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.security import get_current_user, get_optional_user
from app.database import get_db
from app.models.models import Conversation, ConversationMessage, User
from app.schemas.schemas import ChatIn
from app.services.chat import run_chat

router = APIRouter(prefix="/chat", tags=["chat"])


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    return (xff or request.client.host if request.client else "").split(",")[0].strip()


@router.post("")
def chat(
    data: ChatIn,
    request: Request,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    lang = data.context.get("language", "en") if data.context else "en"
    result = run_chat(
        db=db,
        message=data.message,
        user=user,
        conversation_id=(data.conversation_id or "").strip(),
        ip=_client_ip(request),
        language=lang,
    )
    if not result["success"] and result.get("intent") == "RATE_LIMITED":
        raise HTTPException(status_code=429, detail=result["message"])
    return result


@router.get("/conversations")
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    convs = (
        db.query(Conversation)
        .filter_by(user_id=user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
        .all()
    )
    return {
        "items": [
            {
                "id": c.id, "title": c.title, "message_count": c.message_count,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in convs
        ],
        "total": len(convs),
    }


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter_by(id=conversation_id, user_id=user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = (
        db.query(ConversationMessage)
        .filter_by(conversation_id=conv.id)
        .order_by(ConversationMessage.created_at.asc())
        .all()
    )
    return {
        "id": conv.id, "title": conv.title,
        "messages": [
            {
                "id": m.id, "role": m.role, "message": m.message, "intent": m.intent,
                "agents_used": m.agents_used, "sources": m.sources, "buttons": m.buttons,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in msgs
        ],
    }


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter_by(id=conversation_id, user_id=user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"success": True}


@router.post("/conversations/{conversation_id}/rename")
def rename_conversation(conversation_id: str, data: ChatIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter_by(id=conversation_id, user_id=user.id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    title = (data.message or "").strip()
    if title:
        conv.title = title[:120]
        db.commit()
    return {"success": True, "title": conv.title}
