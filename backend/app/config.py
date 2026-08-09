import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    APP_NAME: str = "SchemeAI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database - defaults to SQLite for zero-config demos. Set DATABASE_URL to
    # a PostgreSQL DSN (e.g. postgresql+psycopg://user:pass@host/db) in prod.
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'schemeai.db'}"

    JWT_SECRET: str = "schemeai-dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # File storage
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    REPORT_DIR: Path = BASE_DIR / "reports"

    # RAG / embeddings
    RAG_BACKEND: str = "auto"  # auto | chroma | faiss | sqlite
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 384
    COLLECTION_NAME: str = "scheme_policy"

    # Optional LLM (OpenAI-compatible). Leave empty for fully offline rule engine.
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"

    # Voice
    DEFAULT_LANGUAGE: str = "hi"
    SUPPORTED_LANGUAGES: list[str] = [
        "en", "hi", "te", "ta", "kn", "mr", "bn", "gu"
    ]

    # Email (optional - disabled if empty)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "SchemeAI <noreply@schemeai.local>"

    # Google Sheets sync bridge (optional). When set to a deployed Apps Script
    # web-app URL (…/exec), every key write is mirrored to the sheet via its
    # public "syncRecord" action. Empty = sync disabled.
    GAS_WEBAPP_URL: str = ""

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://scheme-ai-nine.vercel.app",
    ]

    class Config:
        env_file = str(BASE_DIR / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

for _d in (settings.UPLOAD_DIR, settings.REPORT_DIR):
    _d.mkdir(parents=True, exist_ok=True)
