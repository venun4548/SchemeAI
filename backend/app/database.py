from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

if settings.DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---- Lightweight additive migrations for existing deployments ----
# create_all() adds new tables but never adds columns to existing tables.
# These ALTER TABLE statements add the enterprise-operations columns when
# they are missing. Safe to run on every startup; no-op once applied.
_NEW_COLUMNS = {
    "users": [
        ("admin_role", "VARCHAR(30) DEFAULT 'operations_admin' NOT NULL"),
        ("last_login_at", "DATETIME"),
        ("secondary_password_hash", "VARCHAR(255)"),
    ],
    "schemes": [
        ("lifecycle_status", "VARCHAR(20) DEFAULT 'published' NOT NULL"),
        ("version", "INTEGER DEFAULT 1 NOT NULL"),
    ],
    "applications": [
        ("priority", "VARCHAR(10) DEFAULT 'normal' NOT NULL"),
        ("assigned_admin_id", "VARCHAR(32)"),
        ("review_status", "VARCHAR(20) DEFAULT 'new' NOT NULL"),
        ("internal_notes", "JSON"),
        ("requested_documents", "JSON"),
    ],
    "documents": [
        ("review_status", "VARCHAR(20) DEFAULT 'unreviewed' NOT NULL"),
        ("reviewed_by", "VARCHAR(32)"),
        ("review_note", "TEXT DEFAULT '' NOT NULL"),
    ],
    "knowledge_docs": [
        ("review_status", "VARCHAR(20) DEFAULT 'unreviewed' NOT NULL"),
        ("approved_by", "VARCHAR(32)"),
    ],
}


def init_db():
    from app.models import models  # noqa: F401  ensure models are registered

    Base.metadata.create_all(bind=engine)

    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    with engine.begin() as conn:
        for table, cols in _NEW_COLUMNS.items():
            existing = {
                row[1]
                for row in conn.execute(text(f'PRAGMA table_info("{table}")' if is_sqlite else f'SELECT column_name FROM information_schema.columns WHERE table_name = \'{table}\''))
                if row
            }
            for name, ddl in cols:
                if name not in existing:
                    conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {name} {ddl}'))

        # Backfill citizen_id for existing users if missing
        from app.core.security import generate_citizen_id
        from app.models.models import User
        SessionLocal = sessionmaker(bind=engine)
        with SessionLocal() as session:
            # Backfill citizen_id for users where it's missing or incorrectly formatted (e.g., just the UUID)
            users_without_id = session.query(User).filter(
                (User.citizen_id.is_(None)) | 
                (User.citizen_id.not_like('SCAI-CIT-%'))
            ).all()
            for u in users_without_id:
                u.citizen_id = generate_citizen_id(session)
            if users_without_id:
                session.commit()
