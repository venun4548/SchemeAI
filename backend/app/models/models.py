import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def gen_id() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20), default="citizen")  # citizen | admin
    admin_role: Mapped[str] = mapped_column(String(30), default="operations_admin")
    language: Mapped[str] = mapped_column(String(8), default="en")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    profile: Mapped["Profile"] = orm_relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    family = orm_relationship("FamilyMember", back_populates="user", cascade="all, delete-orphan")
    documents = orm_relationship("UserDocument", back_populates="user", cascade="all, delete-orphan")
    applications = orm_relationship("Application", back_populates="user", cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str] = mapped_column(String(16), default="")  # male|female|other
    state: Mapped[str] = mapped_column(String(60), default="")
    district: Mapped[str] = mapped_column(String(60), default="")
    occupation: Mapped[str] = mapped_column(String(60), default="")  # farmer|student|employee|self-employed|unemployed|retired|housewife|other
    industry: Mapped[str] = mapped_column(String(80), default="")
    annual_income: Mapped[float | None] = mapped_column(Float, nullable=True)  # INR
    education: Mapped[str] = mapped_column(String(40), default="")  # none|primary|secondary|hs|graduate|postgraduate|diploma|other
    category: Mapped[str] = mapped_column(String(16), default="")  # general|sc|st|obc|ews|minority
    disability: Mapped[str] = mapped_column(String(40), default="")  # none|physical|visual|hearing|speech|intellectual
    marital_status: Mapped[str] = mapped_column(String(16), default="")
    has_children: Mapped[bool] = mapped_column(Boolean, default=False)
    children_girl: Mapped[bool] = mapped_column(Boolean, default=False)
    employment_type: Mapped[str] = mapped_column(String(32), default="")  # organised|unorganised|self-employed|none
    is_entrepreneur: Mapped[bool] = mapped_column(Boolean, default=False)
    business_type: Mapped[str] = mapped_column(String(60), default="")
    business_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    land_owned_acres: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_marginal_farmer: Mapped[bool] = mapped_column(Boolean, default=False)
    has_savings_account: Mapped[bool] = mapped_column(Boolean, default=False)
    has_kisan_credit_card: Mapped[bool] = mapped_column(Boolean, default=False)
    gender_of_children: Mapped[str] = mapped_column(String(16), default="")
    student_degree: Mapped[str] = mapped_column(String(40), default="")
    cibil_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pension_age_reached: Mapped[bool] = mapped_column(Boolean, default=False)
    has_lpg_connection: Mapped[bool] = mapped_column(Boolean, default=False)
    has_ration_card: Mapped[bool] = mapped_column(Boolean, default=False)
    has_house: Mapped[bool] = mapped_column(Boolean, default=False)
    is_widow: Mapped[bool] = mapped_column(Boolean, default=False)
    village_panchayat: Mapped[str] = mapped_column(String(80), default="")
    aadhaar_linked: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = orm_relationship(back_populates="profile")


class FamilyMember(Base):
    __tablename__ = "family_members"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_family_user_name"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    relationship: Mapped[str] = mapped_column(String(30))  # father|mother|spouse|son|daughter|grandparent|other
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str] = mapped_column(String(16), default="")
    occupation: Mapped[str] = mapped_column(String(60), default="")
    annual_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    education: Mapped[str] = mapped_column(String(40), default="")
    disability: Mapped[str] = mapped_column(String(40), default="")
    is_student: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = orm_relationship(back_populates="family")


