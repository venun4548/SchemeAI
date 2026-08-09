"""Notification engine - creates & dispatches user notifications."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.models import Notification, User


def notify(db: Session, user_id: str, ntype: str, title: str, body: str,
           link: str = "", priority: str = "normal") -> Notification:
    n = Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        link=link, priority=priority,
    )
    db.add(n)
    db.commit()
    db.refresh(n)

    from app.services.sheets_sync import notification_row, sync_record
    sync_record("Notifications", notification_row(n), id_column="notification_id")

    return n


def broadcast(db: Session, ntype: str, title: str, body: str,
              link: str = "", priority: str = "normal", user_ids: list[str] | None = None) -> int:
    q = db.query(User.id).filter(User.is_active.is_(True))
    if user_ids:
        q = q.filter(User.id.in_(user_ids))
    ids = [r[0] for r in q.all()]
    for uid in ids:
        db.add(Notification(user_id=uid, type=ntype, title=title, body=body,
                            link=link, priority=priority))
    db.commit()
    return len(ids)


def send_report_by_email(db: Session, user: User, report_bytes: bytes, subject: str) -> bool:
    """Email the generated report. Returns False when SMTP is not configured."""
    from app.config import settings

    if not settings.SMTP_HOST:
        return False
    import smtplib
    from email.mime.application import MIMEApplication
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    msg = MIMEMultipart()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = user.email
    msg["Subject"] = subject
    msg.attach(MIMEText("Your SchemeAI report is attached.", "plain"))
    part = MIMEApplication(report_bytes, _subtype="pdf")
    part.add_header("Content-Disposition", "attachment", filename="schemeai-report.pdf")
    msg.attach(part)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [user.email], msg.as_string())
        return True
    except Exception:
        return False
