"""Database seeder - idempotent, populates schemes, offices, news, admin,
demo user, knowledge docs and the RAG index."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.models import (
    AgentRun,
    GovernmentOffice,
    KnowledgeDoc,
    NewsItem,
    Notification,
    Profile,
    Scheme,
    User,
)
from app.rag.vector_store import RAGStore
from app.seed.schemes_data import SCHEMES

OFFICES = [
    {"name": "CSC - Collector Office Complex", "type": "CSC", "address": "Collectorate, Near Indira Gandhi Municipal Stadium",
     "state": "Andhra Pradesh", "district": "Visakhapatnam", "lat": 17.7331, "lng": 83.2813,
     "phone": "+91 891 256 4200", "email": "csc-vizag@ap.gov.in",
     "working_hours": {"open": "09:00", "close": "17:00", "days": "Mon-Sat"},
     "services": ["Aadhaar enrolment", "Scheme applications", "Income certificate"],
     "rating": 4.3},
    {"name": "AP Online / MeeSeva Kiosk - MVP Colony", "type": "MeeSeva", "address": "7-1-29, MVP Colony Main Road",
     "state": "Andhra Pradesh", "district": "Visakhapatnam", "lat": 17.7306, "lng": 83.3236,
     "phone": "+91 891 271 8000", "email": "meeseva-mvp@ap.gov.in",
     "working_hours": {"open": "09:30", "close": "17:30", "days": "Mon-Sat"},
     "services": ["E-district services", "Caste certificate", "Income certificate"],
     "rating": 4.1},
    {"name": "Lead District Bank Office", "type": "Bank", "address": "NABARD Building, Daba Gardens",
     "state": "Andhra Pradesh", "district": "Visakhapatnam", "lat": 17.7146, "lng": 83.3044,
     "phone": "+91 891 253 5201", "email": "nabard-vizag@nabard.org",
     "working_hours": {"open": "10:00", "close": "16:00", "days": "Mon-Fri"},
     "services": ["Kisan Credit Card", "Mudra loans", "PMJJBY/PMSBY"],
     "rating": 4.0},
    {"name": "AP Agros - PM Kisan Helpdesk", "type": "CSC", "address": "Agricultural Market Yard, Gajuwaka",
     "state": "Andhra Pradesh", "district": "Visakhapatnam", "lat": 17.7001, "lng": 83.2200,
     "phone": "+91 891 258 1122", "email": "agros-gajuwaka@ap.gov.in",
     "working_hours": {"open": "09:00", "close": "17:00", "days": "Mon-Sat"},
     "services": ["PM-KISAN registration", "Crop insurance", "Rythu Bharosa"],
     "rating": 4.2},
    {"name": "Post Office - Head Office", "type": "PostOffice", "address": "Head Post Office, Town Hall Road",
     "state": "Andhra Pradesh", "district": "Visakhapatnam", "lat": 17.7024, "lng": 83.3008,
     "phone": "+91 891 256 6271", "email": "vizag.hpo@indiapost.gov.in",
     "working_hours": {"open": "09:30", "close": "17:30", "days": "Mon-Sat"},
     "services": ["Sukanya Samriddhi", "APY", "Post office savings"],
     "rating": 4.4},
    {"name": "MeeSeva - Gajuwaka RTC Complex", "type": "MeeSeva", "address": "RTC Complex, Gajuwaka",
     "state": "Andhra Pradesh", "district": "Visakhapatnam", "lat": 17.6932, "lng": 83.2146,
     "phone": "+91 891 275 3111", "email": "meeseva-gjk@ap.gov.in",
     "working_hours": {"open": "09:30", "close": "17:30", "days": "Mon-Sat"},
     "services": ["Land records", "Cast certificate", "E-services"],
     "rating": 3.9},
]

NEWS = [
    {"title": "PM-KISAN 18th instalment released - ₹20,000 crore disbursed",
     "summary": "The 18th instalment of PM-KISAN has been released to 9.5 crore farmers. Check your status on the portal.",
     "ai_summary": "Farmers receive another ₹2,000 instalment. Beneficiaries should verify land records before the next disbursal window.",
     "category": "new_scheme", "level": "central", "state": "all", "source": "PIB", "link": "https://pmkisan.gov.in/",
     "is_new": True, "is_trending": True},
    {"title": "Union Budget 2026: Agriculture credit target raised to ₹25 lakh crore",
     "summary": "The budget enhances farm credit and expands KCC coverage for tenant farmers.",
     "ai_summary": "Higher credit availability for farmers. Tenant farmers may now access KCC - new eligibility norms.",
     "category": "budget", "level": "central", "state": "all", "source": "Budget Division", "link": "#", "is_new": True, "is_trending": False},
    {"title": "AP Rythu Bharosa: Beneficiary list update window opens",
     "summary": "Farmers can now update land records for the 2026-27 Rythu Bharosa disbursal.",
     "ai_summary": "AP farmers must correct Pahani/Adangal records by next month to receive the annual support.",
     "category": "deadline", "level": "state", "state": "Andhra Pradesh", "source": "AP Govt", "link": "https://www.rythubharosa.ap.gov.in/",
     "is_new": True, "is_trending": True},
    {"title": "PM Mudra Yojana: Interest subvention extended for new women borrowers",
     "summary": "First-time women borrowers get an additional 0.5% interest concession.",
     "ai_summary": "Women entrepreneurs get cheaper Mudra loans. Apply via any PSB or the Mudra portal.",
     "category": "rule_change", "level": "central", "state": "all", "source": "MoF", "link": "https://www.mudra.org.in/", "is_new": False, "is_trending": False},
    {"title": "Ayushman Bharat: 3 new hospitalisation packages added",
     "summary": "1,900+ packages now cover newer surgical procedures at empanelled hospitals.",
     "ai_summary": "PM-JAY coverage expands. Existing beneficiaries are automatically covered.",
     "category": "rule_change", "level": "central", "state": "all", "source": "NHA", "link": "https://pmjay.gov.in/", "is_new": False, "is_trending": False},
    {"title": "Sukanya Samriddhi interest rate hiked to 8.2%",
     "summary": "The girl-child savings scheme rate is revised for the current quarter.",
     "ai_summary": "Higher returns for existing and new SSY accounts. Open before the girl's 10th birthday.",
     "category": "budget", "level": "central", "state": "all", "source": "Finance Ministry", "link": "https://www.indiapost.gov.in/", "is_new": True, "is_trending": False},
    {"title": "PM-KUSUM solar pump applications open for AP farmers",
     "summary": "Andhra Pradesh invites fresh applications for the Component-B solar pump subsidy.",
     "ai_summary": "Farmers with 1+ acres can claim up to 60% subsidy on solar pumps in the current cycle.",
     "category": "deadline", "level": "state", "state": "Andhra Pradesh", "source": "AP Energy", "link": "https://pmkusum.mnre.gov.in/", "is_new": True, "is_trending": False},
    {"title": "PM Vishwakarma: 6 lakh artisans onboarded nationwide",
     "summary": "Carpenters, tailors, potters and other artisans continue to receive training vouchers and loans.",
     "ai_summary": "Artisans can still enrol through their local CSC or the official portal.",
     "category": "new_scheme", "level": "central", "state": "all", "source": "MSME", "link": "https://pmvishwakarma.gov.in/", "is_new": False, "is_trending": False},
]

KNOWLEDGE_DOCS = [
    {"title": "PM-KISAN Operational Guidelines 2026", "content":
     "PM-KISAN provides income support of ₹6,000 per year in three instalments to land-holding farmer families. "
     "Eligibility: farmer families owning cultivable land. Exclusions: income tax payers, government employees, pensioners earning over ₹10,000/month, professionals. "
     "Documents: Aadhaar, land records, bank passbook. Beneficiaries receive DBT directly. Applications are made through the PM-KISAN portal or state agriculture departments.",
     "category": "policy", "level": "central", "state": "all", "source": "Department of Agriculture"},
    {"title": "PM Fasal Bima Yojana - Crop Insurance Rules", "content":
     "PMFBY insures farmers against crop loss from natural calamities, pests and diseases. "
     "Farmers pay premium of 2% for kharif food crops, 1.5% for rabi, and 5% for commercial crops. "
     "Claims are settled within 2 months. Enrollment happens before each crop season. Tenant farmers and sharecroppers are eligible with land owner consent.",
     "category": "policy", "level": "central", "state": "all", "source": "Department of Agriculture"},
    {"title": "Pradhan Mantri Mudra Yojana Lending Norms", "content":
     "Mudra provides collateral-free loans up to ₹10 lakh under three categories: Shishu (up to ₹50,000), "
     "Kishor (₹50,001-₹5,00,000), Tarun (₹5,00,001-₹10,00,000). "
     "Any Indian citizen aged 18+ running or starting a non-farm income generating activity can apply through banks and MFIs.",
     "category": "policy", "level": "central", "state": "all", "source": "Ministry of Finance"},
    {"title": "Ayushman Bharat PM-JAY Benefit Packages", "content":
     "PM-JAY provides ₹5 lakh health cover per family per year to around 12 crore poor families. "
     "It covers 1,900+ packages including surgeries, diagnostics and medicines at empanelled public and private hospitals. "
     "Beneficiaries are identified through the SECC 2011 database and state health agencies.",
     "category": "policy", "level": "central", "state": "all", "source": "NHA"},
    {"title": "Rythu Bharosa - Andhra Pradesh Guidelines", "content":
     "Rythu Bharosa provides ₹13,500 per year to AP farmer families, including the PM-KISAN component. "
     "Eligibility: farmer families owning land in Andhra Pradesh, income below ₹3 lakh. "
     "Applications through the Rythu Bharosa portal; land records verified against the Adangal/Pahani system.",
     "category": "policy", "level": "state", "state": "Andhra Pradesh", "source": "AP Agriculture"},
    {"title": "Sukanya Samriddhi Yojana Guidelines", "content":
     "SSY is a small savings scheme for the girl child. Deposit ₹250-₹1.5 lakh per year with interest at 8.2% p.a. "
     "Open an account for a girl child under 10 at post offices and scheduled banks. "
     "Account matures 21 years after opening or on marriage after 18. Premature withdrawal allowed for education and marriage.",
     "category": "policy", "level": "central", "state": "all", "source": "Ministry of Finance"},
    {"title": "PM-SYM Pension for Unorganised Workers", "content":
     "PM Shram Yogi Maan-dhan gives ₹3,000 monthly pension after 60 to unorganised workers aged 18-40. "
     "Premium ranges from ₹55 to ₹200 per month. Enrolment through Common Service Centres and the maandhan.in portal. "
     "Spouse can also join. Benefits transfer through DBT.",
     "category": "policy", "level": "central", "state": "all", "source": "Ministry of Labour"},
    {"title": "Startup India Seed Fund Scheme", "content":
     "SISF provides up to ₹20 lakh to idea-stage startups through DPIIT-recognised incubators. "
     "Criteria: startup registered under Companies Act, turnover under ₹50 lakh, incorporated within last 10 years. "
     "Selected startups receive grants for validation, market entry and scaling.",
     "category": "policy", "level": "central", "state": "all", "source": "DPIIT"},
]


def seed_all(db: Session) -> dict:
    counts = {"schemes": 0, "offices": 0, "news": 0, "users": 0, "knowledge": 0}
    existing = {s.code for s in db.query(Scheme).all()}
    for data in SCHEMES:
        if data["code"] in existing:
            continue
        db.add(Scheme(**data))
        counts["schemes"] += 1

    for o in OFFICES:
        if db.query(GovernmentOffice).filter_by(name=o["name"]).first():
            continue
        db.add(GovernmentOffice(**o))
        counts["offices"] += 1

    for n in NEWS:
        if db.query(NewsItem).filter_by(title=n["title"]).first():
            continue
        db.add(NewsItem(**n))
        counts["news"] += 1

    for k in KNOWLEDGE_DOCS:
        if db.query(KnowledgeDoc).filter_by(title=k["title"]).first():
            continue
        db.add(KnowledgeDoc(**k))
        counts["knowledge"] += 1

    # Admin + demo citizen
    if not db.query(User).filter_by(email="admin@schemeai.in").first():
        from app.core.security import generate_citizen_id
        admin = User(email="admin@schemeai.in", full_name="SchemeAI Admin",
                     role="admin", admin_role="super_admin",
                     citizen_id=generate_citizen_id(db),
                     password_hash=hash_password("Admin@123"),
                     secondary_password_hash=hash_password("7788"),
                     is_verified=True)
        db.add(admin)
        counts["users"] += 1
    demo_admin = db.query(User).filter_by(email="admin@schemeai.in").first()
    if demo_admin:
        if demo_admin.admin_role != "super_admin" and db.query(User).filter_by(role="admin", admin_role="super_admin").count() == 0:
            demo_admin.admin_role = "super_admin"
        if not demo_admin.secondary_password_hash:
            demo_admin.secondary_password_hash = hash_password("123456")

    # One test admin per role (used by the role-based authorization test suite).
    # Passwords: "<RoleName>@123" e.g. superadmin@schemeai.in / SuperAdmin@123
    role_test_accounts = [
        ("superadmin@schemeai.in", "SuperAdmin@123", "Test Super Admin", "super_admin"),
        ("operations@schemeai.in", "Operations@123", "Test Operations Admin", "operations_admin"),
        ("scheme@schemeai.in", "SchemeAdmin@123", "Test Scheme Admin", "scheme_admin"),
        ("reviewer@schemeai.in", "Reviewer@123", "Test Content Reviewer", "content_reviewer"),
        ("support@schemeai.in", "Support@123", "Test Support Agent", "support_agent"),
        ("aiops@schemeai.in", "AiOps@123", "Test AI Operations", "ai_operations"),
        ("analyst@schemeai.in", "Analyst@123", "Test Analyst", "analyst"),
    ]
    # Migrate any accounts previously seeded under the reserved .test.local TLD
    # (rejected by EmailStr) to their new @schemeai.in addresses.
    legacy = {email.split("@")[0] + "@schemeai.in": email for email, *_ in role_test_accounts}
    for old_email, new_email in legacy.items():
        old = db.query(User).filter_by(email=old_email).first()
        if old and not db.query(User).filter_by(email=new_email).first():
            old.email = new_email
    for email, password, name, role in role_test_accounts:
        u = db.query(User).filter_by(email=email).first()
        if not u:
            from app.core.security import generate_citizen_id
            u = User(email=email, full_name=name, role="admin", admin_role=role,
                     citizen_id=generate_citizen_id(db),
                     password_hash=hash_password(password),
                     secondary_password_hash=hash_password("123456"),
                     is_verified=True)
            db.add(u)
            db.flush()
            db.add(Profile(user_id=u.id))
            counts["users"] += 1
        else:
            if u.admin_role != role:
                u.admin_role = role
            if not u.secondary_password_hash:
                u.secondary_password_hash = hash_password("123456")

    if not db.query(User).filter_by(email="demo@schemeai.in").first():
        from app.core.security import generate_citizen_id
        demo = User(email="demo@schemeai.in", full_name="Ravi Kumar",
                    phone="9876543210", citizen_id=generate_citizen_id(db),
                    password_hash=hash_password("Demo@123"), is_verified=True)
        db.add(demo)
        db.flush()
        db.add(Profile(user_id=demo.id, age=29, gender="male", state="Andhra Pradesh",
                       district="Visakhapatnam", occupation="farmer", annual_income=280000,
                       education="hs", category="obc", disability="none", marital_status="married",
                       employment_type="unorganised", land_owned_acres=3.5, is_marginal_farmer=True,
                       has_savings_account=True, has_kisan_credit_card=False, aadhaar_linked=True))
        db.add(Notification(user_id=demo.id, type="deadline", title="PM-KUSUM application window",
                            body="Solar pump subsidy applications close this month for AP farmers.",
                            link="/schemes/PM-KUSUM", priority="high"))
        counts["users"] += 1

    db.commit()

    # Build RAG index from knowledge docs
    store = RAGStore()
    docs = []
    for k in db.query(KnowledgeDoc).filter_by(is_indexed=False).all():
        docs.append((k.content, {"title": k.title, "source": k.source, "category": k.category,
                                 "level": k.level, "state": k.state}))
    if docs:
        n_chunks = store.add_documents(docs)
        for k in db.query(KnowledgeDoc).filter_by(is_indexed=False).all():
            k.is_indexed = True
            k.chunk_count = 1
        db.commit()
        counts["knowledge"] = n_chunks

    return counts


def seed_demo_activity(db: Session, user: User) -> None:
    """Seed a few agent-run timeline rows so the UI has history."""
    if db.query(AgentRun).filter_by(user_id=user.id).count():
        return
    now = datetime.now(timezone.utc)
    for i, (agent, task, ms) in enumerate([
        ("Profiling Agent", "Validated structured citizen profile", 4),
        ("Eligibility Agent", "Scored 24 schemes against your profile", 9),
        ("Policy Agent", "Retrieved policy context from knowledge base", 22),
        ("Recommender Agent", "Ranked personalized recommendations", 6),
        ("Explainability Agent", "Generated plain-language explanation", 5),
    ]):
        db.add(AgentRun(run_id=f"demo{i}", user_id=user.id, agent_name=agent, task=task,
                        status="completed", duration_ms=ms,
                        created_at=now - timedelta(minutes=30 - i * 6)))
    db.commit()
