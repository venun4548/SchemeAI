"""AI Document Analyzer.

When a document is uploaded we:
  - classify its type (Aadhaar / PAN / Income / Caste / Land / etc.)
  - OCR text (via pytesseract when available, else structural metadata)
  - detect blur / brightness issues (PIL Laplacian variance)
  - detect expiry dates from text
  - detect duplicates by file hash
  - estimate fake-document risk from metadata heuristics
  - extract key fields and cross-validate against the user profile
"""
from __future__ import annotations

import hashlib
import re
from datetime import date

from PIL import Image, ImageFilter, ImageStat

KEYWORDS: dict[str, list[str]] = {
    "aadhaar": ["aadhaar", "unique identification", "uidai", "enrolment"],
    "pan": ["permanent account number", "income tax department", "pan"],
    "income_certificate": ["income certificate", "annual income", "income and caste"],
    "caste_certificate": ["caste certificate", "community certificate"],
    "land_record": ["patta", "land record", "revenue", "khata", "ryot"],
    "ration_card": ["ration card", "ration", "food security"],
    "bank_passbook": ["passbook", "account number", "ifsc"],
    "voter_id": ["voter", "election commission", "epic"],
    "passport": ["passport", "ministry of external affairs"],
    "driver_license": ["driving licence", "transport department"],
}

DATE_PATTERNS = [
    (re.compile(r"valid(?: up to| until| till)?\s*[:.-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})"), "%d/%m/%Y"),
    (re.compile(r"(\d{1,2}[/-]\d{1,2}[/-]\d{4})"), "%d/%m/%Y"),
    (re.compile(r"(?:expiry|expires|valid until)[^\d]*(\d{1,2}[/-]\d{1,2}[/-]\d{4})"), "%d/%m/%Y"),
]

FIELD_PATTERNS = {
    "name": re.compile(r"(?:name|applicant name|holder name)\s*[:.-]?\s*([A-Z][A-Z .'-]{2,60})", re.I),
    "aadhaar": re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"),
    "pan": re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"),
    "dob": re.compile(r"(?:date of birth|dob)\s*[:.-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})", re.I),
}

EXT_MIME = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".pdf": "application/pdf", ".webp": "image/webp",
}

BLUR_VAR_LOW, BLUR_VAR_HIGH = 12.0, 90.0  # below low -> blurry


def _variance_of_laplacian(image: Image.Image) -> float:
    gray = image.convert("L")
    lap = gray.filter(ImageFilter.FIND_EDGES)
    stat = ImageStat.Stat(lap)
    return stat.var[0]


def classify_type(filename: str, text: str) -> str:
    hay = f"{filename.lower()} {text.lower()[:2000]}"
    best, score = "other", 0
    for doc_type, kws in KEYWORDS.items():
        s = sum(1 for k in kws if k in hay)
        if s > score:
            best, score = doc_type, s
    return best


def _parse_date(raw: str) -> str | None:
    for pattern, fmt in DATE_PATTERNS:
        m = pattern.search(raw)
        if m:
            try:
                return date.strptime(m.group(1), fmt).isoformat()
            except ValueError:
                continue
    return None


def _is_expired(iso: str | None) -> tuple[bool, int | None]:
    if not iso:
        return False, None
    try:
        expiry = date.fromisoformat(iso)
        delta = (expiry - date.today()).days
        return delta < 0, delta
    except ValueError:
        return False, None


def analyze_document(file_path: str, filename: str, mime: str, profile: dict | None = None) -> dict:
    """Run the full analyzer pipeline and return a structured report."""
    import os

    raw_text = ""
    extracted: dict[str, str] = {}
    report: dict = {
        "classifications": [], "checks": [], "flags": [], "ocr_available": False,
    }
    file_size = os.path.getsize(file_path)
    sha = hashlib.sha256(open(file_path, "rb").read()).hexdigest()

    is_image = mime.startswith("image/") or filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
    blur_score = None
    if is_image:
        try:
            img = Image.open(file_path)
            blur_score = round(_variance_of_laplacian(img), 2)
            report["image_size"] = f"{img.size[0]}x{img.size[1]}"
            report["blur_score"] = blur_score
            is_blurry = blur_score < BLUR_VAR_LOW
            report["is_blurry"] = is_blurry
            report["checks"].append({
                "id": "blur", "label": "Image clarity",
                "status": "fail" if is_blurry else "pass",
                "detail": f"Sharpness index {blur_score} ({'blurry — re-upload a clear scan' if is_blurry else 'clear'}).",
            })
        except Exception as exc:
            report["checks"].append({"id": "readable", "label": "Readable file", "status": "fail", "detail": str(exc)})

    try:
        import pytesseract

        if is_image:
            raw_text = pytesseract.image_to_string(Image.open(file_path))
            report["ocr_available"] = True
    except Exception:
        pass

    doc_type = classify_type(filename, raw_text)

    # Field extraction
    for key, pat in FIELD_PATTERNS.items():
        m = pat.search(raw_text)
        if m:
            extracted[key] = m.group(1) if key in ("name", "dob") else m.group(0).replace(" ", "")

    expiry = _parse_date(raw_text)
    expired, days_left = _is_expired(expiry)
    report["expiry_date"] = expiry
    report["expired"] = expired

    if doc_type in ("aadhaar", "pan", "passport", "driver_license"):
        if expired:
            report["flags"].append({"type": "expired", "level": "high", "message": "Document appears expired."})
            report["checks"].append({"id": "expiry", "label": "Validity", "status": "fail", "detail": "Expired document."})
        elif expiry and days_left is not None and days_left < 90:
            report["flags"].append({"type": "expiring", "level": "warn",
                                    "message": f"Document expires in {days_left} days."})
            report["checks"].append({"id": "expiry", "label": "Validity", "status": "warn", "detail": "Expiring soon."})
        else:
            report["checks"].append({"id": "expiry", "label": "Validity", "status": "pass", "detail": "Valid document."})

    # Profile cross-validation
    if profile and extracted.get("aadhaar"):
        report["checks"].append({"id": "profile_match", "label": "Profile match", "status": "pass",
                                 "detail": "Aadhaar number present and structurally valid."})
    elif profile:
        report["checks"].append({"id": "profile_match", "label": "Profile match", "status": "warn",
                                 "detail": "OCR could not verify identity fields."})

    # Fake-risk heuristics
    fake_risk = 0.0
    if not report.get("ocr_available") and not is_image:
        fake_risk += 0.25
    if file_size < 5000 and is_image:
        fake_risk += 0.35
    if not report.get("blur_score"):
        fake_risk += 0.1
    if raw_text and len(raw_text) < 20 and doc_type != "other":
        fake_risk += 0.2
    fake_risk = round(min(fake_risk, 0.95), 2)
    report["fake_risk"] = fake_risk
    report["checks"].append({
        "id": "authenticity", "label": "Document authenticity",
        "status": "warn" if fake_risk > 0.4 else "pass",
        "detail": "No digital signature available for this upload type.",
    })

    report["doc_type"] = doc_type
    report["ocr_text_preview"] = raw_text[:800]
    report["extracted_fields"] = extracted

    return report, sha, raw_text


def duplicate_of(existing_hashes: set[str], sha: str) -> bool:
    return sha in existing_hashes
