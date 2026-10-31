import sklearn
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.schemas.common import HealthOut
from app.services.ml import get_model_bundle

router = APIRouter()


@router.get("/health", response_model=HealthOut)
def health(db: Session = Depends(get_db)) -> HealthOut:
    settings = get_settings()

    # 1. Cheap database check: SELECT 1
    db_ok = False
    try:
        res = db.execute(text("SELECT 1")).scalar()
        db_ok = (res == 1)
    except Exception:
        db_ok = False

    # 2. Check model load status
    bundle = get_model_bundle()
    model_loaded = (bundle is not None and "model" in bundle and "scaler" in bundle)
    model_version = bundle.get("version", "uninitialized") if bundle else "uninitialized"

    # 3. Copilot configured check (boolean flag only, never expose keys)
    copilot_configured = bool(
        (settings.nvidia_api_key and settings.nvidia_api_key.strip()) or
        (settings.gemini_api_key and settings.gemini_api_key.strip())
    )

    return HealthOut(
        status="ok" if db_ok else "degraded",
        service="FIN-SHIELD",
        dataset="synthetic demonstration data plus investigator submissions",
        environment=settings.environment,
        model_loaded=model_loaded,
        model_version=model_version,
        sklearn_version=sklearn.__version__,
        db_ok=db_ok,
        copilot_configured=copilot_configured,
    )
