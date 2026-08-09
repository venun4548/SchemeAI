from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import profile_to_dict
from app.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import Scheme, UserDocument, User
from app.services.document_analyzer import analyze_document

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED = {".png", ".jpg", ".jpeg", ".webp", ".pdf"}
MAX_SIZE = 10 * 1024 * 1024


def _doc_out(d: UserDocument) -> dict:
    return {
        "id": d.id, "doc_type": d.doc_type, "display_name": d.display_name,
        "file_name": d.file_name, "file_size": d.file_size, "mime_type": d.mime_type,
        "status": d.status, "is_verified": d.is_verified, "expiry_date": d.expiry_date,
        "is_blurry": d.is_blurry, "is_duplicate": d.is_duplicate, "fake_risk": d.fake_risk,
        "extracted_fields": d.extracted_fields, "analyzer_report": d.analyzer_report,
        "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
    }


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    family_member_id: str = Form(""),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PNG, JPG, WEBP or PDF.")
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 10 MB")

    import hashlib

    sha = hashlib.sha256(contents).hexdigest()
    dup = db.query(UserDocument).filter_by(user_id=user.id, file_hash=sha).first()
    is_dup = dup is not None

    safe = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{user.id[:8]}{ext}"
    path = settings.UPLOAD_DIR / safe
    path.write_bytes(contents)

    report, sha2, ocr = analyze_document(str(path), file.filename, file.content_type or "", profile_to_dict(user.profile))
    doc = UserDocument(
        user_id=user.id,
        family_member_id=family_member_id or None,
        doc_type=report["doc_type"],
        display_name=file.filename,
        file_name=file.filename,
        file_path=str(path),
        file_hash=sha,
        file_size=len(contents),
        mime_type=file.content_type or "",
        ocr_text=ocr,
        extracted_fields=report.get("extracted_fields", {}),
        status="analyzed" if report.get("fake_risk", 0) < 0.5 else "pending",
        expiry_date=report.get("expiry_date"),
        is_blurry=report.get("is_blurry", False),
        is_duplicate=is_dup,
        fake_risk=report.get("fake_risk", 0.0),
        analyzer_report={k: v for k, v in report.items() if k != "extracted_fields"},
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    from app.services.sheets_sync import sync_record, document_row
    sync_record("Documents", document_row(doc), id_column="document_id")

    return _doc_out(doc)


@router.get("")
def list_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(UserDocument).filter_by(user_id=user.id).order_by(UserDocument.uploaded_at.desc()).all()
    return {"items": [_doc_out(d) for d in docs], "total": len(docs)}


@router.get("/missing")
def missing_documents(scheme_id: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    uploaded = {d.doc_type for d in db.query(UserDocument).filter_by(user_id=user.id).all()}
    if scheme_id:
        s = db.get(Scheme, scheme_id)
        if not s:
            raise HTTPException(status_code=404, detail="Scheme not found")
        required = s.required_documents or []
        return {"required": required, "uploaded": [d for d in required if d in uploaded],
                "missing": [d for d in required if d not in uploaded]}
    return {"uploaded": sorted(uploaded)}


@router.get("/{doc_id}")
def get_document(doc_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(UserDocument).filter_by(id=doc_id, user_id=user.id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Document not found")
    return _doc_out(d)


@router.post("/{doc_id}/analyze")
def reanalyze(doc_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(UserDocument).filter_by(id=doc_id, user_id=user.id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Document not found")
    report, sha, ocr = analyze_document(d.file_path, d.file_name, d.mime_type, profile_to_dict(user.profile))
    d.ocr_text = ocr
    d.extracted_fields = report.get("extracted_fields", {})
    d.expiry_date = report.get("expiry_date")
    d.is_blurry = report.get("is_blurry", False)
    d.fake_risk = report.get("fake_risk", 0.0)
    d.analyzer_report = {k: v for k, v in report.items() if k != "extracted_fields"}
    db.commit()
    db.refresh(d)
    return _doc_out(d)


@router.delete("/{doc_id}")
def delete_document(doc_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.query(UserDocument).filter_by(id=doc_id, user_id=user.id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        if os.path.exists(d.file_path):
            os.remove(d.file_path)
    except OSError:
        pass
    db.delete(d)
    db.commit()
    return {"ok": True}
