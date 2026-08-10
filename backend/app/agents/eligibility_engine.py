"""Rule-based eligibility scoring engine.

Each scheme defines a list of rules. A rule evaluates one profile attribute
(optionally as a compound "any"/"all" group). Weights are normalised to a
0-100 score, confidence reflects profile completeness, and every result is
fully explainable (matched / missing / how-to-improve).
"""
from __future__ import annotations

import re
from typing import Any


def _num(v: Any) -> float | None:
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").replace("₹", "").strip())
    except (ValueError, TypeError):
        return None


def _norm(v: Any) -> str:
    if v is None:
        return ""
    return str(v).strip().lower()


def _in(value: Any, choices: list) -> bool:
    return _norm(value) in {_norm(c) for c in choices}


def evaluate_op(field_value: Any, op: str, expected: Any) -> tuple[bool, str]:
    """Return (matched, reason)."""
    if op in ("gte", "gt", "lte", "lt", "eq", "ne", "between"):
        actual = _num(field_value)
        exp = _num(expected)
        if op == "gte":
            if actual is None:
                return False, "value not provided"
            return actual >= exp, f"{actual} >= {exp}"
        if op == "gt":
            if actual is None:
                return False, "value not provided"
            return actual > exp, f"{actual} > {exp}"
        if op == "lte":
            if actual is None:
                return False, "value not provided"
            return actual <= exp, f"{actual} <= {exp}"
        if op == "lt":
            if actual is None:
                return False, "value not provided"
            return actual < exp, f"{actual} < {exp}"
        if op == "eq":
            return _norm(field_value) == _norm(expected), f"{_norm(field_value)} == {_norm(expected)}"
        if op == "ne":
            return _norm(field_value) != _norm(expected), f"{_norm(field_value)} != {_norm(expected)}"
        if op == "between":
            lo, hi = expected
            if actual is None:
                return False, "value not provided"
            return lo <= actual <= hi, f"{lo} <= {actual} <= {hi}"
    if op == "in":
        return _in(field_value, expected), f"in {expected}"
    if op == "not_in":
        return not _in(field_value, expected), f"not in {expected}"
    if op == "boolean":
        return bool(field_value) == bool(expected), f"bool == {bool(expected)}"
    if op == "is_true":
        return bool(field_value) is True, "is true"
    if op == "contains":
        return _norm(expected) in _norm(field_value), f"contains {expected}"
    if op == "regex":
        try:
            return re.search(expected, _norm(field_value)) is not None, f"matches {expected}"
        except re.error:
            return False, "bad regex"
    return False, f"unknown op {op}"


def _field_from_rule(rule: dict) -> str:
    if "field" in rule:
        return rule["field"]
    if "any" in rule and rule["any"]:
        return rule["any"][0].get("field", "")
    if "all" in rule and rule["all"]:
        return rule["all"][0].get("field", "")
    return ""


def evaluate_rule(rule: dict, profile: dict) -> dict:
    """Evaluate a single rule against a profile dict."""
    if "any" in rule:
        subs = rule["any"]
        inner = [evaluate_rule(r, profile) for r in subs]
        matched = any(i["matched"] for i in inner)
        reason = " or ".join(i["reason"] for i in inner)
        label = rule.get("label", rule.get("reason", reason))
        return {
            "matched": matched,
            "reason": reason,
            "label": label,
            "field": _field_from_rule(rule),
            "sub_rules": inner,
            "improve": rule.get("improve", ""),
        }
    if "all" in rule:
        subs = rule["all"]
        inner = [evaluate_rule(r, profile) for r in subs]
        matched = all(i["matched"] for i in inner)
        reason = " and ".join(i["reason"] for i in inner)
        return {
            "matched": matched,
            "reason": reason,
            "label": rule.get("label", rule.get("reason", reason)),
            "field": _field_from_rule(rule),
            "sub_rules": inner,
            "improve": rule.get("improve", ""),
        }

    field = rule["field"]
    value = profile.get(field)
    op = rule.get("op", "eq")
    expected = rule.get("value")
    matched, reason = evaluate_op(value, op, expected)
    if not matched and rule.get("fallback_fields"):
        for fb in rule["fallback_fields"]:
            v2 = profile.get(fb)
            if v2 is not None and v2 != "":
                m2, r2 = evaluate_op(v2, op, expected)
                if m2:
                    return {
                        "matched": True,
                        "reason": f"{r2} (via {fb})",
                        "label": rule.get("label", ""),
                        "field": field,
                        "improve": rule.get("improve", ""),
                    }
    return {
        "matched": matched,
        "reason": reason,
        "label": rule.get("label", ""),
        "field": field,
        "improve": rule.get("improve", ""),
    }


