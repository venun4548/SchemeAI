"""Audit trail helper for sensitive admin operations."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.models import AuditLog, User


def audit(
    db: Session,
    actor: User | None,
    action: str,
    entity: str,
    entity_id: str = "",
    entity_name: str = "",
    old_value: dict | None = None,
    new_value: dict | None = None,
    reason: str = "",
    result: str = "success",
    ip: str = "",
) -> AuditLog:
    log = AuditLog(
        actor_id=actor.id if actor else "",
        actor_name=actor.full_name if actor else "system",
        actor_role=actor.admin_role if actor and actor.role == "admin" else (actor.role if actor else "system"),
        action=action,
        entity=entity,
        entity_id=entity_id,
        entity_name=entity_name,
        old_value=old_value or {},
        new_value=new_value or {},
        reason=reason,
        result=result,
        ip=ip,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    from app.services.sheets_sync import audit_row, sync_record
    sync_record("AuditLogs", audit_row(log), id_column="audit_id")

    return log


def audit_to_dict(a: AuditLog) -> dict:
    return {
        "id": a.id,
        "actor_id": a.actor_id,
        "actor_name": a.actor_name,
        "actor_role": a.actor_role,
        "action": a.action,
        "entity": a.entity,
        "entity_id": a.entity_id,
        "entity_name": a.entity_name,
        "old_value": a.old_value,
        "new_value": a.new_value,
        "reason": a.reason,
        "result": a.result,
        "ip": a.ip,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
