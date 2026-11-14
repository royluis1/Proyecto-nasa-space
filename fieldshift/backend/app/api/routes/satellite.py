from fastapi import APIRouter, Body, Depends

from app.api import examples
from app.api.deps import get_satellite_service
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.satellite import SoilMoistureRequest, SoilMoistureSummary, VegetationRequest, VegetationSummary
from app.services.satellite.service import SatelliteService

router = APIRouter(tags=["satélite"])

ERRORS = {
    400: {"model": ErrorResponse, "description": "CSV ilegible o período sin datos."},
    404: {"model": ErrorResponse, "description": "El lote no existe."},
    422: {"model": ErrorResponse, "description": "Coordenadas o fechas inválidas."},
    503: {"model": ErrorResponse, "description": "Sin datos: no hay CSV, caché, AppEEARS ni muestra para el punto."},
}


@router.post(
    "/soil-moisture", response_model=ApiResponse[SoilMoistureSummary], summary="Humedad de suelo SMAP", responses=ERRORS
)
def soil_moisture(
    req: SoilMoistureRequest = Body(openapi_examples=examples.SOIL_MOISTURE),
    service: SatelliteService = Depends(get_satellite_service),
) -> ApiResponse[SoilMoistureSummary]:
    """Humedad promedio, frecuencia de sequías, meses con baja humedad, tendencia y estrés hídrico relativo.

    Por defecto: SMAP L4 en zona de raíces (0-100 cm, modelado). Origen del dato (`meta.origin_label`):
    CSV cargado → caché → AppEEARS en vivo (asincrónico) → muestra simulada → 503.
    """
    summary, warnings = service.soil_moisture(req)
    status = summary.trace.status
    return ApiResponse(
        data=summary, meta=ResponseMeta(data_status=status, origin_label=status.origin_label, warnings=warnings)
    )


@router.post("/vegetation-index", response_model=ApiResponse[VegetationSummary], summary="NDVI MODIS", responses=ERRORS)
def vegetation_index(
    req: VegetationRequest = Body(openapi_examples=examples.VEGETATION),
    service: SatelliteService = Depends(get_satellite_service),
) -> ApiResponse[VegetationSummary]:
    """NDVI promedio, cobertura vegetal estimada, períodos de barbecho, tendencia de biomasa y comparación entre campañas.

    Por defecto: MOD13Q1 v6.1 (250 m, 16 días), 10 campañas de julio a junio. Se descartan nubes y nieve
    con la capa de confiabilidad del píxel.
    """
    summary, warnings = service.vegetation(req)
    status = summary.trace.status
    return ApiResponse(
        data=summary, meta=ResponseMeta(data_status=status, origin_label=status.origin_label, warnings=warnings)
    )
