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


def polish_reply(draft: str) -> str | None:
    """Return a lightly rephrased version of `draft`, or None when LLM is
    unavailable or the call fails (caller keeps the deterministic draft)."""
    if not settings.OPENAI_API_KEY:
        return None
    client = _client()
    if client is None:
        return None
    try:
        system = (
            "You are a wording assistant for an Indian government scheme "
            "chatbot. You must NEVER add facts, URLs, numbers or schemes that "
            "are not present in the user message. Keep the same structure and "
            "bullet points. Return only the rephrased text."
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
