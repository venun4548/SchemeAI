"""Multi-agent chat service for the SchemeAI citizen assistant.

Every answer is generated from real data: the scheme catalogue, the rule
eligibility engine, the user's own profile / documents / applications, and the
RAG index. There are no canned answers beyond fixed informational text. An
optional LLM (when OPENAI_API_KEY is set) may only *rephrase* the verified
draft, never add facts.
"""
from __future__ import annotations

import contextlib
import re
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents.eligibility_engine import evaluate_scheme_tri, schema_completeness
from app.agents.profile import derive
from app.api.applications import _steps_for
from app.api.deps import profile_to_dict, scheme_to_dict
from app.models.models import (
    Application,
    ChatLog,
    Conversation,
    ConversationMessage,
    Scheme,
    User,
    UserDocument,
)
from app.services.llm import polish_reply

RATE_PER_MINUTE = 30
RATE_PER_DAY = 300

STATUS_LABELS = {
    "draft": "Draft", "in_progress": "In progress", "submitted": "Submitted",
    "under_review": "Under review", "approved": "Approved", "disbursed": "Disbursed",
    "rejected": "Rejected",
}

CATEGORY_LABELS = {
    "agriculture": "Agriculture", "education": "Education", "women": "Women & child",
    "pension": "Pensions & social security", "business": "Business & self-employment",
    "housing": "Housing", "health": "Health", "skill": "Skill development",
    "energy": "Energy & utilities", "rural": "Rural development", "disability": "Disability welfare",
}

# Map uploaded document types (document_analyzer) to words that commonly appear
# in a scheme's free-text required_documents list.
DOC_TYPE_ALIASES = {
    "aadhaar": ["aadhaar", "unique identification"],
    "pan": ["pan"],
    "income_certificate": ["income"],
    "caste_certificate": ["caste", "community"],
    "land_record": ["land", "patta", "khata", "adangal", "pahani", "record", "ror"],
    "ration_card": ["ration", "food security", "bpl"],
    "bank_passbook": ["bank", "passbook", "account", "dbt"],
    "voter_id": ["voter", "epic"],
    "passport": ["passport", "photo"],
    "driver_license": ["licence", "license", "driving"],
}

_windows: dict[str, deque] = defaultdict(deque)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
@contextlib.contextmanager
def _timed(agents: list[dict], name: str, task: str):
    entry = {"name": name, "task": task, "duration_ms": 0}
    t0 = time.perf_counter()
    try:
        yield entry
    finally:
        entry["duration_ms"] = round((time.perf_counter() - t0) * 1000)
        agents.append(entry)


def _norm_key(v: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(v).lower())


def _btn(label: str, prompt: str, kind: str = "message", url: str = "") -> dict:
    return {"label": label, "prompt": prompt, "kind": kind, "url": url}


def _sources_for(scheme: Scheme) -> list[dict]:
    if scheme.official_link:
        return [{"title": f"Official information: {scheme.name}", "link": scheme.official_link, "kind": "official"}]
    if scheme.application_portal:
        return [{"title": f"Application portal: {scheme.name}", "link": scheme.application_portal, "kind": "official"}]
    return [{"title": f"Source: Official Government Information ({scheme.name})", "link": "", "kind": "official"}]


def _source_list(schemes: list[Scheme]) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for s in schemes[:4]:
        for src in _sources_for(s):
            key = src["link"] or src["title"]
            if key not in seen:
                seen.add(key)
                out.append(src)
    if not out:
        out.append({"title": "Source: Official Government Information", "link": "", "kind": "official"})
    return out


def _title(message: str) -> str:
    words = message.strip().split()
    return " ".join(words[:6])[:120] if words else "New chat"


def _extract_scheme(message: str, schemes: list[Scheme]) -> Scheme | None:
    m = message.lower()
    for s in schemes:
        for key in (s.code, s.short_name, s.name):
            if key and len(key) >= 3 and key.lower() in m:
                return s
    return None


def _last_scheme(db: Session, conversation_id: str) -> Scheme | None:
    """Find the scheme most recently discussed in this conversation."""
    if not conversation_id:
        return None
    msgs = (
        db.query(ConversationMessage)
        .filter_by(conversation_id=conversation_id)
        .order_by(ConversationMessage.created_at.desc())
        .limit(12)
        .all()
    )
    schemes = db.query(Scheme).filter_by(is_active=True).all()
    for msg in msgs:
        for s in schemes:
            for key in (s.code, s.short_name, s.name):
                if key and len(key) >= 3 and key.lower() in msg.message.lower():
                    return s
    return None


