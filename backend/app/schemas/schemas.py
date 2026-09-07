from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class ORM(BaseModel):
    model_config = {"from_attributes": True}


# ---------- Auth ----------
class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(default="", max_length=20)
    password: str = Field(min_length=8, max_length=128)
    language: str = "en"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class VerifyAdminPinIn(BaseModel):
    pin: str = Field(min_length=1, max_length=64)


class AdminUserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(default="", max_length=20)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="citizen", pattern="^(citizen|admin)$")
    admin_role: str = Field(default="operations_admin", pattern="^(super_admin|operations_admin|scheme_admin|content_reviewer|support_agent|ai_operations|analyst)$")
    language: str = "en"


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ---------- Profile ----------
class ProfileIn(BaseModel):
    age: int | None = Field(default=None, ge=0, le=120)
    gender: str = ""
    state: str = ""
    district: str = ""
    occupation: str = ""
    industry: str = ""
    annual_income: float | None = Field(default=None, ge=0)
    education: str = ""
    category: str = ""
    disability: str = ""
    marital_status: str = ""
    has_children: bool = False
    children_girl: bool = False
    employment_type: str = ""
    is_entrepreneur: bool = False
    business_type: str = ""
    business_years: int | None = None
    land_owned_acres: float | None = None
    is_marginal_farmer: bool = False
    has_savings_account: bool = False
    has_kisan_credit_card: bool = False
    student_degree: str = ""
    cibil_score: int | None = None
    pension_age_reached: bool = False
    has_lpg_connection: bool = False
    has_ration_card: bool = False
    has_house: bool = False
    is_widow: bool = False
    village_panchayat: str = ""
    aadhaar_linked: bool = False


# ---------- Family ----------
class FamilyIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    relationship: str = Field(min_length=2, max_length=30)
    age: int | None = None
    gender: str = ""
    occupation: str = ""
    annual_income: float | None = None
    education: str = ""
    disability: str = ""
    is_student: bool = False


# ---------- Questionnaire ----------
class AnswerIn(BaseModel):
    key: str
    value: Any


class StartOut(BaseModel):
    session: dict
    question: dict


# ---------- Schemes ----------
class SchemeIn(BaseModel):
    code: str
    name: str
    short_name: str = ""
    ministry: str = ""
    department: str = ""
    level: str = "central"
    category: str = ""
    description: str = ""
    benefits: list = []
    eligibility_rules: list = []
    required_documents: list = []
    amount: str = ""
    amount_max: float | None = None
    duration: str = ""
    application_time: str = ""
    renewal_policy: str = ""
    official_link: str = ""
    application_portal: str = ""
    target_audience: str = ""
    state_specific: str = "all"
    tags: list = []
    keywords: str = ""
    is_active: bool = True


class CompareIn(BaseModel):
    scheme_ids: list[str] = Field(min_length=1, max_length=5)


# ---------- Documents ----------
class AnalyzeOut(BaseModel):
    report: dict


# ---------- Applications ----------
class ApplyIn(BaseModel):
    scheme_id: str
    family_member_id: str | None = None
    applicant_name: str | None = None


class StatusIn(BaseModel):
    status: str
    note: str = ""


# ---------- News ----------
class NewsIn(BaseModel):
    title: str
    summary: str = ""
    category: str = "new_scheme"
    level: str = "central"
    state: str = "all"
    source: str = ""
    link: str = ""
    is_new: bool = True
    is_trending: bool = False


# ---------- Admin ----------
class KnowledgeIn(BaseModel):
    title: str
    content: str = ""
    source: str = ""
    category: str = "policy"
    level: str = "central"
    state: str = "all"


class BroadcastIn(BaseModel):
    title: str
    body: str
    type: str = "announcement"
    link: str = ""
    priority: str = "normal"


class FeedbackResolveIn(BaseModel):
    status: str = "resolved"


# ---------- Admin Ops ----------
class RoleUpdateIn(BaseModel):
    admin_role: str


class UserRoleIn(BaseModel):
    role: str  # citizen|admin
    admin_role: str | None = None


class ApplicationAssignIn(BaseModel):
    assigned_admin_id: str | None = None


class ApplicationPriorityIn(BaseModel):
    priority: str = Field(pattern="^(low|normal|high|critical)$")


class ApplicationNoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class RequestDocsIn(BaseModel):
    documents: list[str] = Field(min_length=1)
    note: str = ""


class ApplicationDecisionIn(BaseModel):
    decision: str = Field(pattern="^(approve|reject)$")
    reason: str = Field(min_length=1, max_length=2000)


class DocumentReviewIn(BaseModel):
    decision: str = Field(pattern="^(verified|rejected|reupload_requested|escalated)$")
    note: str = ""


class SupportCaseIn(BaseModel):
    user_id: str = ""
    subject: str = Field(min_length=3, max_length=200)
    description: str = ""
    issue_type: str = "other"
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")


class SupportCaseAssignIn(BaseModel):
    assigned_to: str | None = None


class SupportCaseUpdateIn(BaseModel):
    status: str = Field(pattern="^(assigned|in_progress|waiting_for_user|escalated|resolved|closed|open)$")
    note: str = ""
    priority: str | None = Field(default=None, pattern="^(low|medium|high|critical)$")


class CaseReplyIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class SchemeEditIn(BaseModel):
    name: str | None = None
    short_name: str | None = None
    ministry: str | None = None
    department: str | None = None
    level: str | None = None
    category: str | None = None
    description: str | None = None
    benefits: list | None = None
    eligibility_rules: list | None = None
    required_documents: list | None = None
    amount: str | None = None
    amount_max: float | None = None
    duration: str | None = None
    application_time: str | None = None
    renewal_policy: str | None = None
    official_link: str | None = None
    application_portal: str | None = None
    target_audience: str | None = None
    state_specific: str | None = None
    tags: list | None = None
    is_active: bool | None = None
    reason: str = ""


class AgentControlIn(BaseModel):
    reason: str = ""


class ArchiveIn(BaseModel):
    reason: str = ""


class IncidentAssignIn(BaseModel):
    assigned_to: str | None = None


# ---------- Misc ----------
class ChatIn(BaseModel):
    message: str
    conversation_id: str | None = None
    context: dict | None = None


class VoiceCommandIn(BaseModel):
    text: str
    language: str = "en"


class FeedbackIn(BaseModel):
    subject: str = ""
    message: str
    rating: int | None = Field(default=None, ge=1, le=5)
