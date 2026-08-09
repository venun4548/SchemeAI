"""Best-effort mirror of key records into Google Sheets via the Apps Script bridge.

The FastAPI backend remains the source of truth (SQLite). When ``settings.GAS_WEBAPP_URL``
is set to a deployed Apps Script web app, writes are POSTed to its public ``syncRecord``
action which appends/updates a row in the matching sheet. Failures are logged and never
raised, so the API keeps working even when Google is unreachable.
"""
from __future__ import annotations

import json
import logging
import threading

log = logging.getLogger("sheets_sync")


def sync_record(sheet: str, record: dict, id_column: str = "") -> None:
    """Fire-and-forget write to the Google Sheet (threaded, non-blocking)."""
    from app.config import settings

    url = (settings.GAS_WEBAPP_URL or "").strip()
    if not url:
        return

    def _send():
        try:
            import httpx

            payload = {"action": "syncRecord", "sheet": sheet, "id_column": id_column, "record": record}
            # Google Apps Script returns 302 on POST and redirects to a GET, which drops the payload.
            # We use follow_redirects=False to ensure the POST executes, and we treat 302 as success.
            with httpx.Client(timeout=15.0, follow_redirects=False) as client:
                r = client.post(url, params={"action": "syncRecord"}, json=payload)
                
            if r.status_code in (200, 302, 303):
                log.info("sheets_sync %s POST OK", sheet)
            else:
                log.warning("sheets_sync %s -> HTTP %s: %s", sheet, r.status_code, r.text[:300])
        except Exception as exc:  # noqa: BLE001 - never break the request path
            log.warning("sheets_sync %s failed: %s", sheet, exc)

    threading.Thread(target=_send, daemon=True).start()


# --------------------------------------------------------------------------- #
# Row builders - map backend records to the GAS Database.gs column layouts.
# --------------------------------------------------------------------------- #
def user_row(user) -> dict:
    return {
        "user_id": getattr(user, "id", ""),
        "full_name": getattr(user, "full_name", ""),
        "email": getattr(user, "email", ""),
        "phone": getattr(user, "phone", ""),
        "status": "active" if getattr(user, "is_active", True) else "inactive",
        "created_at": (user.created_at.isoformat() if user.created_at else "") if hasattr(user, "created_at") else "",
    }


def application_row(app) -> dict:
    return {
        "application_id": getattr(app, "application_id", ""),
        "user_id": getattr(app, "user_id", ""),
        "scheme_id": getattr(app, "scheme_id", ""),
        "status": getattr(app, "status", ""),
        "priority": getattr(app, "priority", "normal"),
        "updated_at": (app.updated_at.isoformat() if app.updated_at else "") if hasattr(app, "updated_at") else "",
        "submitted_at": "",
    }


def document_row(doc) -> dict:
    return {
        "document_id": getattr(doc, "id", ""),
        "user_id": getattr(doc, "user_id", ""),
        "document_type": getattr(doc, "doc_type", ""),
        "status": getattr(doc, "status", ""),
        "uploaded_at": (doc.uploaded_at.isoformat() if doc.uploaded_at else "") if hasattr(doc, "uploaded_at") else "",
        "document_url": getattr(doc, "file_path", ""),
    }


def notification_row(n) -> dict:
    return {
        "notification_id": getattr(n, "id", ""),
        "user_id": getattr(n, "user_id", ""),
        "type": getattr(n, "type", ""),
        "title": getattr(n, "title", ""),
        "message": getattr(n, "body", ""),
        "read_status": "read" if getattr(n, "is_read", False) else "unread",
        "created_at": (n.created_at.isoformat() if n.created_at else "") if hasattr(n, "created_at") else "",
    }


def audit_row(log) -> dict:
    return {
        "audit_id": getattr(log, "id", ""),
        "admin_id": getattr(log, "actor_id", ""),
        "role": getattr(log, "actor_role", ""),
        "action": getattr(log, "action", ""),
        "entity_type": getattr(log, "entity", ""),
        "entity_id": getattr(log, "entity_id", ""),
        "old_value": json.dumps(getattr(log, "old_value", {}) or {}),
        "new_value": json.dumps(getattr(log, "new_value", {}) or {}),
        "ip_address": getattr(log, "ip", ""),
        "timestamp": (log.created_at.isoformat() if log.created_at else "") if hasattr(log, "created_at") else "",
    }


def support_case_row(c) -> dict:
    return {
        "case_id": getattr(c, "id", ""),
        "user_id": getattr(c, "user_id", ""),
        "subject": getattr(c, "subject", ""),
        "category": getattr(c, "issue_type", ""),
        "description": getattr(c, "description", ""),
        "priority": getattr(c, "priority", ""),
        "status": getattr(c, "status", ""),
        "created_at": (c.created_at.isoformat() if c.created_at else "") if hasattr(c, "created_at") else "",
        "updated_at": (c.updated_at.isoformat() if c.updated_at else "") if hasattr(c, "updated_at") else "",
        "resolved_at": (c.resolved_at.isoformat() if c.resolved_at else "") if hasattr(c, "resolved_at") else "",
    }


def scheme_row(s) -> dict:
    return {
        "scheme_id": getattr(s, "id", ""),
        "scheme_name": getattr(s, "name", ""),
        "description": getattr(s, "description", "") or "",
        "category": getattr(s, "category", "") or "",
        "government_level": getattr(s, "level", "") or "",
        "state": getattr(s, "state_specific", "") or "",
        "benefit": getattr(s, "amount", "") or "",
        "required_documents": ", ".join(getattr(s, "required_documents", []) or []),
        "official_url": getattr(s, "official_link", "") or "",
        "status": getattr(s, "lifecycle_status", "") or ("active" if getattr(s, "is_active", False) else "inactive"),
        "updated_at": (s.updated_at.isoformat() if s.updated_at else "") if hasattr(s, "updated_at") else "",
    }