def _search_terms(message: str) -> list[str]:
    m = message.lower()
    found = []
    for term, labels in (
        ("farmer", ["farmer", "agriculture", "kisan", "rythu", "cropping", "farming"]),
        ("women", ["women", "woman", "maternity", "girl child"]),
        ("student", ["student", "education", "scholarship", "study", "degree"]),
        ("senior", ["senior", "elderly", "old age", "pension"]),
        ("entrepreneur", ["business", "entrepreneur", "startup", "self-employed", "loan"]),
        ("job", ["job", "employment", "unemployed", "work"]),
        ("disabled", ["disability", "disabled", "divyang"]),
        ("housing", ["house", "housing", "home"]),
    ):
        if any(k in m for k in labels):
            found.append(term)
    return found


def _matches_terms(s: Scheme, terms: list[str]) -> bool:
    if not terms:
        return True
    hay = f"{s.name} {s.short_name} {s.keywords} {s.category} {' '.join(s.tags)} {s.target_audience} {s.description}".lower()
    return any(_norm_key(t) in _norm_key(hay) for t in terms)


def _search_schemes(db: Session, message: str, state: str | None = None, limit: int = 40) -> list[Scheme]:
    q = db.query(Scheme).filter(Scheme.is_active.is_(True))
    if state and state != "all":
        q = q.filter((Scheme.state_specific == state) | (Scheme.state_specific == "all"))
    schemes = q.order_by(Scheme.is_trending.desc()).limit(limit).all()
    terms = _search_terms(message)
    if terms:
        schemes = [s for s in schemes if _matches_terms(s, terms)]
    return schemes[:limit]


def _rank_for_user(db: Session, user: User, candidates: list[Scheme]) -> list[dict]:
    profile = derive(profile_to_dict(user.profile))
    results = []
    for s in candidates:
        try:
            r = evaluate_scheme_tri(profile, scheme_to_dict(s))
        except Exception:
            continue
        results.append({"scheme": s, "eval": r})
    results.sort(key=lambda x: (-x["eval"]["score"], x["eval"]["category"]))
    return results


def _profile_line(profile: dict) -> str:
    bits = []
    if profile.get("age"):
        bits.append(f"{profile['age']} years")
    if profile.get("occupation"):
        bits.append(str(profile["occupation"]))
    if profile.get("state"):
        bits.append(f"{profile['state']}")
    if profile.get("annual_income") is not None:
        bits.append(f"income ₹{profile['annual_income']:,.0f}")
    return ", ".join(bits) if bits else "no profile details yet"


def _doc_readiness(scheme: Scheme, doc_types: set[str]) -> dict:
    required = scheme.required_documents or []
    have, missing = [], []
    for req in required:
        rn = _norm_key(req)
        doc_type = next(
            (dt for dt, aliases in DOC_TYPE_ALIASES.items() if any(a in rn for a in aliases)),
            None,
        )
        if doc_type and doc_type in doc_types:
            have.append(req)
        else:
            missing.append(req)
    return {"required": required, "have": have, "missing": missing}


def _eligibility_buttons(scheme: Scheme, status: str) -> list[dict]:
    buttons = []
    if scheme.application_portal:
        buttons.append(_btn("Open Official Application Portal", scheme.application_portal, kind="link", url=scheme.application_portal))
    elif scheme.official_link:
        buttons.append(_btn("Open Official Page", scheme.official_link, kind="link", url=scheme.official_link))
    buttons.append(_btn("Find alternative schemes", "Find alternative schemes for me."))
    buttons.append(_btn(f"Benefits of {scheme.short_name or scheme.name}", f"What are the benefits of {scheme.name}?"))
    return buttons