def _profile_completeness(profile: dict) -> float:
    """Share of known, meaningful profile attributes that are populated."""
    known = {
        "age": 1.0, "gender": 0.8, "state": 1.0, "district": 0.7, "occupation": 1.0,
        "annual_income": 1.0, "education": 0.8, "category": 0.6, "disability": 0.7,
        "marital_status": 0.4, "employment_type": 0.6, "is_entrepreneur": 0.6,
        "business_type": 0.4, "land_owned_acres": 0.5, "is_marginal_farmer": 0.4,
        "has_savings_account": 0.4, "has_kisan_credit_card": 0.3, "student_degree": 0.4,
        "cibil_score": 0.4, "has_lpg_connection": 0.3, "has_ration_card": 0.3,
        "has_house": 0.3, "is_widow": 0.3, "aadhaar_linked": 0.4,
        "children_girl": 0.3, "has_children": 0.4, "business_years": 0.3,
    }
    filled = sum(w for k, w in known.items() if profile.get(k) not in (None, "", 0, False))
    total = sum(known.values())
    return round(min(filled / total, 1.0) * 100, 1)


def score_scheme(profile: dict, scheme: dict) -> dict:
    """Full explainable scoring result for one scheme."""
    rules = scheme.get("eligibility_rules") or []
    if not rules:
        base = 40.0
        return {
            "scheme_id": scheme.get("id", ""),
            "scheme_name": scheme.get("name", ""),
            "score": base,
            "confidence": 30.0,
            "matched_rules": [],
            "missing_rules": [],
            "all_rules": [],
            "status": "neutral",
            "approval_probability": base,
            "reasons": ["Eligibility rules are not yet published for this scheme."],
            "next_steps": [],
            "profile_completeness": _profile_completeness(profile),
            "rule_coverage": 0,
        }

    evaluated = [evaluate_rule(r, profile) for r in rules]
    matched = [e for e in evaluated if e["matched"]]
    missing = [e for e in evaluated if not e["matched"]]

    total_weight = sum(float(r.get("weight", 1)) for r in rules) or 1.0
    score = sum(float(r.get("weight", 1)) for r, e in zip(rules, evaluated) if e["matched"])
    score = round(score / total_weight * 100, 1)

    completeness = _profile_completeness(profile)
    coverage = round(len(evaluated) / max(len(evaluated), 1) * 100, 1)
    confidence = round(
        max(0.0, min(100.0, (completeness * 0.55) + (coverage * 0.45) - max(0, len(missing)) * 3)), 1
    )
    approval = round(max(0.0, min(99.0, score * 0.62 + confidence * 0.28 + (10 if matched else 0))), 1)

    if score >= 75:
        status = "high"
    elif score >= 45:
        status = "partial"
    else:
        status = "low"

    next_steps = []
    for m in missing:
        if m.get("improve"):
            next_steps.append(m["improve"])
    # Dedupe, cap
    next_steps = list(dict.fromkeys(next_steps))[:5]

    reasons = []
    if matched:
        reasons.append(f"Met {len(matched)} of {len(rules)} eligibility criteria.")
    if missing:
        reasons.append(f"Missing {len(missing)} criteria: " + "; ".join(m["label"] for m in missing[:3]))
    if status == "high":
        reasons.append("Strong candidate for this scheme.")

    return {
        "scheme_id": scheme.get("id", ""),
        "scheme_name": scheme.get("name", ""),
        "score": score,
        "confidence": confidence,
        "matched_rules": matched,
        "missing_rules": missing,
        "all_rules": evaluated,
        "status": status,
        "approval_probability": approval,
        "reasons": reasons,
        "next_steps": next_steps,
        "profile_completeness": completeness,
        "rule_coverage": coverage,
    }


