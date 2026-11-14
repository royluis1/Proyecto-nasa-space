from fastapi import APIRouter, Body, Depends

from app.api.deps import get_repository, get_terrain_provider
from app.config import get_settings
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.terrain import EarthdataStatus, TerrainRequest, TerrainSummary
from app.services.earthdata.session import credentials_from_settings
from app.services.repository import Repository
from app.services.terrain.service import TerrainProvider, default_radius, terrain_for_field

router = APIRouter(tags=["relieve"])

EXAMPLES = {
    "lote": {"summary": "Lote precargado", "value": {"field_id": "campo-conlara"}},
    "punto": {"summary": "Por coordenadas, 500 m de radio", "value": {"latitude": -33.85, "longitude": -65.2, "radius_m": 500}},
}


@router.post(
    "/terrain",
    response_model=ApiResponse[TerrainSummary],
    summary="Elevación y pendiente del lote (SRTM)",
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
def terrain(
    req: TerrainRequest = Body(openapi_examples=EXAMPLES),
    provider: TerrainProvider = Depends(get_terrain_provider),
    repo: Repository = Depends(get_repository),
) -> ApiResponse[TerrainSummary]:
    """SRTM v3 (NASA, 30 m) descargado con Earthdata Login: elevación y pendiente (método de Horn) dentro del
    polígono del lote o en un círculo con su superficie. Sin credenciales usa una muestra simulada y lo avisa."""
    if req.field_id:
        summary, warnings = terrain_for_field(provider, repo.get_field(req.field_id), req.radius_m)
    else:
        summary, warnings = provider.get(req.latitude, req.longitude, req.radius_m or default_radius(None))
    return ApiResponse(
        data=summary, meta=ResponseMeta(data_status=summary.origin, origin_label=summary.origin_label, warnings=warnings)
    )


@router.get("/earthdata/status", response_model=ApiResponse[EarthdataStatus], summary="¿Hay credenciales de Earthdata?")
def earthdata_status() -> ApiResponse[EarthdataStatus]:
    """Dice si el servidor tiene credenciales de Earthdata Login y de qué tipo. Nunca devuelve el usuario ni la clave."""
    creds = credentials_from_settings(get_settings())
    note = (
        "Credenciales cargadas: SRTM se descarga en vivo."
        if creds.configured
        else "Sin credenciales: cargá FIELDSHIFT_EARTHDATA_USERNAME y FIELDSHIFT_EARTHDATA_PASSWORD (o _TOKEN) en el entorno del servidor."
    )
    return ApiResponse(
        data=EarthdataStatus(configured=creds.configured, method=creds.method, note=note),
        meta=ResponseMeta(data_status=DataStatus.LIVE if creds.configured else DataStatus.SAMPLE),
    )