def _format_benefits(scheme: Scheme) -> str:
    benefits = scheme.benefits or []
    lines = []
    if benefits:
        for b in benefits[:4]:
            label = b.get("label") or b.get("detail", "")
            value = b.get("value") or b.get("detail", "")
            lines.append(f"• {label}: {value}")
    if scheme.amount:
        lines.append(f"• Financial support: {scheme.amount}")
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Intent detection
# --------------------------------------------------------------------------- #
def detect_intent(message: str, schemes: list[Scheme], last_scheme: Scheme | None) -> tuple[str, dict]:
    m = message.lower().strip()
    scheme = _extract_scheme(message, schemes)
    if any(k in m for k in ("this scheme", "that scheme", "the scheme", "this yojana")) and last_scheme:
        scheme = scheme or last_scheme

    if re.fullmatch(r"[\s\W]*(hello|hi|hey|namaste|namaskar|good morning|good afternoon|good evening|hola|salam)[\s\W]*", m):
        return "GREETING", {}

    if any(k in m for k in ("what am i eligible for", "eligible for anything", "am i eligible for any",
                            "which schemes am i eligible")):
        return "SCHEME_SEARCH", {"personalized": True}

    if any(k in m for k in ("application status", "status of my application", "track my application",
                            "track application", "application progress", "where is my application",
                            "how is my application", "what is the status of my", "my application status")):
        return "APPLICATION_STATUS", {}

    if re.search(r"\bSCAI[A-Z0-9]+\b", message.upper()) and any(
        k in m for k in ("status", "track", "where", "progress", "check")):
        return "APPLICATION_STATUS", {}

    if any(k in m for k in ("why am i not eligible", "why not eligible", "why am i ineligible",
                            "why cant i get", "why can't i get", "why am i not getting",
                            "why is my application not", "why i am not")):
        return "WHY_NOT_ELIGIBLE", {"scheme": scheme or last_scheme}

    if any(k in m for k in ("am i eligible", "eligible for", "eligibility", "am i qualified",
                            "can i get", "can i apply", "can i avail", "am i fit")):
        return "ELIGIBILITY", {"scheme": scheme or last_scheme}

    if any(k in m for k in ("how do i apply", "how to apply", "how can i apply", "steps to apply",
                            "apply for", "how do i register", "how to register", "application help")):
        return "APPLICATION_HELP", {"scheme": scheme or last_scheme}

    if any(k in m for k in ("document", "what do i need to upload", "required documents",
                            "documents required", "what documents", "which documents",
                            "missing document", "do i have all the documents", "documents for")):
        return "DOCUMENTS", {"scheme": scheme or last_scheme}

    if any(k in m for k in ("alternative", "other scheme", "other option", "better match",
                            "suggest something else", "find alternative", "what else", "other schemes")):
        return "ALTERNATIVES", {}

    if any(k in m for k in ("in my state", "my state", "available in", "state government scheme",
                            "schemes in", "for my state", "state schemes")):
        return "STATE_SCHEMES", {}

    if scheme and any(k in m for k in ("explain", "tell me about", "what is this", "simple language",
                                       "understand", "i don't understand", "how does this work",
                                       "what does this scheme", "more about this")):
        return "SCHEME_EXPLAIN", {"scheme": scheme}

    if scheme and any(k in m for k in ("benefit", "how much", "amount", "what do i get",
                                       "what will i get", "pension amount", "scholarship")):
        return "BENEFITS", {"scheme": scheme}

    if any(k in m for k in ("profile", "my details", "update my profile", "complete my profile",
                            "missing fields", "questionnaire", "my information", "what do you know about me")):
        return "PROFILE", {}

    if any(k in m for k in ("support", "helpdesk", "complaint", "talk to", "contact", "officer",
                            "office", "csc", "helpline", "customer care", "human")):
        return "SUPPORT", {}

    if any(k in m for k in ("scheme", "yojana", "benefit", "subsidy", "what can i get",
                            "what is available", "find me", "show me", "list", "available for",
                            "for farmers", "for women", "for students", "government help",
                            "assistance", "help for", "support for", "what is eligible")):
        return "SCHEME_SEARCH", {}

    if any(k in m for k in ("what can you do", "who are you", "how can you help", "about you",
                            "how do you work", "what is schemeai", "what do you do",
                            "tell me about yourself")):
        return "GENERAL", {}

    return "UNKNOWN", {}


# --------------------------------------------------------------------------- #
# Reply builders (each returns message text + sources + buttons, appends agents)
# --------------------------------------------------------------------------- #
def _reply_greeting(user: User | None) -> tuple[str, list, list]:
    name = (user.full_name or "").split(" ")[0] if user and user.full_name else "there"
    text = (
        f"Hello {name}! I'm SchemeAI Assistant, your personal guide to government schemes.\n\n"
        "I can help you:\n"
        "• Find schemes you may be eligible for\n"
        "• Check your eligibility against the actual rules\n"
        "• See which documents you need (and which you already uploaded)\n"
        "• Step-by-step application guidance\n"
        "• Track your application status\n\n"
        "Choose a quick action below, or ask me anything in your own words."
    )
    buttons = [
        _btn("Find Schemes", "What government schemes are available?"),
        _btn("Check Eligibility", "Am I eligible for this scheme?"),
        _btn("Required Documents", "What documents do I need?"),
        _btn("Application Help", "How do I apply for a scheme?"),
        _btn("Ask a Question", "What can you do?"),
    ]
    return text, [], buttons


def _reply_general(db: Session, agents: list[dict]) -> tuple[str, list, list]:
    with _timed(agents, "Scheme Research", "Counting schemes in the database"):
        total = db.query(Scheme).filter_by(is_active=True).count()
        states = db.query(Scheme.state_specific).distinct().all()
        state_count = sum(1 for s in states if s[0] and s[0] != "all")
    text = (
        "I'm SchemeAI Assistant. I search the official government scheme database "
        f"which currently has {total} published schemes covering {state_count} states, and I "
        "match them against your profile using the actual eligibility rules.\n\n"
        "You can ask me things like:\n"
        "• \"What schemes are available for farmers?\"\n"
        "• \"Am I eligible for PM-KISAN?\"\n"
        "• \"What documents do I need to apply?\"\n"
        "• \"How do I apply?\"\n"
        "• \"What is my application status?\"\n"
        "• \"Why am I not eligible for this scheme?\""
    )
    buttons = [
        _btn("Find Schemes", "What government schemes are available?"),
        _btn("Check Eligibility", "Am I eligible for this scheme?"),
    ]
    return text, [], buttons


