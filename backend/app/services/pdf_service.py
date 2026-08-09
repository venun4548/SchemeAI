"""Professional PDF report generation (ReportLab platypus).

Produces brand-styled reports:
  - AI Eligibility Report
  - Scheme Comparison report
  - Application summary / QR card
"""
from __future__ import annotations

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    Image,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.config import BASE_DIR

# Brand palette
FOREST = colors.HexColor("#0F4C3A")
EMERALD = colors.HexColor("#1E7A57")
GOLD = colors.HexColor("#C79A2D")
IVORY = colors.HexColor("#F8F7F2")
TEXT = colors.HexColor("#1C1C1C")
MUTED = colors.HexColor("#6B7280")
SUCCESS = colors.HexColor("#2E8B57")
WARNING = colors.HexColor("#D97706")
ERROR = colors.HexColor("#C0392B")

_FONT = "Helvetica"
_FONT_B = "Helvetica-Bold"


def _styles() -> dict:
    s = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("H1", fontName=_FONT_B, fontSize=22, leading=27, textColor=FOREST, spaceAfter=4),
        "subtitle": ParagraphStyle("H2", fontName=_FONT, fontSize=10.5, leading=14, textColor=MUTED),
        "h2": ParagraphStyle("H2b", fontName=_FONT_B, fontSize=13, leading=16, textColor=FOREST, spaceBefore=12, spaceAfter=6),
        "body": ParagraphStyle("Body", fontName=_FONT, fontSize=9.5, leading=13, textColor=TEXT),
        "body_b": ParagraphStyle("BodyB", fontName=_FONT_B, fontSize=9.5, leading=13, textColor=TEXT),
        "small": ParagraphStyle("Small", fontName=_FONT, fontSize=8, leading=11, textColor=MUTED),
        "cell": ParagraphStyle("Cell", fontName=_FONT, fontSize=8.5, leading=11, textColor=TEXT),
    }


def _brand_header_footer(can: canvas.Canvas, doc):
    can.saveState()
    can.setStrokeColor(GOLD)
    can.setLineWidth(1)
    can.line(18 * mm, 280 * mm, 192 * mm, 280 * mm)
    can.setFont(_FONT, 8)
    can.setFillColor(MUTED)
    can.drawString(18 * mm, 12 * mm, "SchemeAI · Multi-Agent Government Scheme Assistant")
    can.drawRightString(192 * mm, 12 * mm, f"Generated {datetime.now().strftime('%d %b %Y, %H:%M')}")
    can.setFillColor(FOREST)
    can.setFont(_FONT_B, 9)
    can.drawString(18 * mm, 284 * mm, "SchemeAI")
    can.restoreState()


def _make_table(headers: list[str], rows: list[list], widths=None) -> Table:
    st = _styles()
    data = [[Paragraph(h, ParagraphStyle("th", fontName=_FONT_B, fontSize=8.5, textColor=colors.white)) for h in headers]]
    for r in rows:
        data.append([Paragraph(str(c), st["cell"]) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), FOREST),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F2EFE7")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E8E5DD")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def _score_cell(score: float) -> str:
    if score >= 75:
        color = "green"
    elif score >= 45:
        color = "orange"
    else:
        color = "red"
    return f'<font color="{color}"><b>{score:.0f}%</b></font>'