class Scheme(Base):
    __tablename__ = "schemes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    short_name: Mapped[str] = mapped_column(String(40), default="")
    ministry: Mapped[str] = mapped_column(String(120), default="")
    department: Mapped[str] = mapped_column(String(120), default="")
    level: Mapped[str] = mapped_column(String(20), default="central")  # central|state|district
    category: Mapped[str] = mapped_column(String(40), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    benefits: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)  # [{label, detail, value}]
    eligibility_rules: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)  # [{field, op, value, weight, label}]
    required_documents: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)  # [document keys]
    amount: Mapped[str] = mapped_column(String(80), default="")
    amount_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration: Mapped[str] = mapped_column(String(80), default="")
    application_time: Mapped[str] = mapped_column(String(40), default="")
    renewal_policy: Mapped[str] = mapped_column(Text, default="")
    official_link: Mapped[str] = mapped_column(String(255), default="")
    application_portal: Mapped[str] = mapped_column(String(255), default="")
    target_audience: Mapped[str] = mapped_column(String(120), default="")
    state_specific: Mapped[str] = mapped_column(String(60), default="all")  # all or state name
    tags: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    keywords: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_trending: Mapped[bool] = mapped_column(Boolean, default=False)
    lifecycle_status: Mapped[str] = mapped_column(String(20), default="published")  # draft|review|verified|published|update_required|archived
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class SavedScheme(Base):
    __tablename__ = "saved_schemes"
    __table_args__ = (UniqueConstraint("user_id", "scheme_id", name="uq_saved"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    scheme_id: Mapped[str] = mapped_column(ForeignKey("schemes.id"))
    saved_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class UserDocument(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    family_member_id: Mapped[str | None] = mapped_column(ForeignKey("family_members.id"), nullable=True)
    doc_type: Mapped[str] = mapped_column(String(40), default="other")
    display_name: Mapped[str] = mapped_column(String(120), default="")
    file_name: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(400))
    file_hash: Mapped[str] = mapped_column(String(64), index=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    mime_type: Mapped[str] = mapped_column(String(80), default="")
    ocr_text: Mapped[str] = mapped_column(Text, default="")
    extracted_fields: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|analyzed|verified|rejected
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    expiry_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_blurry: Mapped[bool] = mapped_column(Boolean, default=False)
    is_duplicate: Mapped[bool] = mapped_column(Boolean, default=False)
    fake_risk: Mapped[float] = mapped_column(Float, default=0.0)
    analyzer_report: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    review_status: Mapped[str] = mapped_column(String(20), default="unreviewed")  # unreviewed|verified|rejected|reupload_requested|escalated
    reviewed_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    review_note: Mapped[str] = mapped_column(Text, default="")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = orm_relationship(back_populates="documents")


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    application_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    family_member_id: Mapped[str | None] = mapped_column(ForeignKey("family_members.id"), nullable=True)
    scheme_id: Mapped[str] = mapped_column(ForeignKey("schemes.id"))
    status: Mapped[str] = mapped_column(String(30), default="draft")  # draft|in_progress|submitted|under_review|approved|rejected|disbursed
    applicant_name: Mapped[str] = mapped_column(String(120), default="")
    priority: Mapped[str] = mapped_column(String(10), default="normal")  # low|normal|high|critical
    assigned_admin_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    review_status: Mapped[str] = mapped_column(String(20), default="new")  # new|needs_review|documents_required|under_review|decision
    internal_notes: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)  # [{ts, admin, note}]
    requested_documents: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    steps: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    timeline: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)  # [{ts, status, note}]
    qr_payload: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    document_ids: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    risk_flags: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    eligibility_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = orm_relationship(back_populates="applications")


class QuestionnaireSession(Base):
    __tablename__ = "questionnaire_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    answers: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    visited: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class NewsItem(Base):
    __tablename__ = "news_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    title: Mapped[str] = mapped_column(String(300))
    summary: Mapped[str] = mapped_column(Text, default="")
    ai_summary: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40), index=True)  # new_scheme|rule_change|deadline|budget|trending
    level: Mapped[str] = mapped_column(String(20), default="central")
    state: Mapped[str] = mapped_column(String(60), default="all")
    source: Mapped[str] = mapped_column(String(120), default="")
    link: Mapped[str] = mapped_column(String(255), default="")
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    is_trending: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class NewsBookmark(Base):
    __tablename__ = "news_bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "news_id", name="uq_news_bm"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    news_id: Mapped[str] = mapped_column(ForeignKey("news_items.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(30))  # deadline|new_scheme|application|document|recommendation|announcement|expiry
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str] = mapped_column(String(255), default="")
    priority: Mapped[str] = mapped_column(String(10), default="normal")  # low|normal|high
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class GovernmentOffice(Base):
    __tablename__ = "offices"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(60))  # CSC|MeeSeva|APSEC|Bank|PostOffice|Revenue
    address: Mapped[str] = mapped_column(Text, default="")
    state: Mapped[str] = mapped_column(String(60))
    district: Mapped[str] = mapped_column(String(60))
    lat: Mapped[float] = mapped_column(Float, default=0.0)
    lng: Mapped[float] = mapped_column(Float, default=0.0)
    phone: Mapped[str] = mapped_column(String(30), default="")
    email: Mapped[str] = mapped_column(String(120), default="")
    working_hours: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    services: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    subject: Mapped[str] = mapped_column(String(200), default="")
    message: Mapped[str] = mapped_column(Text)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|resolved
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_docs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    title: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(160), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(40), default="policy")
    level: Mapped[str] = mapped_column(String(20), default="central")
    state: Mapped[str] = mapped_column(String(60), default="all")
    chunks: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    is_indexed: Mapped[bool] = mapped_column(Boolean, default=False)
    review_status: Mapped[str] = mapped_column(String(20), default="unreviewed")  # unreviewed|review|approved|failed
    approved_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(32), default="", index=True)
    event_type: Mapped[str] = mapped_column(String(40), index=True)  # view_scheme|apply|search|recommendation_click|signup
    scheme_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    state: Mapped[str] = mapped_column(String(60), default="")
    event_meta: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    run_id: Mapped[str] = mapped_column(String(32), index=True)
    user_id: Mapped[str] = mapped_column(String(32), default="", index=True)
    agent_name: Mapped[str] = mapped_column(String(60))
    task: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(20), default="completed")
    result: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Comparison(Base):
    __tablename__ = "comparisons"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    user_id: Mapped[str] = mapped_column(String(32), default="")
    scheme_ids: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    ai_analysis: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    actor_id: Mapped[str] = mapped_column(String(32), default="")
    actor_name: Mapped[str] = mapped_column(String(120), default="")
    actor_role: Mapped[str] = mapped_column(String(30), default="")
    action: Mapped[str] = mapped_column(String(60), index=True)
    entity: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[str] = mapped_column(String(32), index=True)
    entity_name: Mapped[str] = mapped_column(String(200), default="")
    old_value: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    new_value: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    reason: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str] = mapped_column(String(20), default="success")  # success|failure
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    email: Mapped[str] = mapped_column(String(255), index=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    ip: Mapped[str] = mapped_column(String(64), default="")
    user_agent: Mapped[str] = mapped_column(String(255), default="")
    reason: Mapped[str] = mapped_column(String(60), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class SupportCase(Base):
    __tablename__ = "support_cases"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    case_ref: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    subject: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    issue_type: Mapped[str] = mapped_column(String(40), default="other")  # login|otp|eligibility|application_stuck|document|scheme_info|ai_recommendation|technical|complaint|other
    priority: Mapped[str] = mapped_column(String(10), default="medium")  # low|medium|high|critical
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|assigned|in_progress|waiting_for_user|escalated|resolved|closed
    assigned_to: Mapped[str | None] = mapped_column(String(32), nullable=True)
    escalated_from: Mapped[str | None] = mapped_column(String(32), nullable=True)
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    timeline: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)  # [{ts,status,by,note}]
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class AIIncident(Base):
    __tablename__ = "ai_incidents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    agent_name: Mapped[str] = mapped_column(String(60), index=True)
    severity: Mapped[str] = mapped_column(String(10), default="medium")  # low|medium|high|critical
    status: Mapped[str] = mapped_column(String(20), default="open")  # open|paused|resolved
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_error: Mapped[str] = mapped_column(Text, default="")
    last_error_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timeline: Mapped[list] = mapped_column(MutableList.as_mutable(JSON), default=list)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AgentStatus(Base):
    __tablename__ = "agent_status"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    agent_name: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[str] = mapped_column(String(30), default="idle")  # idle|running|failed|paused|success
    paused_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    paused_reason: Mapped[str] = mapped_column(Text, default="")
    updated_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class SchemeVersion(Base):
    __tablename__ = "scheme_versions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=gen_id)
    scheme_id: Mapped[str] = mapped_column(ForeignKey("schemes.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft|review|verified|published|archived
    changed_fields: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)  # {field: {old, new}}
    eligibility_diff: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    benefits_diff: Mapped[dict] = mapped_column(MutableDict.as_mutable(JSON), default=dict)
    submitted_by: Mapped[str] = mapped_column(String(32), default="")
    approved_by: Mapped[str] = mapped_column(String(32), default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
