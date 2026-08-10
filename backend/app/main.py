from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin,
    applications,
    auth,
    chat,
    dashboard,
    documents,
    eligibility,
    investigator,
    news,
    notifications,
    offices,
    ops,
    profile,
    public,
    questionnaire,
    reports,
    schemes,
    support,
    voice,
)
from app.config import settings
from app.database import SessionLocal, init_db


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Multi-Agent AI Government Scheme Recommendation & Application Assistant",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup():
        init_db()
        from app.seed.seeder import seed_all

        with SessionLocal() as db:
            seed_all(db)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}

    prefix = "/api"
    app.include_router(auth.router, prefix=prefix)
    app.include_router(profile.router, prefix=prefix)
    app.include_router(questionnaire.router, prefix=prefix)
    app.include_router(schemes.router, prefix=prefix)
    app.include_router(eligibility.router, prefix=prefix)
    app.include_router(investigator.router, prefix=prefix)
    app.include_router(documents.router, prefix=prefix)
    app.include_router(applications.router, prefix=prefix)
    app.include_router(offices.router, prefix=prefix)
    app.include_router(news.router, prefix=prefix)
    app.include_router(notifications.router, prefix=prefix)
    app.include_router(reports.router, prefix=prefix)
    app.include_router(voice.router, prefix=prefix)
    app.include_router(chat.router, prefix=prefix)
    app.include_router(support.router, prefix=prefix)
    app.include_router(dashboard.router, prefix=prefix)
    app.include_router(admin.router, prefix=prefix)
    app.include_router(ops.router, prefix=prefix)
    app.include_router(public.router, prefix=prefix)

    return app


app = create_app()