def build_eligibility_report(payload: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=24 * mm, bottomMargin=20 * mm)
    st = _styles()
    flow: list = []

    profile = payload.get("profile", {})
    scores = payload.get("scores", [])
    explanation = payload.get("explanation", {})
    document_status = payload.get("document_status", {})
    guidance = payload.get("guidance", {})
    qr_b64 = payload.get("qr", "")

    flow.append(Paragraph("AI Eligibility Report", st["title"]))
    flow.append(Paragraph(f"Prepared for {profile.get('full_name', 'Citizen')} · {datetime.now().strftime('%d %b %Y')} · {payload.get('runtime_ms', 0)}ms AI analysis", st["subtitle"]))
    flow.append(Spacer(1, 8))

    # Profile
    flow.append(Paragraph("Citizen Profile", st["h2"]))
    flow.append(_make_table(["Attribute", "Value"], [
        ["Age", profile.get("age", "—")],
        ["Gender", profile.get("gender", "—")],
        ["State / District", f"{profile.get('state', '—')} / {profile.get('district', '—')}"],
        ["Occupation", profile.get("occupation", "—")],
        ["Annual Income", f"₹{profile.get('annual_income', 0):,.0f}" if profile.get("annual_income") else "—"],
        ["Education", profile.get("education", "—")],
        ["Category", profile.get("category", "—")],
        ["Disability", profile.get("disability", "—")],
    ], widths=[55 * mm, 119 * mm]))
    flow.append(Spacer(1, 6))

    # Top schemes
    flow.append(Paragraph("Eligible Schemes (AI Ranked)", st["h2"]))
    if scores:
        rows = [[s.get("scheme_name"), _score_cell(s.get("score", 0)),
                 s.get("status", "").title(), f'{s.get("confidence", 0):.0f}%',
                 f'{s.get("approval_probability", 0):.0f}%'] for s in scores[:8]]
        flow.append(_make_table(["Scheme", "Score", "Status", "Confidence", "Approval"], rows,
                                widths=[66 * mm, 22 * mm, 26 * mm, 26 * mm, 24 * mm]))
    else:
        flow.append(Paragraph("No eligible schemes found.", st["body"]))

    # Explanation
    if explanation:
        flow.append(Paragraph("AI Explanation", st["h2"]))
        why = explanation.get("why_eligible", [])
        why_not = explanation.get("why_not_eligible", [])
        items = []
        for w in why[:5]:
            items.append(ListItem(Paragraph(f"✔ {w}", st["body"]), leftIndent=6))
        for w in why_not[:5]:
            items.append(ListItem(Paragraph(f"✖ {w}", st["body"]), leftIndent=6))
        for step in explanation.get("next_steps", [])[:4]:
            items.append(ListItem(Paragraph(f"→ {step}", st["body"]), leftIndent=6))
        if items:
            flow.append(ListFlowable(items, bulletType="bullet", start="•"))
        flow.append(Paragraph(
            f'<para><b>Approval probability:</b> {explanation.get("approval_probability", 0):.0f}% · '
            f'<b>Confidence:</b> {explanation.get("confidence", 0):.0f}%</para>', st["body"]))

    # Documents
    flow.append(Paragraph("Required & Missing Documents", st["h2"]))
    docs_rows = [[d, "Uploaded" if d in (document_status.get("uploaded") or []) else "Missing"]
                 for d in (document_status.get("required") or [])]
    if not docs_rows:
        docs_rows = [["No documents required", "—"]]
    flow.append(_make_table(["Document", "Status"], docs_rows, widths=[120 * mm, 54 * mm]))

    # Steps
    if guidance.get("steps"):
        flow.append(Paragraph("Application Roadmap", st["h2"]))
        flow.append(ListFlowable([
            ListItem(Paragraph(f'<b>Step {x.get("step")}.</b> {x.get("title")} — {x.get("detail", "")}', st["body"]), leftIndent=8)
            for x in guidance["steps"]
        ]))

    # QR + links
    if qr_b64:
        flow.append(Spacer(1, 10))
        qr_bytes = __import__("base64").b64decode(qr_b64)
        import tempfile, os
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.write(qr_bytes); tmp.close()
        flow.append(Paragraph("Verification Code", st["h2"]))
        flow.append(Image(tmp.name, width=40 * mm, height=40 * mm))
        flow.append(Paragraph("Scan to verify this report on SchemeAI.", st["small"]))
        flow.append(Spacer(1, 6))

    flow.append(PageBreak())
    flow.append(Paragraph("Official Links", st["h2"]))
    for s in scores[:8]:
        link = s.get("official_link") or "#"
        if link == "#":
            flow.append(Paragraph(f"• <b>{s.get('scheme_name')}</b> — portal details in the SchemeAI app.", st["body"]))
        else:
            flow.append(Paragraph(f"• <b>{s.get('scheme_name')}</b> — <link href=\"{link}\" color=\"blue\">{link}</link>", st["body"]))

    doc.build(flow, onFirstPage=_brand_header_footer, onLaterPages=_brand_header_footer)
    return buf.getvalue()


