"""Optional LLM integration for the SchemeAI chatbot.

The chatbot is fully deterministic (rule engine + real database data) and does
NOT depend on any LLM. If `OPENAI_API_KEY` is configured in the backend .env,
this module can lightly polish the drafted reply text — it is never used to
generate facts, only to rephrase the already-verified answer.
"""
from __future__ import annotations

import json
import logging
import urllib.request
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


def _client() -> Any | None:
    try:
        import openai  # type: ignore
        return openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    except Exception:
        return None


def polish_reply(draft: str, target_language: str = "en") -> str | None:
    """Return a lightly rephrased version of `draft`, or None when LLM is
    unavailable or the call fails (caller keeps the deterministic draft)."""
    if not settings.OPENAI_API_KEY:
        return None
    client = _client()
    if client is None:
        return None
    try:
        system = (
            f"You are a wording assistant for an Indian government scheme "
            f"chatbot. You must NEVER add facts, URLs, numbers or schemes that "
            f"are not present in the user message. Keep the same structure and "
            f"bullet points. Return only the rephrased text. "
            f"IMPORTANT: Translate the output into ISO 639-1 language code: '{target_language}'."
        )
        resp = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": draft},
            ],
            max_tokens=800,
            temperature=0.2,
        )
        out = (resp.choices[0].message.content or "").strip()
        return out or None
    except Exception as exc:  # pragma: no cover - network dependent
        logger.warning("LLM polish failed, keeping deterministic reply: %s", exc)
        return None

def analyze_needs(text: str) -> dict:
    """Analyze free-text user input into structured needs."""
    if not settings.OPENAI_API_KEY:
        # Fallback to simple keyword matching if no API key
        text_lower = text.lower()
        if "farm" in text_lower or "agri" in text_lower:
            return {"category": "AGRICULTURE", "subcategory": "General"}
        if "school" in text_lower or "study" in text_lower or "educat" in text_lower:
            return {"category": "EDUCATION", "subcategory": "Scholarship"}
        return {"category": "GENERAL", "subcategory": "Other"}
        
    client = _client()
    if client is None:
        return {"category": "GENERAL", "subcategory": "Other"}
        
    try:
        system = (
            "You are an intent analyzer. The user will state their needs. "
            "Categorize their need into one of these exact strings: "
            "[AGRICULTURE, EDUCATION, EMPLOYMENT, HOUSING, HEALTHCARE, WOMEN_CHILD, FINANCIAL, BUSINESS, DISABILITY, SENIOR, GENERAL]. "
            "Also provide a short 1-3 word subcategory. "
            "Return JSON exactly in this format: {\"category\": \"...\", \"subcategory\": \"...\"}"
        )
        resp = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": text},
            ],
            response_format={ "type": "json_object" },
            max_tokens=150,
            temperature=0.1,
        )
        out = json.loads(resp.choices[0].message.content or "{}")
        return {
            "category": out.get("category", "GENERAL"),
            "subcategory": out.get("subcategory", "Other")
        }
    except Exception as exc:
        logger.warning("LLM needs analysis failed: %s", exc)
        return {"category": "GENERAL", "subcategory": "Other"}