def _reply_scheme_search(db: Session, agents: list[dict], message: str, user: User | None,
                         params: dict) -> tuple[str, list, list]:
    state = derive(profile_to_dict(user.profile)).get("state") if user and user.profile else None
    with _timed(agents, "Scheme Research", "Searching the scheme database"):
        candidates = _search_schemes(db, message, state=state)
        if not candidates:
            candidates = _search_schemes(db, message, state=None)

    personalized = bool(user) and (params.get("personalized") or any(
        k in message.lower() for k in ("for me", "can i get", "what can i get", "am i eligible for", "for my")))
    ranked = []
    if personalized:
        with _timed(agents, "Eligibility", "Scoring schemes against your profile"):
            ranked = _rank_for_user(db, user, candidates[:25])
        top = ranked[:5]
    else:
        top = [{"scheme": s, "eval": None} for s in candidates[:6]]

    if not top:
        return ("I couldn't find any schemes matching that. Try describing what help you need "
                "(e.g. \"schemes for farmers\", \"education scholarships\") or complete your profile "
                "for personalised results.", [], [])

    lines = []
    if personalized:
        lines.append("Based on your profile, here are your best-matching schemes:")
    else:
        lines.append("Here are the schemes currently available on SchemeAI:")
    for i, item in enumerate(top, 1):
        s = item["scheme"]
        ev = item.get("eval")
        if ev:
            lines.append(f"{i}. **{s.name}** — match {ev['score']:.0f}% ({ev['category']})")
        else:
            lines.append(f"{i}. **{s.name}** — {CATEGORY_LABELS.get(s.category, s.category)}")
        if s.amount:
            lines.append(f"   Financial support: {s.amount}")
    if personalized and len(ranked) > len(top):
        lines.append(f"\n…and {len(ranked) - len(top)} more. Ask me to check eligibility for any of them.")

    buttons = []
    first = top[0]["scheme"]
    buttons.append(_btn(f"Check my eligibility for {first.short_name or first.name}",
                        f"Am I eligible for {first.name}?"))
    buttons.append(_btn("Find alternative schemes", "Find alternative schemes for me."))
    return "\n".join(lines), _source_list([item["scheme"] for item in top]), buttons


def _reply_eligibility(db: Session, agents: list[dict], scheme: Scheme | None, user: User | None,
                       mode: str = "check") -> tuple[str, list, list]:
    if scheme is None:
        popular = db.query(Scheme).filter_by(is_active=True).order_by(Scheme.is_trending.desc()).limit(5).all()
        text = "Which scheme would you like me to check? For example:"
        buttons = [_btn(s.short_name or s.name, f"Am I eligible for {s.name}?") for s in popular]
        buttons.append(_btn("Find schemes for me", "What schemes can I get?"))
        return text, [], buttons

    if user is None:
        return ("To check your eligibility I need to know your profile first.\n\n"
                "Please sign in and complete your profile, then ask me again — I'll compare you "
                "against the scheme's actual rules, not a guess.",
                [], [_btn("Sign in", "/login", kind="route")])

    with _timed(agents, "Profile", "Loading your profile"):
        profile = derive(profile_to_dict(user.profile))
    with _timed(agents, "Eligibility", f"Evaluating rules for {scheme.name}"):
        ev = evaluate_scheme_tri(profile, scheme_to_dict(scheme))

    lines = []
    if mode == "why" and ev["status"] != "LIKELY_NOT_ELIGIBLE":
        lines.append(f"Based on your profile, you appear **eligible** for {scheme.name} "
                     f"(match {ev['score']:.0f}%, {ev['category']}).")
        lines.append("\nYour profile matches: " + "; ".join(
            (r["label"] or r["field"].replace("_", " ")) for r in ev["matched_rules"][:4]))
    else:
        if ev["status"] == "LIKELY_ELIGIBLE":
            lines.append(f"Good news! Based on your profile you are **likely eligible** for {scheme.name} "
                         f"(match {ev['score']:.0f}%, {ev['category']}).")
        elif ev["status"] == "LIKELY_NOT_ELIGIBLE":
            lines.append(f"Based on your profile you may **not be eligible** for {scheme.name} right now.")
        elif ev["status"] == "INSUFFICIENT_INFORMATION":
            lines.append(f"I can't fully decide yet for {scheme.name} — I need a few more profile details "
                         f"to compare you against the rules.")
        else:  # REQUIRES_REVIEW
            lines.append(f"Mostly good news: you match most criteria for {scheme.name}, but a couple "
                         f"of things need to be checked.")

        if ev["matched_rules"]:
            lines.append("\n✓ Criteria you meet:")
            for r in ev["matched_rules"][:4]:
                lines.append(f"• {r['label'] or r['field'].replace('_', ' ')}")
        if ev["failed_rules"]:
            lines.append("\n✗ Criteria not met:")
            for r in ev["failed_rules"][:4]:
                label = r["label"] or r["field"].replace("_", " ")
                lines.append(f"• {label}: {r['reason']}")
        if ev["unknown_rules"]:
            lines.append("\n? Couldn't be judged yet (profile data missing):")
            for r in ev["unknown_rules"][:4]:
                lines.append(f"• {r['label'] or r['field'].replace('_', ' ')}")
        if ev["next_steps"]:
            lines.append("\nWhat to do next:")
            for step in ev["next_steps"][:3]:
                lines.append(f"• {step}")

    if ev["status"] == "LIKELY_ELIGIBLE" and scheme.benefits:
        ben = _format_benefits(scheme)
        if ben:
            lines.append("\nWhat you can get:\n" + ben)

    if ev["status"] in ("LIKELY_NOT_ELIGIBLE", "REQUIRES_REVIEW") and mode != "why":
        with _timed(agents, "Recommendation", "Finding alternative schemes"):
            others = _search_schemes(db, "", state=profile.get("state"))[:25]
            ranked = _rank_for_user(db, user, others)
            alts = [r for r in ranked if r["scheme"].id != scheme.id][:3]
        if alts:
            lines.append("\nSchemes that may fit you better:")
            for i, r in enumerate(alts, 1):
                lines.append(f"{i}. {r['scheme'].name} — match {r['eval']['score']:.0f}%")

    buttons = _eligibility_buttons(scheme, ev["status"])
    if ev["unknown_rules"]:
        buttons.insert(0, _btn("Complete my profile", "/profile", kind="route"))
    if ev["failed_rules"] and mode == "check":
        buttons.insert(1, _btn("Why am I not eligible?", f"Why am I not eligible for {scheme.name}?"))
    return "\n".join(lines), _source_list([scheme]), buttons


