"""Scheme comparison analysis (explainable, no LLM required)."""
from __future__ import annotations


def _best_of(schemes: list[dict], key: str, highest=True) -> dict | None:
    vals = [(s, s.get(key)) for s in schemes if s.get(key) is not None]
    if not vals:
        return None
    if highest:
        return max(vals, key=lambda x: float(x[1]))
    return min(vals, key=lambda x: float(x[1])) if all(v is not None for _, v in vals) else None


def analyze_comparison(schemes: list[dict], scores: list[dict] | None = None) -> dict:
    """Produce pros/cons, verdict and personalized recommendation."""
    if not schemes:
        return {"verdict": "No schemes to compare.", "pros": [], "cons": []}

    score_map = {s["score"].get("scheme_id"): s["score"] for s in (scores or [])}
    enriched = []
    for s in schemes:
        sc = score_map.get(s["id"])
        enriched.append({
            **s,
            "ai_score": sc.get("score", 0) if sc else 50.0,
            "approval": sc.get("approval_probability", 50.0) if sc else 50.0,
        })

    pros: list[str] = []
    cons: list[str] = []
    for s in enriched:
        amt = s.get("amount_max")
        if amt and amt >= 50000:
            pros.append(f"{s['name']} offers up to ₹{amt:,.0f} in benefits.")
        if s.get("approval", 50) >= 70:
            pros.append(f"{s['name']} has a high {s['approval']:.0f}% estimated approval chance for your profile.")
        if s.get("duration"):
            pros.append(f"{s['name']} benefit period: {s['duration']}.")
        missing_docs = len(s.get("required_documents") or [])
        if missing_docs >= 4:
            cons.append(f"{s['name']} requires {missing_docs} documents to apply.")
        if s.get("approval", 50) < 40:
            cons.append(f"{s['name']} approval chance is low ({s['approval']:.0f}%) for your current profile.")
        if s.get("renewal_policy") and "annual" in s["renewal_policy"].lower():
            cons.append(f"{s['name']} needs annual renewal.")
    pros = list(dict.fromkeys(pros))[:5]
    cons = list(dict.fromkeys(cons))[:5]

    top = max(enriched, key=lambda s: (s["ai_score"], s["approval"]))
    verdict = (
        f"Based on your profile, <b>{top['name']}</b> is the strongest option "
        f"(eligibility {top['ai_score']:.0f}%, approval {top['approval']:.0f}%). "
        f"It offers {top.get('amount') or 'a defined benefit'} with a "
        f"{'manageable' if len(top.get('required_documents') or []) <= 3 else 'moderate'} document load."
    )
    return {
        "verdict": verdict,
        "recommended_scheme_id": top["id"],
        "pros": pros,
        "cons": cons,
        "enriched": enriched,
    }