# --------------------------------------------------------------------------- #
# Three-state evaluation: MATCHED / FAILED / UNKNOWN
# --------------------------------------------------------------------------- #
# Derived flags are computed by app.agents.profile.derive; a derived flag is
# only "known" when at least one of its source attributes is populated.
DERIVED_SOURCES: dict[str, list[str]] = {
    "is_farmer": ["occupation", "land_owned_acres"],
    "is_student": ["occupation"],
    "is_entrepreneur": ["occupation", "is_entrepreneur"],
    "is_senior": ["age"],
    "is_minor": ["age"],
    "is_woman": ["gender"],
    "income_below_1l": ["annual_income"],
    "income_below_2p5l": ["annual_income"],
    "income_below_3l": ["annual_income"],
    "income_below_8l": ["annual_income"],
    "income_below_18l": ["annual_income"],
    "income_below_2p4l": ["annual_income"],
    "has_unorganised_income": ["annual_income", "occupation"],
    "retired": ["occupation"],
}

FIELD_LABELS: dict[str, str] = {
    "age": "age", "gender": "gender", "state": "state", "district": "district",
    "occupation": "occupation", "annual_income": "annual income",
    "education": "education", "category": "social category",
    "disability": "disability status", "marital_status": "marital status",
    "employment_type": "employment type", "is_entrepreneur": "business status",
    "business_type": "business type", "business_years": "business vintage",
    "land_owned_acres": "land ownership", "is_marginal_farmer": "land holding size",
    "has_savings_account": "savings account status", "has_kisan_credit_card": "Kisan Credit Card status",
    "student_degree": "degree details", "cibil_score": "CIBIL score",
    "has_lpg_connection": "LPG connection status", "has_ration_card": "ration card status",
    "has_house": "house ownership", "is_widow": "marital status",
    "aadhaar_linked": "Aadhaar linkage", "children_girl": "daughters in family",
    "has_children": "children", "pension_age_reached": "pension age status",
    "is_farmer": "farming engagement", "is_student": "student status",
    "is_senior": "age", "is_minor": "age", "is_woman": "gender",
    "income_below_1l": "annual income", "income_below_2p5l": "annual income",
    "income_below_3l": "annual income", "income_below_8l": "annual income",
    "income_below_18l": "annual income", "income_below_2p4l": "annual income",
    "has_unorganised_income": "income and occupation",
    "retired": "occupation", "village_panchayat": "village panchayat",
}


def _value_known(profile: dict, field: str) -> bool:
    if field in DERIVED_SOURCES:
        return any(profile.get(src) not in (None, "", 0, False) for src in DERIVED_SOURCES[field])
    return profile.get(field) not in (None, "")


def _field_label(field: str) -> str:
    return FIELD_LABELS.get(field, field.replace("_", " "))