def _reply_documents(db: Session, agents: list[dict], scheme: Scheme | None, user: User | None,
                     message: str) -> tuple[str, list, list]:
    if user is None:
        sample = db.query(Scheme).filter_by(is_active=True).order_by(Scheme.is_trending.desc()).limit(3).all()
        common = sorted({d for s in sample for d in (s.required_documents or [])})
        text = ("Commonly required documents across schemes:\n• " + "\n• ".join(common[:8]) +
                "\n\nSign in to see exactly which documents you still need for a specific scheme.")
        return text, [], [_btn("Sign in", "/login", kind="route")]

    with _timed(agents, "Profile", "Loading your profile"):
        profile = derive(profile_to_dict(user.profile))

    target = scheme
    if target is None:
        ranked = _rank_for_user(db, user, _search_schemes(db, message, state=profile.get("state"))[:25])
        target = ranked[0]["scheme"] if ranked else None
    if target is None:
        return ("Complete your profile and I'll recommend a scheme to check documents for.", [], [])

    with _timed(agents, "Documents", f"Checking your uploads for {target.name}"):
        doc_types = {d.doc_type for d in db.query(UserDocument).filter_by(user_id=user.id).all()}
        readiness = _doc_readiness(target, doc_types)

    lines = [f"Here's what you need for **{target.name}**:"]
    if readiness["have"]:
        lines.append("\n✓ Already uploaded:")
        for d in readiness["have"]:
            lines.append(f"• {d}")
    if readiness["missing"]:
        lines.append("\n✗ Still needed:")
        for d in readiness["missing"]:
            lines.append(f"• {d}")
        lines.append("\nUpload these in the Documents section and I'll verify them.")
    else:
        lines.append("\nAll required documents are uploaded. You're ready to apply!")

    buttons = [
        _btn("Upload documents", "/documents", kind="route"),
        _btn(f"Check eligibility for {target.short_name or target.name}",
             f"Am I eligible for {target.name}?"),
    ]
    return "\n".join(lines), _source_list([target]), buttons


def _reply_application_help(db: Session, agents: list[dict], scheme: Scheme | None) -> tuple[str, list, list]:
    if scheme is None:
        popular = db.query(Scheme).filter_by(is_active=True).order_by(Scheme.is_trending.desc()).limit(4).all()
        text = ("Applying for a scheme is simple:\n"
                "1. Find a scheme you're eligible for\n"
                "2. Upload the required documents\n"
                "3. Apply on the official portal and note the reference number\n\n"
                "Which scheme would you like step-by-step guidance for?")
        buttons = [_btn(s.short_name or s.name, f"How do I apply for {s.name}?") for s in popular]
        return text, [], buttons

    with _timed(agents, "Application", f"Building application roadmap for {scheme.name}"):
        steps = _steps_for(scheme_to_dict(scheme))
    lines = [f"Here's how to apply for **{scheme.name}** step by step:"]
    for st in steps:
        lines.append(f"{st['step']}. {st['title']}")
    lines.append("\nOnce you apply on the portal, come back and say \"What is my application status?\" "
                 "and I'll track it here.")

    buttons = []
    if scheme.application_portal:
        buttons.append(_btn("Open Official Application Portal", scheme.application_portal, kind="link", url=scheme.application_portal))
    buttons.append(_btn(f"Am I eligible for {scheme.name}?", f"Am I eligible for {scheme.name}?"))
    return "\n".join(lines), _source_list([scheme]), buttons


