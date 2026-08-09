"""Profile normalisation: turns raw questionnaire answers / form payloads
into a canonical profile dict with derived flags used by the rule engine.
"""
from __future__ import annotations

from typing import Any

STATES = [
    "Andhra Pradesh", "Telangana", "Tamil Nadu", "Karnataka", "Kerala",
    "Maharashtra", "Gujarat", "Rajasthan", "Uttar Pradesh", "Madhya Pradesh",
    "Bihar", "West Bengal", "Odisha", "Assam", "Punjab", "Haryana",
    "Delhi", "Chhattisgarh", "Jharkhand", "Himachal Pradesh", "Uttarakhand",
    "Goa", "Meghalaya", "Manipur", "Tripura", "Mizoram", "Nagaland",
    "Sikkim", "Arunachal Pradesh", "Puducherry", "Jammu and Kashmir",
    "Ladakh", "Andaman and Nicobar", "Chandigarh",
]

OCCUPATIONS = [
    "farmer", "agriculture labourer", "student", "employee", "self-employed",
    "business", "unemployed", "retired", "housewife", "daily wage", "other",
]

GENDERS = ["male", "female", "other"]


def _b(v: Any, default=False) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.strip().lower() in {"1", "true", "yes", "y", "on"}
    return default


def derive(profile: dict) -> dict:
    """Derive convenience flags used by scheme rules from raw profile."""
    p = dict(profile)
    age = p.get("age")
    income = p.get("annual_income")
    occ = str(p.get("occupation", "")).strip().lower()
    gender = str(p.get("gender", "")).strip().lower()

    p["is_farmer"] = occ in {"farmer", "agriculture labourer"} or p.get("land_owned_acres") not in (None, "", 0)
    p["is_student"] = occ == "student"
    p["is_entrepreneur"] = _b(p.get("is_entrepreneur")) or occ in {"self-employed", "business"}
    p["is_senior"] = isinstance(age, (int, float)) and age >= 60
    p["is_minor"] = isinstance(age, (int, float)) and age < 18
    p["is_woman"] = gender == "female"
    p["income_below_1l"] = income is not None and income < 100000
    p["income_below_2p5l"] = income is not None and income <= 250000
    p["income_below_3l"] = income is not None and income <= 300000
    p["income_below_8l"] = income is not None and income <= 800000
    p["income_below_18l"] = income is not None and income <= 1800000
    p["income_below_2p4l"] = income is not None and income <= 240000
    p["has_unorganised_income"] = income is not None and occ in {"daily wage", "agriculture labourer", "farmer"}
    p["retired"] = occ == "retired"
    return p


def normalize(raw: dict) -> dict:
    """Coerce raw form values into typed profile keys."""
    p = {}
    for key in ("age", "annual_income", "land_owned_acres", "business_years", "cibil_score"):
        v = raw.get(key)
        if v in (None, ""):
            p[key] = None
        else:
            try:
                p[key] = float(v) if key in ("annual_income", "land_owned_acres") else int(float(v))
            except (ValueError, TypeError):
                p[key] = None
    for key in ("gender", "state", "district", "occupation", "industry", "education",
                "category", "disability", "marital_status", "employment_type",
                "business_type", "student_degree", "village_panchayat"):
        p[key] = str(raw.get(key, "")).strip()
    for key in ("has_children", "children_girl", "is_entrepreneur", "is_marginal_farmer",
                "has_savings_account", "has_kisan_credit_card", "pension_age_reached",
                "has_lpg_connection", "has_ration_card", "has_house", "is_widow",
                "aadhaar_linked"):
        p[key] = _b(raw.get(key))
    p["land_owned_acres"] = float(p["land_owned_acres"]) if p["land_owned_acres"] is not None else None
    return derive(p)
