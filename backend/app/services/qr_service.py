"""QR code generation for application cards and eligibility reports."""
from __future__ import annotations

import io

import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import RadialGradiantColorMask

from app.config import settings


def make_qr(data: dict | str) -> bytes:
    payload = data if isinstance(data, str) else __import__("json").dumps(data, ensure_ascii=False)
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(
        image_factory=StyledPilImage,
        color_mask=RadialGradiantColorMask(
            back_color=(248, 247, 242),
            center_color=(15, 76, 58),
            edge_color=(199, 154, 45),
        ),
    )
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def application_qr_payload(application_id: str, user_id: str, scheme_name: str, status: str) -> dict:
    from datetime import datetime, timezone

    return {
        "type": "schemeai_application",
        "application_id": application_id,
        "user_id": user_id,
        "scheme": scheme_name,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "verify_url": f"/verify/{application_id}",
    }
