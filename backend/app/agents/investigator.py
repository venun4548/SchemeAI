"""Multi-Agent Scheme Investigator.

Six specialist agents coordinated by an Orchestrator:

    Profile Analysis -> Eligibility -> Scheme Research -> Document Readiness
                                                     -> Recommendation
                                                     -> Explanation

The rule engine decides everything (eligibility_engine.evaluate_scheme_tri).
The Explanation agent only translates rule outcomes into plain language. No
links are ever invented: official links are echoed verbatim from the Scheme
records, or flagged as absent when the record has none.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agents.eligibility_engine import evaluate_scheme_tri, schema_completeness
from app.agents.profile import normalize
from app.models.models import AgentExecution, Investigation, InvestigationResult, User
from app.rag.vector_store import RAGStore

AGENTS = [
    ("profile", "Profile Analysis Agent"),
    ("eligibility", "Eligibility Agent"),
    ("research", "Scheme Research Agent"),
    ("documents", "Document Readiness Agent"),
    ("recommendation", "Recommendation Agent"),
    ("explanation", "Explanation Agent"),
]


def _runid() -> str:
    return f"inv{datetime.now(timezone.utc).strftime('%H%M%S')}{int(time.time() * 1000) % 100000}"


# --------------------------------------------------------------------------- #
# 1. Profile Analysis Agent
# --------------------------------------------------------------------------- #
def profile_agent(state: dict) -> tuple[dict, dict]:
    profile = normalize(state.get("profile") or {})
    completeness = schema_completeness(profile)
    return {
        "profile": profile,
        "profile_completeness": completeness["completeness"],
        "missing_profile_fields": completeness["missing"],
        "profile_summary": (
            f"{profile.get('age', '?')}y · {profile.get('occupation') or 'n/a'} · {profile.get('state') or 'n/a'}"
        ),
    }, {
        "task": "Analysed the citizen profile",
        "detail": (
            f"{completeness['completeness']}% complete · {len(completeness['missing'])} fields missing"
        ),
    }


# --------------------------------------------------------------------------- #
# 2. Eligibility Agent
# --------------------------------------------------------------------------- #
def eligibility_agent(state: dict) -> tuple[dict, dict]:
    profile = state["profile"]
    schemes = state.get("schemes") or []
    evaluations = [evaluate_scheme_tri(profile, s) for s in schemes]
    focus = state.get("focus_scheme_id")
    evaluations.sort(
        key=lambda e: (1 if focus and e["scheme_id"] == focus else 0, e["score"]),
        reverse=True,
    )
    total_unknown = sum(e["unknown_count"] for e in evaluations)
    return {"evaluations": evaluations}, {
        "task": f"Evaluated {len(evaluations)} schemes against the profile",
        "detail": (
            f"Top score {evaluations[0]['score']}% · {evaluations[0]['scheme_name']}"
            if evaluations else "No active schemes to evaluate"
        ),
        "_unknown_total": total_unknown,
    }


# --------------------------------------------------------------------------- #
# 3. Scheme Research Agent  (RAG + link verification, never fabricates)
# --------------------------------------------------------------------------- #
def research_agent(state: dict) -> tuple[dict, dict]:
    store = RAGStore()
    profile = state["profile"]
    query = f"{profile.get('occupation', '')} {profile.get('state', '')} scheme eligibility 2026".strip()
    snippets = store.search(query, k=4)
    by_id = {s["id"]: s for s in (state.get("schemes") or [])}
    notes = {}
    verified = 0
    for e in state.get("evaluations", []):
        s = by_id.get(e["scheme_id"], {})
        link = s.get("official_link") or ""
        portal = s.get("application_portal") or ""
        if link:
            verified += 1
        notes[e["scheme_id"]] = {
            "official_link": link,
            "application_portal": portal,
            "has_official_link": bool(link),
            "ministry": s.get("ministry", ""),
            "benefits": s.get("benefits", []),
        }
    return {"scheme_research": notes, "policy_snippets": snippets}, {
        "task": "Researched schemes against the policy knowledge base",
        "detail": f"{len(snippets)} policy sources · {verified} official links verified",
    }


# --------------------------------------------------------------------------- #
# 4. Document Readiness Agent
# --------------------------------------------------------------------------- #
def _is_expired(expiry: str, today=None) -> bool:
    if not expiry:
        return False
    from datetime import date

    today = today or date.today()
    value = str(expiry).strip()
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(value, fmt).date() < today
        except ValueError:
            continue
    return False


def documents_agent(state: dict) -> tuple[dict, dict]:
    uploaded = set(state.get("uploaded_docs") or [])
    expiry_map = state.get("doc_expiry") or {}
    by_id = {s["id"]: s for s in (state.get("schemes") or [])}
    readiness: dict[str, dict] = {}
    available_total = 0
    for e in state.get("evaluations", []):
        s = by_id.get(e["scheme_id"], {})
        required = s.get("required_documents") or []
        items = []
        for doc in required:
            if doc in uploaded:
                exp = expiry_map.get(doc, "")
                if _is_expired(exp):
                    items.append({"doc": doc, "state": "expired", "expiry_date": exp})
                else:
                    items.append({"doc": doc, "state": "available", "expiry_date": exp or ""})
                    available_total += 1
            else:
                items.append({"doc": doc, "state": "missing", "expiry_date": ""})
        readiness[e["scheme_id"]] = {
            "required": required,
            "available": [i["doc"] for i in items if i["state"] == "available"],
            "missing": [i["doc"] for i in items if i["state"] == "missing"],
            "expired": [i["doc"] for i in items if i["state"] == "expired"],
            "items": items,
            "ready": all(i["state"] == "available" for i in items) if items else True,
        }
    checked = sum(1 for v in readiness.values() if v["required"])
    return {"document_readiness": readiness}, {
        "task": "Checked document readiness across matched schemes",
        "detail": f"{available_total} documents ready across {checked} schemes",
    }


# --------------------------------------------------------------------------- #
# 5. Recommendation Agent
# --------------------------------------------------------------------------- #
def recommendation_agent(state: dict) -> tuple[dict, dict]:
    results = []
    for i, e in enumerate(state.get("evaluations", [])):
        research = state.get("scheme_research", {}).get(e["scheme_id"], {})
        results.append({
            "rank": i + 1,
            "scheme_id": e["scheme_id"],
            "scheme_name": e["scheme_name"],
            "category": e["category"],
            "eligibility_status": e["status"],
            "score": e["score"],
            "confidence": e["confidence"],
            "matched_count": e["matched_count"],
            "failed_count": e["failed_count"],
            "unknown_count": e["unknown_count"],
            "approval_probability": e["approval_probability"],
            "reasons": e["reasons"],
            "next_steps": e["next_steps"],
            "document_status": state.get("document_readiness", {}).get(e["scheme_id"], {}),
            "official_link": research.get("official_link", ""),
            "has_official_link": research.get("has_official_link", False),
            "application_portal": research.get("application_portal", ""),
            "ministry": research.get("ministry", ""),
            "benefits": research.get("benefits", []),
            "evaluation": {
                "matched_rules": e["matched_rules"],
                "failed_rules": e["failed_rules"],
                "unknown_rules": e["unknown_rules"],
                "reasons": e["reasons"],
            },
        })
    counts: dict[str, int] = {}
    for r in results:
        counts[r["category"]] = counts.get(r["category"], 0) + 1
    summary = {
        "total": len(results),
        "counts": counts,
        "best": results[0] if results else None,
        "high_match": counts.get("HIGH MATCH", 0),
        "good_match": counts.get("GOOD MATCH", 0),
        "possible_match": counts.get("POSSIBLE MATCH", 0),
        "not_eligible": counts.get("NOT CURRENTLY ELIGIBLE", 0),
    }
    return {"recommendations": results, "recommendation_summary": summary}, {
        "task": "Ranked schemes into recommendation categories",
        "detail": f"{counts.get('HIGH MATCH', 0)} HIGH MATCH · {counts.get('GOOD MATCH', 0)} GOOD MATCH · {counts.get('POSSIBLE MATCH', 0)} POSSIBLE",
    }


# --------------------------------------------------------------------------- #
# 6. Explanation Agent
# --------------------------------------------------------------------------- #
def explanation_agent(state: dict) -> tuple[dict, dict]:
    by_id = {e["scheme_id"]: e for e in state.get("evaluations", [])}
    for r in state.get("recommendations", []):
        ev = by_id.get(r["scheme_id"], {})
        r["explanation"] = {
            "scheme_name": ev.get("scheme_name", r["scheme_name"]),
            "summary": ev.get("reasons", []),
            "why_eligible": [m.get("label") or m.get("reason") for m in ev.get("matched_rules", [])],
            "why_not_eligible": [m.get("label") or m.get("reason") for m in ev.get("failed_rules", [])],
            "need_more_info": [m.get("reason") for m in ev.get("unknown_rules", [])],
            "missing_profile_fields": list(dict.fromkeys(m.get("field", "") for m in ev.get("unknown_rules", []) if m.get("field"))),
            "next_steps": ev.get("next_steps", []),
        }
    explained = len(state.get("recommendations", []))
    return {"explanations": [r["explanation"] for r in state.get("recommendations", [])]}, {
        "task": "Generated plain-language eligibility explanations",
        "detail": f"{explained} schemes explained",
    }


_AGENT_FNS = {
    "profile": profile_agent,
    "eligibility": eligibility_agent,
    "research": research_agent,
    "documents": documents_agent,
    "recommendation": recommendation_agent,
    "explanation": explanation_agent,
}


# --------------------------------------------------------------------------- #
# Orchestrator
# --------------------------------------------------------------------------- #
def run_investigation(
    db: Session,
    user: User,
    profile: dict,
    schemes: list[dict],
    *,
    focus_scheme_id: str | None = None,
    scheme_name: str = "",
    saved_scheme_ids: set | None = None,
    applied_scheme_ids: set | None = None,
    uploaded_docs: set | None = None,
    doc_expiry: dict | None = None,
) -> dict:
    run_id = _runid()
    now = datetime.now(timezone.utc)
    inv = Investigation(
        user_id=user.id,
        run_id=run_id,
        status="running",
        focus="scheme" if focus_scheme_id else "all",
        scheme_id=focus_scheme_id,
        scheme_name=scheme_name,
        agent_total=len(AGENTS),
        agent_completed=0,
        total_schemes=len(schemes),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    state: dict = {
        "profile": profile,
        "schemes": schemes,
        "focus_scheme_id": focus_scheme_id,
        "uploaded_docs": set(uploaded_docs or []),
        "doc_expiry": doc_expiry or {},
        "saved_scheme_ids": set(saved_scheme_ids or []),
        "applied_scheme_ids": set(applied_scheme_ids or []),
    }

    agent_logs: list[dict] = []
    executions: list[dict] = []
    started_at = time.perf_counter()
    try:
        for step, (key, name) in enumerate(AGENTS, start=1):
            inv.current_agent = name
            db.commit()
            agent_started = time.perf_counter()
            log: dict = {}
            failed = False
            try:
                mut, log = _AGENT_FNS[key](state)
                state.update(mut)
            except Exception as exc:  # keep going: one failing agent must not sink the run
                failed = True
                log = {"task": f"{name} step failed", "detail": str(exc)[:200]}
            duration = int((time.perf_counter() - agent_started) * 1000)

            db.add(AgentExecution(
                run_id=run_id,
                user_id=user.id,
                investigation_id=inv.id,
                agent_key=key,
                agent_name=name,
                step=step,
                status="failed" if failed else "completed",
                task=log.get("task", ""),
                detail=log.get("detail", ""),
                result=state,
                duration_ms=duration,
                started_at=now,
                completed_at=datetime.now(timezone.utc),
                error=log.get("detail", "") if failed else "",
            ))
            agent_logs.append({"agent": name, "task": log.get("task", ""), "detail": log.get("detail", ""), "status": "failed" if failed else "completed", "duration_ms": duration})
            executions.append({"step": step, "agent_key": key, "agent_name": name, "status": "failed" if failed else "completed", "task": log.get("task", ""), "detail": log.get("detail", ""), "duration_ms": duration})
            inv.agent_completed = step
            db.commit()

        for r in state.get("recommendations", []):
            db.add(InvestigationResult(
                investigation_id=inv.id,
                scheme_id=r["scheme_id"],
                scheme_name=r["scheme_name"],
                rank=r["rank"],
                category=r["category"],
                eligibility_status=r["eligibility_status"],
                score=r["score"],
                confidence=r["confidence"],
                matched_count=r["matched_count"],
                failed_count=r["failed_count"],
                unknown_count=r["unknown_count"],
                reasons=r["reasons"],
                next_steps=r["next_steps"],
                document_status=r.get("document_status", {}),
                detail={"evaluation": r.get("evaluation", {}), "explanation": r.get("explanation", {}), "benefits": r.get("benefits", [])},
            ))

        inv.status = "completed"
        inv.summary = state.get("recommendation_summary", {})
    except Exception as exc:
        inv.status = "failed"
        inv.error = str(exc)
    finally:
        inv.elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        inv.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(inv)

    return {
        "investigation_id": inv.id,
        "run_id": run_id,
        "status": inv.status,
        "focus": inv.focus,
        "scheme_id": focus_scheme_id,
        "scheme_name": scheme_name,
        "error": inv.error,
        "profile_completeness": state.get("profile_completeness", 0),
        "missing_profile_fields": state.get("missing_profile_fields", []),
        "summary": inv.summary,
        "agent_logs": agent_logs,
        "agent_executions": executions,
        "recommendations": state.get("recommendations", []),
        "policy_snippets": state.get("policy_snippets", []),
        "total_schemes": len(schemes),
        "elapsed_ms": inv.elapsed_ms,
        "created_at": now.isoformat(),
    }


# --------------------------------------------------------------------------- #
# "Why am I not eligible?" - single scheme deep-dive
# --------------------------------------------------------------------------- #
def run_eligibility_evaluation(
    db: Session,
    user: User,
    profile: dict,
    scheme: dict,
    *,
    uploaded_docs: set | None = None,
    doc_expiry: dict | None = None,
) -> dict:
    """Evaluate one scheme in full tri-state and persist the breakdown."""
    from app.agents.eligibility_engine import eligibility_status_from, recommendation_category_from
    from app.models.models import EligibilityEvaluation, EligibilityRuleResult

    ev = evaluate_scheme_tri(profile, scheme)
    run_id = _runid()
    now = datetime.now(timezone.utc)
    row = EligibilityEvaluation(
        user_id=user.id,
        scheme_id=scheme.get("id", ""),
        run_id=run_id,
        status=ev["status"],
        score=ev["score"],
        confidence=ev["confidence"],
        matched_count=ev["matched_count"],
        failed_count=ev["failed_count"],
        unknown_count=ev["unknown_count"],
        profile_completeness=ev["profile_completeness"],
        summary=ev,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    for i, rule in enumerate(ev["all_rules"]):
        expected = rule.get("expected")
        if isinstance(expected, list):
            expected = json.dumps(expected)
        db.add(EligibilityRuleResult(
            evaluation_id=row.id,
            rule_index=i,
            field=rule.get("field", ""),
            label=rule.get("label") or rule.get("reason") or rule.get("field", ""),
            op=rule.get("op", ""),
            expected=expected,
            actual=json.dumps(profile.get(rule.get("field"), "")) if rule.get("field") else "",
            outcome=rule["outcome"],
            reason=rule.get("reason", ""),
            improve=rule.get("improve", ""),
            weight=float(rule.get("weight", 1)),
        ))
    db.commit()

    # document readiness for this scheme
    required = scheme.get("required_documents") or []
    uploaded = set(uploaded_docs or [])
    expiry_map = doc_expiry or {}
    doc_items = []
    for doc in required:
        if doc in uploaded:
            exp = expiry_map.get(doc, "")
            doc_items.append({"doc": doc, "state": "expired" if _is_expired(exp) else "available", "expiry_date": exp or ""})
        else:
            doc_items.append({"doc": doc, "state": "missing", "expiry_date": ""})

    return {
        "evaluation_id": row.id,
        "run_id": run_id,
        "scheme_id": scheme.get("id", ""),
        "scheme_name": scheme.get("name", ""),
        "status": ev["status"],
        "category": recommendation_category_from(ev["status"], ev["score"]),
        "score": ev["score"],
        "confidence": ev["confidence"],
        "approval_probability": ev["approval_probability"],
        "matched_count": ev["matched_count"],
        "failed_count": ev["failed_count"],
        "unknown_count": ev["unknown_count"],
        "profile_completeness": ev["profile_completeness"],
        "reasons": ev["reasons"],
        "next_steps": ev["next_steps"],
        "matched_rules": ev["matched_rules"],
        "failed_rules": ev["failed_rules"],
        "unknown_rules": ev["unknown_rules"],
        "missing_profile_fields": list(dict.fromkeys(
            m.get("field") for m in ev["unknown_rules"] if m.get("field")
        )),
        "document_status": {
            "required": required,
            "available": [i["doc"] for i in doc_items if i["state"] == "available"],
            "missing": [i["doc"] for i in doc_items if i["state"] == "missing"],
            "expired": [i["doc"] for i in doc_items if i["state"] == "expired"],
            "items": doc_items,
            "ready": all(i["state"] == "available" for i in doc_items) if doc_items else True,
        },
        "official_link": scheme.get("official_link", ""),
        "has_official_link": bool(scheme.get("official_link")),
        "application_portal": scheme.get("application_portal", ""),
        "benefits": scheme.get("benefits", []),
        "created_at": now.isoformat(),
    }

