from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.models import FamilyMember, Profile, Scheme, User


def profile_to_dict(p: Profile | None) -> dict:
    if p is None:
        return {}
    return {
        "id": p.id, "user_id": p.user_id, "age": p.age, "gender": p.gender,
        "state": p.state, "district": p.district, "occupation": p.occupation,
        "industry": p.industry, "annual_income": p.annual_income, "education": p.education,
        "category": p.category, "disability": p.disability, "marital_status": p.marital_status,
        "has_children": p.has_children, "children_girl": p.children_girl,
        "employment_type": p.employment_type, "is_entrepreneur": p.is_entrepreneur,
        "business_type": p.business_type, "business_years": p.business_years,
        "land_owned_acres": p.land_owned_acres, "is_marginal_farmer": p.is_marginal_farmer,
        "has_savings_account": p.has_savings_account, "has_kisan_credit_card": p.has_kisan_credit_card,
        "student_degree": p.student_degree, "cibil_score": p.cibil_score,
        "pension_age_reached": p.pension_age_reached, "has_lpg_connection": p.has_lpg_connection,
        "has_ration_card": p.has_ration_card, "has_house": p.has_house, "is_widow": p.is_widow,
        "village_panchayat": p.village_panchayat, "aadhaar_linked": p.aadhaar_linked,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def scheme_to_dict(s: Scheme, include_rules: bool = True) -> dict:
    d = {
        "id": s.id, "code": s.code, "name": s.name, "short_name": s.short_name,
        "ministry": s.ministry, "department": s.department, "level": s.level,
        "category": s.category, "description": s.description, "benefits": s.benefits,
        "required_documents": s.required_documents, "amount": s.amount,
        "amount_max": s.amount_max, "duration": s.duration,
        "application_time": s.application_time, "renewal_policy": s.renewal_policy,
        "official_link": s.official_link, "application_portal": s.application_portal,
        "target_audience": s.target_audience, "state_specific": s.state_specific,
        "tags": s.tags, "is_active": s.is_active, "is_trending": s.is_trending,
    }
    if include_rules:
        d["eligibility_rules"] = s.eligibility_rules
    return d


def user_to_dict(u: User) -> dict:
    sec_verified = getattr(u, "secondary_verified", False) if u.role == "admin" else True
    return {
        "id": u.id, "citizen_id": u.citizen_id, "email": u.email, "phone": u.phone, "full_name": u.full_name,
        "role": u.role, "language": u.language, "is_verified": u.is_verified,
        "is_active": u.is_active,
        "admin_role": u.admin_role,
        "secondary_verified": sec_verified,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "profile": profile_to_dict(u.profile),
        "profile_completeness": _completeness(u.profile),
    }


def _completeness(p: Profile | None) -> int:
    if not p:
        return 0
    fields = ["age", "gender", "state", "district", "occupation", "annual_income",
              "education", "category", "disability"]
    filled = sum(1 for f in fields if getattr(p, f) not in (None, "", 0, False))
    return int(filled / len(fields) * 100)


def get_or_create_profile(db: Session, user: User) -> Profile:
    p = user.profile
    if p is None:
        p = Profile(user_id=user.id)
        db.add(p)
        db.commit()
        db.refresh(user)
    return p


def family_to_dict(m: FamilyMember) -> dict:
    return {
        "id": m.id, "name": m.name, "relationship": m.relationship, "age": m.age,
        "gender": m.gender, "occupation": m.occupation, "annual_income": m.annual_income,
        "education": m.education, "disability": m.disability, "is_student": m.is_student,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }
