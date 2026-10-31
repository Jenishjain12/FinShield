import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import (
    ads,
    alerts,
    analyze,
    campaigns,
    copilot,
    dashboard,
    discovery,
    entities,
    health,
    model,
    patterns,
    stream,
    transactions,
)
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
# Import all models to ensure metadata registration
from app.models import (  # noqa: F401
    Advertisement,
    AdvertisementRelationship,
    Alert,
    AnalystNote,
    CustomerAccount,
    DeviceFingerprint,
    DiscoveryCandidate,
    DiscoveryRun,
    EntityLink,
    ExtractedEntity,
    RiskAssessment,
    RiskSignal,
    StreamRun,
    Transaction,
)

logger = logging.getLogger("finshield")
settings = get_settings()
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)


def migrate_schema(db_engine):
    """Ensure database schema includes all necessary columns for backward compatibility."""
    from sqlalchemy import text
    try:
        with db_engine.begin() as conn:
            runs_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(discovery_runs)")).fetchall()]
            if runs_cols and "min_risk_threshold" not in runs_cols:
                conn.execute(text("ALTER TABLE discovery_runs ADD COLUMN min_risk_threshold INTEGER DEFAULT 0"))

            cand_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(discovery_candidates)")).fetchall()]
            if cand_cols and "source_type" not in cand_cols:
                conn.execute(text("ALTER TABLE discovery_candidates ADD COLUMN source_type VARCHAR(50) DEFAULT 'web'"))

            alerts_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(alerts)")).fetchall()]
            if alerts_cols:
                if "transaction_id" not in alerts_cols:
                    conn.execute(text("ALTER TABLE alerts ADD COLUMN transaction_id VARCHAR(36)"))
                if "account_id" not in alerts_cols:
                    conn.execute(text("ALTER TABLE alerts ADD COLUMN account_id VARCHAR(64)"))

            notes_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(analyst_notes)")).fetchall()]
            if notes_cols:
                if "transaction_id" not in notes_cols:
                    conn.execute(text("ALTER TABLE analyst_notes ADD COLUMN transaction_id VARCHAR(36)"))
                if "author" not in notes_cols:
                    conn.execute(text("ALTER TABLE analyst_notes ADD COLUMN author VARCHAR(64) DEFAULT 'Analyst'"))
    except Exception as exc:
        logger.warning("Schema migration notice: %s", exc)


migrate_schema(engine)

app = FastAPI(
    title="FIN-SHIELD",
    description="Real-Time UPI and Digital Payment Anomaly Detection Platform",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core UPI Transaction & Anomaly Endpoints
app.include_router(health.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(stream.router, prefix="/api")
app.include_router(entities.router, prefix="/api")
app.include_router(patterns.router, prefix="/api")
app.include_router(model.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")

# Maintained legacy companion endpoints
app.include_router(ads.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
app.include_router(discovery.router, prefix="/api")
app.include_router(copilot.router, prefix="/api")

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        raise exc
    logger.exception("Unhandled server exception on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred."})