def _reply_application_status(db: Session, agents: list[dict], message: str, user: User | None) -> tuple[str, list, list]:
    if user is None:
        return ("I can only show application status for a signed-in account, to protect your privacy.\n\n"
                "Please sign in, then ask again.", [], [_btn("Sign in", "/login", kind="route")])

    ref = re.search(r"\bSCAI[A-Z0-9]+\b", message.upper())
    with _timed(agents, "Applications", "Looking up your applications"):
        apps = db.query(Application).filter_by(user_id=user.id).order_by(Application.created_at.desc()).all()
        if ref:
            owned = [a for a in apps if a.application_id == ref.group(0)]
            if not owned:
                return ("I couldn't find an application with that reference in your account.\n\n"
                        "For privacy, I can only show applications linked to your own account.",
                        [], [_btn("My applications", "/applications", kind="route")])
            apps = owned

    if not apps:
        return ("You don't have any applications yet. Find a scheme you like, check eligibility, "
                "and apply — then I'll track it here for you.",
                [], [_btn("Find Schemes", "What government schemes are available?")])

    lines = []
    for i, a in enumerate(apps[:5], 1):
        lines.append(f"{i}. {a.qr_payload.get('scheme') or a.scheme_name or 'Scheme'} — "
                     f"**{STATUS_LABELS.get(a.status, a.status.replace('_', ' '))}**")
        if a.application_id:
            lines.append(f"   Reference: {a.application_id}")
        if a.status != "draft" and a.updated_at:
            lines.append(f"   Last updated: {a.updated_at:%d %b %Y}")
    if len(apps) > 5:
        lines.append(f"\n…and {len(apps) - 5} more. Open the Applications page for details.")
    lines.append("\nYou'll be notified here whenever your status changes.")

    buttons = [_btn("View all applications", "/applications", kind="route")]
    return "\n".join(lines), [], buttons


def _reply_profile(db: Session, agents: list[dict], user: User | None) -> tuple[str, list, list]:
    if user is None:
        return ("To help with your profile I need you to sign in first.", [],
                [_btn("Sign in", "/login", kind="route")])
    with _timed(agents, "Profile", "Reading your profile"):
        profile = derive(profile_to_dict(user.profile))
        comp = schema_completeness(profile)
    lines = [f"You're {_profile_line(profile)}.", f"\nProfile completeness: **{comp['completeness']:.0f}%**"]
    if comp["missing"]:
        lines.append("\nFields that would improve your results:")
        for mf in comp["missing"][:6]:
            lines.append(f"• {mf['label']}")
        lines.append("\nComplete these and I can match you against far more schemes accurately.")
    else:
        lines.append("\nYour profile is complete — great! Ask me \"What schemes can I get?\".")
    return "\n".join(lines), [], [_btn("Complete my profile", "/profile", kind="route")]


def _reply_alternatives(db: Session, agents: list[dict], user: User | None, message: str) -> tuple[str, list, list]:
    if user is None:
        return ("Sign in and complete your profile, and I'll find alternative schemes that fit you better.",
                [], [_btn("Sign in", "/login", kind="route")])
    with _timed(agents, "Profile", "Loading your profile"):
        profile = derive(profile_to_dict(user.profile))
    with _timed(agents, "Recommendation", "Ranking alternative schemes"):
        ranked = _rank_for_user(db, user, _search_schemes(db, message, state=profile.get("state"))[:40])
    if not ranked:
        return ("I couldn't find alternatives right now. Complete your profile and try again.", [], [])
    lines = ["Here are schemes ranked by how well you match them:"]
    for i, r in enumerate(ranked[:5], 1):
        ev = r["eval"]
        lines.append(f"{i}. {r['scheme'].name} — match {ev['score']:.0f}% ({ev['category']})")
    buttons = [_btn(f"Check eligibility for {ranked[0]['scheme'].name}",
                    f"Am I eligible for {ranked[0]['scheme'].name}?")]
    return "\n".join(lines), _source_list([r["scheme"] for r in ranked[:4]]), buttons


