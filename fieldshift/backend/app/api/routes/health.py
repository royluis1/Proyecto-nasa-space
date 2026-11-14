from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.config import Settings, get_settings

router = APIRouter(tags=["sistema"])


class HealthResponse(BaseModel):
    status: str
    environment: str
    version: str


@router.get("/health", response_model=HealthResponse, summary="Estado del servicio")
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Devuelve `ok` si la API está levantada. No consulta fuentes externas."""
    return HealthResponse(status="ok", environment=settings.environment, version=settings.app_version)
