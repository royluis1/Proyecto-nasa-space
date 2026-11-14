from fastapi import APIRouter, Body, Depends

from app.api import examples
from app.api.deps import get_power_service, get_repository
from app.config import Settings, get_settings
from app.schemas.climate import ClimateSummary, ClimateSummaryRequest
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.services.climate_summary import build_summary, missing_warnings
from app.services.power.service import PowerService, resolve_parameters
from app.services.repository import Repository
from app.utils.validators import is_in_san_luis

router = APIRouter(tags=["clima"])


@router.post(
    "/climate-summary",
    response_model=ApiResponse[ClimateSummary],
    response_model_exclude_none=False,
    summary="Resumen climático con NASA POWER",
    responses={
        404: {"model": ErrorResponse, "description": "El lote no existe."},
        422: {"model": ErrorResponse, "description": "Coordenadas, fechas o parámetros inválidos."},
        502: {"model": ErrorResponse, "description": "Respuesta inválida de NASA POWER."},
        503: {"model": ErrorResponse, "description": "Sin datos: POWER no responde y no hay caché ni muestra."},
    },
)
def climate_summary(
    req: ClimateSummaryRequest = Body(openapi_examples=examples.CLIMATE),
    repo: Repository = Depends(get_repository),
    power: PowerService = Depends(get_power_service),
    settings: Settings = Depends(get_settings),
) -> ApiResponse[ClimateSummary]:
    """Serie diaria, resúmenes mensual, estacional y anual, extremos, tendencias, días calurosos,
    lluvia acumulada, variabilidad, ET0 y déficit hídrico climático.

    Origen del dato (`meta.origin_label`): **DATO NASA EN VIVO**, **DATO CACHEADO** o **DATO DE MUESTRA**.
    Orden de búsqueda: caché vigente → POWER en vivo → caché vencida → muestra simulada.
    """
    lat, lon = req.latitude, req.longitude
    if req.field_id:
        field = repo.get_field(req.field_id)
        lat, lon = field.location.lat, field.location.lon

    params = resolve_parameters([p.value for p in req.parameters] if req.parameters else None)
    data = power.get_daily(lat, lon, req.start_date, req.end_date, params, req.community)
    summary = build_summary(
        data, lat, lon, req.start_date, req.end_date, req.community,
        settings.power_base_url, req.include_daily, req.field_id,
    )

    warnings = [*data.warnings, *missing_warnings(summary)]
    if not is_in_san_luis(lat, lon):
        warnings.append("La ubicación está fuera de San Luis: los supuestos agronómicos pueden no aplicar.")
    return ApiResponse(
        data=summary,
        meta=ResponseMeta(data_status=data.status, origin_label=data.status.origin_label, warnings=warnings),
    )
