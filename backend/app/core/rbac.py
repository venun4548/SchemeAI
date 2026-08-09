"""Role-based access control for the SchemeAI enterprise admin portal.

Roles model real government operations staffing. Every admin action is
checked against a permission list and (where required) an approval chain.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.models import User

SUPER_ADMIN = "super_admin"
OPERATIONS_ADMIN = "operations_admin"
SCHEME_ADMIN = "scheme_admin"
CONTENT_REVIEWER = "content_reviewer"
SUPPORT_AGENT = "support_agent"
AI_OPS = "ai_operations"
ANALYST = "analyst"

ADMIN_ROLES = [
    SUPER_ADMIN,
    OPERATIONS_ADMIN,
    SCHEME_ADMIN,
    CONTENT_REVIEWER,
    SUPPORT_AGENT,
    AI_OPS,
    ANALYST,
]

ROLE_LABELS = {
    SUPER_ADMIN: "Super Admin",
    OPERATIONS_ADMIN: "Operations Admin",
    SCHEME_ADMIN: "Scheme Admin",
    CONTENT_REVIEWER: "Content Reviewer",
    SUPPORT_AGENT: "Support Agent",
    AI_OPS: "AI Operations",
    ANALYST: "Analyst",
}

# Permission model ---------------------------------------------------------- #
# Permissions:
#   apps.*            application processing
#   docs.*            document review
#   users.*           user management
#   cases.*           support cases
#   schemes.edit      edit scheme details / eligibility
#   schemes.publish   publish / archive schemes
#   schemes.review    review scheme submissions
#   knowledge.edit    edit & index knowledge docs
#   knowledge.review  approve knowledge docs
#   ai.control        pause / retry / resolve agents & incidents
#   analytics.view    view analytics & reports
#   audit.view        view audit log
#   security.view     view security center
#   roles.manage      assign admin roles

PERMISSIONS: dict[str, set[str]] = {
    SUPER_ADMIN: {
        "*",
        "apps.*", "docs.*", "users.*", "cases.*", "schemes.edit", "schemes.publish",
        "schemes.review", "knowledge.edit", "knowledge.review", "ai.control",
        "analytics.view", "audit.view", "security.view", "roles.manage",
        "settings.manage", "reports.export", "users.view",
    },
    OPERATIONS_ADMIN: {
        "apps.*", "docs.*", "users.view", "cases.*", "schemes.view",
        "knowledge.view", "ai.view", "analytics.view", "audit.view",
    },
    SCHEME_ADMIN: {
        "apps.view", "docs.view", "users.view", "cases.view", "schemes.view",
        "schemes.edit", "schemes.review", "schemes.publish", "knowledge.view",
        "knowledge.edit", "knowledge.review", "analytics.view", "audit.view",
    },
    CONTENT_REVIEWER: {
        "schemes.view", "schemes.edit", "knowledge.view", "knowledge.edit",
        "knowledge.review", "analytics.view", "audit.view",
    },
    SUPPORT_AGENT: {
        "users.view", "cases.*", "apps.view", "docs.view", "schemes.view",
        "analytics.view",
    },
    AI_OPS: {
        "ai.control", "ai.view", "apps.view", "docs.view", "knowledge.view",
        "analytics.view", "audit.view",
    },
    ANALYST: {
        "apps.view", "docs.view", "users.view", "schemes.view", "knowledge.view",
        "ai.view", "analytics.view", "reports.export", "audit.view",
    },
}

# Canonical permission names (as used by the enterprise permission matrix) map
# onto the internal grants above. Endpoints may require either form.
CANONICAL_TO_INTERNAL = {
    "users.view": "users.view",
    "users.edit": "users.*",
    "users.suspend": "users.*",
    "admins.create": "users.*",
    "admins.edit": "users.*",
    "admins.disable": "users.*",
    "applications.view": "apps.view",
    "applications.review": "apps.*",
    "applications.approve": "apps.*",
    "applications.reject": "apps.*",
    "documents.view": "docs.view",
    "documents.verify": "docs.*",
    "schemes.create": "schemes.edit",
    "schemes.edit": "schemes.edit",
    "schemes.review": "schemes.review",
    "schemes.publish": "schemes.publish",
    "schemes.archive": "schemes.publish",
    "content.review": "knowledge.review",
    "content.approve": "knowledge.review",
    "support.create": "cases.*",
    "support.assign": "cases.*",
    "support.resolve": "cases.*",
    "ai.view": "ai.view",
    "ai.retry": "ai.control",
    "ai.pause": "ai.control",
    "ai.resume": "ai.control",
    "reports.view": "analytics.view",
    "reports.export": "reports.export",
    "audit.view": "audit.view",
    "security.view": "security.view",
    "settings.manage": "settings.manage",
}


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def has_permission(user: User, perm: str) -> bool:
    if user.role != "admin":
        return False
    grants = PERMISSIONS.get(user.admin_role, set())
    if "*" in grants:
        return True
    targets = {perm}
    internal = CANONICAL_TO_INTERNAL.get(perm)
    if internal:
        targets.add(internal)
    for t in targets:
        if t in grants:
            return True
        for g in grants:
            if g.endswith(".*") and t.startswith(g[:-1]):
                return True
    return False


def require_permission(perm: str):
    def dep(user: User = Depends(require_admin)):
        if not has_permission(user, perm):
            raise HTTPException(status_code=403, detail=f"Requires permission: {perm}")
        return user

    return dep


def admin_to_dict(u: User) -> dict:
    from app.api.deps import user_to_dict

    d = user_to_dict(u)
    d["admin_role"] = u.admin_role
    d["role_label"] = ROLE_LABELS.get(u.admin_role, u.admin_role)
    d["last_login_at"] = u.last_login_at.isoformat() if u.last_login_at else None
    return d
