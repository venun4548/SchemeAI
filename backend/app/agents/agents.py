"""The ten SchemeAI agents, wired together in an AgentGraph.

Each agent is a pure state->state function; the graph routes work through
them exactly as the UI's "agent control panel" describes:

Profiling -> Eligibility -> Policy(RAG) -> Recommender -> Explainability
                                          -> Guidance -> Fraud -> Documents
"""
from __future__ import annotations

import hashlib
import json
import time

from app.agents.eligibility_engine import score_scheme
from app.agents.graph import AgentGraph
from app.agents.profile import derive, normalize
from app.rag.vector_store import RAGStore

DEFAULT_GOALS = {
    "farmer": "Farming support & income security",
    "agriculture labourer": "Livelihood & social security",
    "student": "Education scholarships & skill training",
    "employee": "Housing & welfare",
    "self-employed": "Business loans & MSME support",
    "business": "Business loans & MSME support",
    "unemployed": "Skill training & employment support",
    "retired": "Pension & senior citizen welfare",
    "housewife": "Women empowerment & household benefits",
    "daily wage": "Social security & insurance",
}


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


# --------------------------------------------------------------------------- #
# 1. User Profiling Agent
# --------------------------------------------------------------------------- #
def profiling_agent(state: dict) -> dict:
    raw = state.get("raw_profile") or state.get("profile") or {}
    if state.get("profile") and not raw:
        raw = state["profile"]
    profile = normalize(raw)
    state["profile"] = profile
    state["profile_hash"] = _hash(json.dumps(profile, sort_keys=True))
    state.setdefault("agent_logs", []).append({
        "agent": "Profiling Agent",
        "task": "Validated structured citizen profile",
        "detail": f"{profile.get('age', '?')}y · {profile.get('occupation') or 'n/a'} · {profile.get('state') or 'n/a'}",
    })
    return state


# --------------------------------------------------------------------------- #
# 2. Eligibility Matching Agent
# --------------------------------------------------------------------------- #
def eligibility_agent(state: dict) -> dict:
    profile = derive(state.get("profile") or {})
    schemes = state.get("schemes") or []
    results = [score_scheme(profile, s) for s in schemes]
    results.sort(key=lambda r: (r["score"], r["confidence"]), reverse=True)
    state["scores"] = results
    state.setdefault("agent_logs", []).append({
        "agent": "Eligibility Agent",
        "task": f"Scored {len(results)} schemes against your profile",
        "detail": f"Top score {results[0]['score']}% · {results[0]['scheme_name']}" if results else "No schemes",
    })
    return state


# --------------------------------------------------------------------------- #
# 3. Government Policy Agent (RAG)
# --------------------------------------------------------------------------- #
def policy_agent(state: dict) -> dict:
    profile = state.get("profile") or {}
    store = RAGStore()
    query = (
        f"{profile.get('occupation', '')} {profile.get('state', '')} "
        f"scheme eligibility 2026"
    ).strip()
    snippets = store.search(query, k=5)
    state["policy_snippets"] = snippets
    state.setdefault("agent_logs", []).append({
        "agent": "Policy Agent",
        "task": "Retrieved policy context from knowledge base",
        "detail": f"{len(snippets)} documents retrieved via RAG",
    })
    return state


# --------------------------------------------------------------------------- #
# 4. Personalized Recommendation Agent
# --------------------------------------------------------------------------- #
def _relevance(score: float) -> int:
    return int(round(score / 20))


def recommender_agent(state: dict) -> dict:
    profile = derive(state.get("profile") or {})
    scores = state.get("scores") or []
    saved_ids = set(state.get("saved_scheme_ids") or [])
    applied_ids = set(state.get("applied_scheme_ids") or [])
    goal = state.get("goal") or DEFAULT_GOALS.get(str(profile.get("occupation", "")).lower(), "General welfare")

    ranked = []
    for s in scores:
        scheme = next((x for x in (state.get("schemes") or []) if x["id"] == s["scheme_id"]), {})
        boost = 0.0
        cat = str(scheme.get("category", "")).lower()
        tags = [str(t).lower() for t in scheme.get("tags", [])]
        occ = str(profile.get("occupation", "")).lower()
        state_name = str(profile.get("state", "")).lower()
        if cat in occ or any(t in occ for t in tags):
            boost += 10
        if str(scheme.get("state_specific", "")).lower() in ("all", state_name):
            boost += 5
        if scheme.get("level") == "state" and state_name and str(scheme.get("state_specific", "")).lower() == state_name:
            boost += 4
        final = round(min(100, s["score"] * 0.8 + boost), 1)
        ranked.append({
            "scheme": scheme,
            "score": s,
            "final_score": final,
            "is_saved": scheme.get("id") in saved_ids,
            "has_applied": scheme.get("id") in applied_ids,
        })
    ranked.sort(key=lambda r: r["final_score"], reverse=True)

    best = ranked[0] if ranked else None
    second = ranked[1] if len(ranked) > 1 else None
    alternatives = ranked[2:6]

    state["recommendations"] = {
        "goal": goal,
        "best_match": best,
        "second_best": second,
        "alternatives": alternatives,
        "total_matches": len(ranked),
    }
    state.setdefault("agent_logs", []).append({
        "agent": "Recommender Agent",
        "task": "Ranked personalized recommendations",
        "detail": f"Goal: {goal}",
    })
    return state


# --------------------------------------------------------------------------- #
# 5. Explainability Agent
# --------------------------------------------------------------------------- #
def explainability_agent(state: dict) -> dict:
    best = (state.get("recommendations") or {}).get("best_match")
    if not best:
        state["explanation"] = {"summary": "Complete your profile to get explanations."}
        return state
    s = best["score"]
    profile = derive(state.get("profile") or {})
    matched = s.get("matched_rules", [])
    missing = s.get("missing_rules", [])
    summary_lines = []
    for m in matched[:6]:
        summary_lines.append({"ok": True, "text": m.get("label") or m.get("reason")})
    for m in missing[:6]:
        summary_lines.append({"ok": False, "text": m.get("label") or m.get("reason")})
    state["explanation"] = {
        "scheme_name": best["scheme"].get("name"),
        "why_eligible": [x["text"] for x in summary_lines if x["ok"]],
        "why_not_eligible": [x["text"] for x in summary_lines if not x["ok"]],
        "matched_rules": matched,
        "missing_rules": missing,
        "approval_probability": s.get("approval_probability"),
        "confidence": s.get("confidence"),
        "next_steps": s.get("next_steps", []),
        "profile_snapshot": {
            k: profile.get(k) for k in ("age", "occupation", "annual_income", "state", "category", "gender")
        },
    }
    state.setdefault("agent_logs", []).append({
        "agent": "Explainability Agent",
        "task": "Generated plain-language explanation",
        "detail": f"{len(matched)} criteria matched · {len(missing)} missing",
    })
    return state


# --------------------------------------------------------------------------- #
# 6. Application Guidance Agent
# --------------------------------------------------------------------------- #
def _steps_for(scheme: dict, has_docs: bool) -> list[dict]:
    base = [
        {"step": 1, "title": f"Visit {scheme.get('application_portal') or 'the official portal'}",
         "detail": f"Open the application portal for {scheme.get('name')}."},
        {"step": 2, "title": "Login with your account",
         "detail": "Use your Aadhaar-linked mobile number or email to sign in."},
        {"step": 3, "title": "Upload Aadhaar",
         "detail": "Upload a clear, legible Aadhaar card."},
        {"step": 4, "title": "Upload income certificate",
         "detail": "Income certificate issued by the revenue department."},
        {"step": 5, "title": "Submit application",
         "detail": "Review the details and submit. Note the application reference number."},
    ]
    if has_docs:
        base.insert(3, {"step": 4, "title": "Attach verified documents",
                        "detail": "Attach the documents already verified on SchemeAI."})
    return base


def guidance_agent(state: dict) -> dict:
    best = (state.get("recommendations") or {}).get("best_match")
    if not best:
        return state
    has_docs = bool(state.get("document_ok", True))
    steps = _steps_for(best["scheme"], has_docs)
    state["guidance"] = {
        "scheme_name": best["scheme"].get("name"),
        "steps": steps,
        "estimated_time": best["scheme"].get("application_time") or "15–30 minutes",
    }
    state.setdefault("agent_logs", []).append({
        "agent": "Guidance Agent",
        "task": "Generated step-by-step application roadmap",
        "detail": f"{len(steps)} steps",
    })
    return state


# --------------------------------------------------------------------------- #
# 7. Fraud Detection Agent
# --------------------------------------------------------------------------- #
def fraud_agent(state: dict) -> dict:
    profile = state.get("profile") or {}
    flags = []
    if not profile.get("aadhaar_linked") and state.get("check_fraud", True):
        flags.append({"type": "identity", "level": "info",
                      "message": "Link Aadhaar before applying; some portals reject unlinked applications."})
    if state.get("suspicious_link"):
        flags.append({"type": "link", "level": "high",
                      "message": "The provided link is not an official government domain."})
    state["fraud_flags"] = flags
    state.setdefault("agent_logs", []).append({
        "agent": "Fraud Agent",
        "task": "Screened application for risks",
        "detail": f"{len(flags)} flags raised",
    })
    return state


# --------------------------------------------------------------------------- #
# 8. Document Verification Agent
# --------------------------------------------------------------------------- #
def documents_agent(state: dict) -> dict:
    best = (state.get("recommendations") or {}).get("best_match")
    uploaded = set(state.get("uploaded_docs") or [])
    if not best:
        return state
    required = best["scheme"].get("required_documents") or []
    missing = [d for d in required if d not in uploaded]
    state["document_status"] = {
        "required": required,
        "uploaded": [d for d in required if d in uploaded],
        "missing": missing,
        "ok": len(missing) == 0,
    }
    state.setdefault("agent_logs", []).append({
        "agent": "Document Agent",
        "task": "Checked document readiness",
        "detail": f"{len(required) - len(missing)}/{len(required)} documents ready" if required else "No docs required",
    })
    return state


# --------------------------------------------------------------------------- #
# Workflow assembly
# --------------------------------------------------------------------------- #
def build_recommendation_workflow() -> AgentGraph:
    g = AgentGraph(entrypoint="profiling")
    g.add("profiling", profiling_agent)
    g.add("eligibility", eligibility_agent)
    g.add("policy", policy_agent)
    g.add("recommender", recommender_agent)
    g.add("explainability", explainability_agent)
    g.add("guidance", guidance_agent)
    g.add("fraud", fraud_agent)
    g.add("documents", documents_agent)

    def _has_schemes(s):
        return bool(s.get("scores"))
    g.nodes["eligibility"].default_route = "policy"
    g.nodes["policy"].default_route = "recommender"
    g.nodes["recommender"].default_route = "explainability"
    g.nodes["explainability"].default_route = "guidance"
    g.nodes["guidance"].default_route = "fraud"
    g.nodes["fraud"].default_route = "documents"
    g.nodes["profiling"].default_route = "eligibility"
    g.nodes["documents"].default_route = None
    return g


def run_recommendation_workflow(profile: dict, schemes: list[dict], **kw) -> dict:
    start = time.perf_counter()
    g = build_recommendation_workflow()
    state = g.run({
        "profile": profile,
        "schemes": schemes,
        **kw,
    })
    state["runtime_ms"] = int((time.perf_counter() - start) * 1000)
    return state