def evaluate_rule_tri(rule: dict, profile: dict) -> dict:
    """Evaluate one rule into matched|failed|unknown.

    unknown means the rule could not be decided because the profile does not
    carry the data the rule depends on (this is what drives
    INSUFFICIENT_INFORMATION / REQUIRES_REVIEW).
    """
    if "any" in rule:
        subs = [evaluate_rule_tri(r, profile) for r in rule["any"]]
        matched = any(s["outcome"] == "matched" for s in subs)
        if matched:
            outcome = "matched"
        elif all(s["outcome"] == "unknown" for s in subs):
            outcome = "unknown"
        else:
            outcome = "failed"
        return {
            "outcome": outcome, "matched": matched,
            "reason": " or ".join(s["reason"] for s in subs),
            "label": rule.get("label", rule.get("reason", "")),
            "field": _field_from_rule(rule),
            "sub_rules": subs,
            "weight": float(rule.get("weight", 1)),
            "op": rule.get("op", ""),
            "improve": rule.get("improve", ""),
        }
    if "all" in rule:
        subs = [evaluate_rule_tri(r, profile) for r in rule["all"]]
        matched = all(s["outcome"] == "matched" for s in subs)
        if matched:
            outcome = "matched"
        elif any(s["outcome"] == "failed" for s in subs):
            outcome = "failed"
        else:
            outcome = "unknown"
        return {
            "outcome": outcome, "matched": matched,
            "reason": " and ".join(s["reason"] for s in subs),
            "label": rule.get("label", rule.get("reason", "")),
            "field": _field_from_rule(rule),
            "sub_rules": subs,
            "weight": float(rule.get("weight", 1)),
            "op": rule.get("op", ""),
            "improve": rule.get("improve", ""),
        }

    field = rule["field"]
    op = rule.get("op", "eq")
    expected = rule.get("value")
    label = rule.get("label", "")
    improve = rule.get("improve", "")
    if not _value_known(profile, field):
        for fb in rule.get("fallback_fields", []):
            if _value_known(profile, fb):
                m, r = evaluate_op(profile.get(fb), op, expected)
                if m:
                    return {
                        "outcome": "matched", "matched": True,
                        "reason": f"{r} (via {fb})", "label": label,
                        "field": field, "improve": improve,
                        "weight": float(rule.get("weight", 1)),
                    }
        return {
            "outcome": "unknown", "matched": False,
            "reason": f"Could not be assessed — your {_field_label(field)} is not on file yet.",
            "label": label, "field": field, "improve": improve,
            "weight": float(rule.get("weight", 1)),
        }
    matched, reason = evaluate_op(profile.get(field), op, expected)
    return {
        "outcome": "matched" if matched else "failed",
        "matched": matched, "reason": reason, "label": label,
        "field": field, "improve": improve,
        "weight": float(rule.get("weight", 1)),
    }


ELIGIBILITY_STATUSES = [
    "LIKELY_ELIGIBLE", "LIKELY_NOT_ELIGIBLE", "INSUFFICIENT_INFORMATION", "REQUIRES_REVIEW",
]
RECOMMENDATION_CATEGORIES = [
    "HIGH MATCH", "GOOD MATCH", "POSSIBLE MATCH", "NOT CURRENTLY ELIGIBLE",
]
_HARD_RULE_WEIGHT = 20.0


def eligibility_status_from(failed_rules: list[dict], unknown_count: int) -> str:
    """Map tri-state rule outcomes to an overall eligibility status."""
    failed_count = len(failed_rules)
    if failed_count and any(float(r.get("weight", 1)) >= _HARD_RULE_WEIGHT for r in failed_rules):
        return "LIKELY_NOT_ELIGIBLE"
    if failed_count == 0 and unknown_count == 0:
        return "LIKELY_ELIGIBLE"
    if failed_count == 0:
        return "INSUFFICIENT_INFORMATION"
    if unknown_count > 0:
        return "REQUIRES_REVIEW"
    return "LIKELY_NOT_ELIGIBLE"


def recommendation_category_from(status: str, score: float) -> str:
    if status == "LIKELY_ELIGIBLE":
        return "HIGH MATCH" if score >= 75 else "GOOD MATCH"
    if status in ("INSUFFICIENT_INFORMATION", "REQUIRES_REVIEW"):
        return "POSSIBLE MATCH"
    return "NOT CURRENTLY ELIGIBLE"


