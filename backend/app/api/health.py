from fastapi import APIRouter

from app.schemas.common import HealthOut

router = APIRouter()


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    return HealthOut(status="ok", service="FIN-SHIELD", dataset="synthetic demonstration data plus investigator submissions")