def _reply_state_schemes(db: Session, agents: list[dict], user: User | None) -> tuple[str, list, list]:
    with _timed(agents, "Scheme Research", "Filtering schemes by state"):
        if user and user.profile:
            state = user.profile.state
        else:
            state = None
        q = db.query(Scheme).filter(Scheme.is_active.is_(True), Scheme.state_specific != "all")
        if state:
            q = q.filter(Scheme.state_specific == state)
        state_schemes = q.order_by(Scheme.is_trending.desc()).limit(6).all()
    if not state_schemes:
        return ("I don't have state-specific schemes for your state yet. Try asking about a central "
                "scheme, e.g. \"What schemes are available for farmers?\"", [], [])
    lines = [f"Here are state-level schemes" + (f" available in {state}:" if state else " in the database:")]
    for i, s in enumerate(state_schemes, 1):
        lines.append(f"{i}. {s.name} — {s.category}")
        if s.amount:
            lines.append(f"   {s.amount}")
    return "\n".join(lines), _source_list(state_schemes), []


def _reply_scheme_explain(scheme: Scheme) -> tuple[str, list, list]:
    lines = [f"**{scheme.name}** in simple words:",
             f"{scheme.description}"]
    if scheme.ministry:
        lines.append(f"\nRun by: {scheme.ministry}" + (f", {scheme.department}" if scheme.department else ""))
    if scheme.target_audience:
        lines.append(f"Who it's for: {scheme.target_audience}")
    if scheme.amount:
        lines.append(f"Financial support: {scheme.amount}")
    if scheme.duration:
        lines.append(f"Duration: {scheme.duration}")
    if scheme.application_time:
        lines.append(f"When to apply: {scheme.application_time}")
    lines.append("\nAsk me \"Am I eligible?\", \"What documents do I need?\", or \"How do I apply?\" "
                 f"for {scheme.short_name or scheme.name}.")
    buttons = [
        _btn(f"Am I eligible for {scheme.name}?", f"Am I eligible for {scheme.name}?"),
        _btn(f"What documents do I need?", f"What documents do I need for {scheme.name}?"),
        _btn(f"How do I apply?", f"How do I apply for {scheme.name}?"),
    ]
    return "\n".join(lines), _source_list([scheme]), buttons


def _reply_benefits(scheme: Scheme) -> tuple[str, list, list]:
    ben = _format_benefits(scheme)
    if not ben:
        return (f"I don't have detailed benefit information for {scheme.name} yet. "
                f"Ask me to explain the scheme instead.", [], [])
    text = f"Here's what {scheme.short_name or scheme.name} offers:\n{ben}"
    if scheme.duration:
        text += f"\n\nPayout/duration: {scheme.duration}"
    buttons = [
        _btn(f"Am I eligible for {scheme.name}?", f"Am I eligible for {scheme.name}?"),
        _btn(f"How do I apply for {scheme.name}?", f"How do I apply for {scheme.name}?"),
    ]
    return text, _source_list([scheme]), buttons


def _reply_support() -> tuple[str, list, list]:
    return ("If you need human help, here are the options:\n"
            "• Use the **Help & Support** page to raise a ticket — it links to your chat history\n"
            "• Visit your nearest **CSC (Common Service Centre)** for assisted filing\n"
            "• Our admin team can review any application in progress\n\n"
            "I can also raise a support request for you — just describe the problem.",
            [], [_btn("Open Support", "/support", kind="route")])


def _reply_unknown(db: Session, message: str) -> tuple[str, list, list]:
    popular = db.query(Scheme).filter_by(is_active=True).order_by(Scheme.is_trending.desc()).limit(4).all()
    text = ("I'm not sure I understood that. I'm best at scheme searches, eligibility, documents, "
            "application guidance and tracking.\n\nYou could try:\n"
            "• \"What schemes are available for farmers?\"\n"
            "• \"Am I eligible for PM-KISAN?\"\n"
            "• \"What documents do I need?\"\n"
            "• \"How do I apply for a scheme?\"\n"
            "• \"What is my application status?\"")
    if popular:
        text += "\n\nPopular schemes right now:"
        for s in popular:
            text += f"\n• {s.name}"
    buttons = [
        _btn("Find Schemes", "What government schemes are available?"),
        _btn("Check Eligibility", "Am I eligible for this scheme?"),
        _btn("Talk to support", "I need to talk to support."),
    ]
    return text, [], buttons


HANDLERS = {
    "GREETING": lambda db, a, m, u, p: _reply_greeting(u),
    "GENERAL": lambda db, a, m, u, p: _reply_general(db, a),
    "SCHEME_SEARCH": lambda db, a, m, u, p: _reply_scheme_search(db, a, m, u, p),
    "ELIGIBILITY": lambda db, a, m, u, p: _reply_eligibility(db, a, p.get("scheme"), u, "check"),
    "WHY_NOT_ELIGIBLE": lambda db, a, m, u, p: _reply_eligibility(db, a, p.get("scheme"), u, "why"),
    "DOCUMENTS": lambda db, a, m, u, p: _reply_documents(db, a, p.get("scheme"), u, m),
    "APPLICATION_HELP": lambda db, a, m, u, p: _reply_application_help(db, a, p.get("scheme")),
    "APPLICATION_STATUS": lambda db, a, m, u, p: _reply_application_status(db, a, m, u),
    "PROFILE": lambda db, a, m, u, p: _reply_profile(db, a, u),
    "ALTERNATIVES": lambda db, a, m, u, p: _reply_alternatives(db, a, u, m),
    "STATE_SCHEMES": lambda db, a, m, u, p: _reply_state_schemes(db, a, u),
    "SCHEME_EXPLAIN": lambda db, a, m, u, p: _reply_scheme_explain(p["scheme"]),
    "BENEFITS": lambda db, a, m, u, p: _reply_benefits(p["scheme"]),
    "SUPPORT": lambda db, a, m, u, p: _reply_support(),
    "UNKNOWN": lambda db, a, m, u, p: _reply_unknown(db, m),
}