def evaluate_scheme_tri(profile: dict, scheme: dict) -> dict:
    """Full three-state explainable evaluation for one scheme.

    Unlike score_scheme (which only splits matched/missing), this preserves the
    distinction between a rule the user genuinely fails and a rule that simply
    cannot be judged from the profile (unknown).
    """
    rules = scheme.get("eligibility_rules") or []
    if not rules:
        base = 40.0
        return {
            "scheme_id": scheme.get("id", ""),
            "scheme_name": scheme.get("name", ""),
            "score": base, "confidence": 30.0,
            "status": "INSUFFICIENT_INFORMATION", "category": "POSSIBLE MATCH",
            "matched_rules": [], "failed_rules": [], "unknown_rules": [],
            "all_rules": [], "matched_count": 0, "failed_count": 0, "unknown_count": 0,
            "approval_probability": base, "reasons": ["Eligibility rules are not yet published for this scheme."],
            "next_steps": [], "profile_completeness": _profile_completeness(profile),
            "rule_coverage": 0,
        }

    evaluated = [evaluate_rule_tri(r, profile) for r in rules]
    matched = [e for e in evaluated if e["outcome"] == "matched"]
    failed = [e for e in evaluated if e["outcome"] == "failed"]
    unknown = [e for e in evaluated if e["outcome"] == "unknown"]

    total_weight = sum(float(r.get("weight", 1)) for r in rules) or 1.0
    score = round(
        sum(float(r.get("weight", 1)) for r, e in zip(rules, evaluated) if e["outcome"] == "matched")
        / total_weight * 100, 1
    )

    completeness = _profile_completeness(profile)
    confidence = round(max(0.0, min(100.0, completeness * 0.55 + 45.0 - len(failed) * 3 - len(unknown) * 2)), 1)
    approval = round(max(0.0, min(99.0, score * 0.62 + confidence * 0.28 + (10 if matched else 0))), 1)

    status = eligibility_status_from(failed, len(unknown))
    category = recommendation_category_from(status, score)

    next_steps = []
    for r in matched + failed + unknown:
        if r.get("improve") and r["improve"] not in next_steps:
            next_steps.append(r["improve"])
    next_steps = list(dict.fromkeys(next_steps))[:6]
    if unknown:
        missing_fields = list(dict.fromkeys(_field_label(r["field"]) for r in unknown))[:4]
        next_steps.insert(0, f"Complete your profile to confirm: {', '.join(missing_fields)}.")

    reasons = []
    if matched:
        reasons.append(f"Met {len(matched)} of {len(rules)} eligibility criteria.")
    if failed:
        reasons.append(f"Does not meet {len(failed)} criteria: " + "; ".join(r["label"] for r in failed[:3]))
    if unknown:
        reasons.append(f"{len(unknown)} criteria need profile data before they can be judged.")
    if status == "LIKELY_ELIGIBLE":
        reasons.append("Strong candidate for this scheme.")

    return {
        "scheme_id": scheme.get("id", ""),
        "scheme_name": scheme.get("name", ""),
        "score": score, "confidence": confidence,
        "status": status, "category": category,
        "matched_rules": matched, "failed_rules": failed, "unknown_rules": unknown,
        "all_rules": evaluated,
        "matched_count": len(matched), "failed_count": len(failed), "unknown_count": len(unknown),
        "approval_probability": approval, "reasons": reasons,
        "next_steps": next_steps,
        "profile_completeness": completeness, "rule_coverage": 100.0,
    }


def schema_completeness(profile: dict) -> dict:
    """Which profile attributes are missing entirely (drives questionnaire)."""
    schema = {
        "age": "Age", "gender": "Gender", "state": "State", "district": "District",
        "occupation": "Occupation", "annual_income": "Annual income", "education": "Education",
        "category": "Category", "disability": "Disability status",
    }
    return {
        "filled": [k for k in schema if profile.get(k) not in (None, "", 0, False)],
        "missing": [{"key": k, "label": v} for k, v in schema.items() if profile.get(k) in (None, "", 0, False)],
        "completeness": _profile_completeness(profile),
    }