def build_comparison_report(payload: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=24 * mm, bottomMargin=20 * mm)
    st = _styles()
    flow: list = []
    schemes = payload.get("schemes", [])
    analysis = payload.get("analysis", {})

    flow.append(Paragraph("AI Scheme Comparison", st["title"]))
    flow.append(Paragraph(f"{datetime.now().strftime('%d %b %Y')} · {len(schemes)} schemes compared", st["subtitle"]))
    flow.append(Spacer(1, 8))

    headers = ["Attribute"] + [s.get("short_name") or s.get("name", "")[:28] for s in schemes]
    def row(label, getter):
        return [label] + [getter(s) or "—" for s in schemes]

    rows = [
        row("Ministry", lambda s: s.get("ministry")),
        row("Category", lambda s: s.get("category")),
        row("Benefit", lambda s: ", ".join(b.get("label", "") for b in (s.get("benefits") or [])[:3])),
        row("Amount", lambda s: s.get("amount")),
        row("Duration", lambda s: s.get("duration")),
        row("Application time", lambda s: s.get("application_time")),
        row("Renewal", lambda s: s.get("renewal_policy")[:80]),
        row("Documents", lambda s: ", ".join((s.get("required_documents") or [])[:4])),
    ]
    flow.append(_make_table(headers, rows))
    flow.append(Spacer(1, 10))

    flow.append(Paragraph("AI Verdict", st["h2"]))
    flow.append(Paragraph(analysis.get("verdict", "—"), st["body"]))
    if analysis.get("pros") or analysis.get("cons"):
        flow.append(Paragraph("Pros", st["h2"]))
        flow.append(ListFlowable([ListItem(Paragraph(p, st["body"])) for p in analysis.get("pros", [])]))
        flow.append(Paragraph("Cons", st["h2"]))
        flow.append(ListFlowable([ListItem(Paragraph(c, st["body"])) for c in analysis.get("cons", [])]))

    doc.build(flow, onFirstPage=_brand_header_footer, onLaterPages=_brand_header_footer)
    return buf.getvalue()


def build_application_pdf(payload: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=24 * mm, bottomMargin=20 * mm)
    st = _styles()
    flow: list = []

    flow.append(Paragraph("Application Summary", st["title"]))
    flow.append(Paragraph(f"Application ID: {payload.get('application_id')}", st["subtitle"]))
    flow.append(Spacer(1, 8))

    flow.append(_make_table(["Field", "Value"], [
        ["Scheme", payload.get("scheme_name")],
        ["Applicant", payload.get("applicant_name")],
        ["Status", payload.get("status")],
        ["Current step", f'{payload.get("current_step", 0)} / {len(payload.get("steps", []) or [])}'],
        ["Submitted", payload.get("submitted_at", "—")],
        ["Eligibility score", f'{payload.get("eligibility_score", 0):.0f}%'],
    ], widths=[55 * mm, 119 * mm]))
    flow.append(Spacer(1, 8))

    flow.append(Paragraph("Timeline", st["h2"]))
    flow.append(ListFlowable([
        ListItem(Paragraph(f'<b>{t.get("ts", "")}</b> — {t.get("status", "")}: {t.get("note", "")}', st["body"]))
        for t in payload.get("timeline", [])
    ]))

    if payload.get("qr"):
        qr_bytes = __import__("base64").b64decode(payload["qr"])
        import tempfile, os
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.write(qr_bytes); tmp.close()
        flow.append(Paragraph("Application QR Card", st["h2"]))
        flow.append(Image(tmp.name, width=45 * mm, height=45 * mm))
        flow.append(Paragraph("Scan to verify this application.", st["small"]))

    doc.build(flow, onFirstPage=_brand_header_footer, onLaterPages=_brand_header_footer)
    return buf.getvalue()