# --------------------------------------------------------------------------- #
# Rate limiting
# --------------------------------------------------------------------------- #
def _check_rate_limit(db: Session, user: User | None, ip: str) -> tuple[bool, str]:
    key = user.id if user else f"ip:{ip}"
    now = time.time()
    q = _windows[key]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= RATE_PER_MINUTE:
        return False, "You've reached the chat message limit (30/minute). Please wait a moment and try again."
    if user:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        day_count = db.query(ChatLog).filter(ChatLog.user_id == user.id, ChatLog.created_at >= start).count()
        if day_count >= RATE_PER_DAY:
            return False, "You've reached today's message limit. Please try again tomorrow."
    q.append(now)
    return True, ""


# --------------------------------------------------------------------------- #
# Main entry point
# --------------------------------------------------------------------------- #
def run_chat(db: Session, message: str, user: User | None, conversation_id: str,
             ip: str = "") -> dict:
    t_start = time.perf_counter()
    message = (message or "").strip()[:2000]
    allowed, limit_msg = _check_rate_limit(db, user, ip)
    if not allowed:
        _log(db, user, conversation_id, "", message, [], "rate_limited", limit_msg, 0, ip)
        return {
            "success": False, "message": limit_msg, "conversation_id": conversation_id or "",
            "sources": [], "agents_used": [], "intent": "RATE_LIMITED", "buttons": [],
        }
    if not message:
        return {"success": False, "message": "Please type a message.", "conversation_id": conversation_id or "",
                "sources": [], "agents_used": [], "intent": "UNKNOWN", "buttons": []}

    # Resolve conversation (persisted only for signed-in users)
    conv = None
    if user:
        if conversation_id:
            conv = db.query(Conversation).filter_by(id=conversation_id, user_id=user.id).first()
        if conv is None:
            conv = Conversation(user_id=user.id, title=_title(message))
            db.add(conv)
            db.commit()
            db.refresh(conv)
        conversation_id = conv.id

    schemes = db.query(Scheme).filter_by(is_active=True).all()
    last = _last_scheme(db, conversation_id)
    intent, params = detect_intent(message, schemes, last)

    agents: list[dict] = []
    try:
        text, sources, buttons = HANDLERS[intent](db, agents, message, user, params)
        status, error = "success", ""
    except Exception as exc:  # pragma: no cover - defensive
        status, error = "error", f"{type(exc).__name__}: {exc}"
        text = ("I hit a problem answering that. This has been logged for our team — please try "
                "rephrasing your question, or ask about another scheme.")
        sources, buttons = [], []

    duration_ms = round((time.perf_counter() - t_start) * 1000)

    if user and conv:
        conv.title = _title(message) if conv.message_count == 0 else conv.title
        conv.message_count += 2
        db.add(ConversationMessage(conversation_id=conv.id, user_id=user.id, role="user",
                                   message=message, intent="", agents_used=[], sources=[], buttons=[]))
        db.add(ConversationMessage(conversation_id=conv.id, user_id=user.id, role="ai",
                                   message=text, intent=intent, agents_used=agents,
                                   sources=sources, buttons=buttons))
        db.commit()

    polished = None
    if status == "success" and intent not in ("GREETING", "GENERAL", "UNKNOWN"):
        polished = polish_reply(text)
    final_text = polished or text

    _log(db, user, conversation_id or "", intent, message, agents, status, error,
         duration_ms, ip, reply_len=len(final_text))

    return {
        "success": status == "success",
        "message": final_text,
        "conversation_id": conversation_id or "",
        "sources": sources,
        "agents_used": agents,
        "intent": intent,
        "buttons": buttons,
    }


def _log(db: Session, user: User | None, conversation_id: str, intent: str, message: str,
         agents: list[dict], status: str, error: str, duration_ms: int, ip: str,
         reply_len: int = 0) -> None:
    try:
        db.add(ChatLog(
            user_id=user.id if user else "",
            conversation_id=conversation_id or "",
            intent=intent,
            message=message[:1000],
            agents_used=agents,
            status=status,
            error=error[:2000],
            duration_ms=duration_ms,
            ip=ip[:64],
        ))
        db.commit()
    except Exception:
        db.rollback()
