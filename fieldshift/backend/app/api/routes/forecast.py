from fastapi import APIRouter, Body, Depends

from app.api.deps import get_early_warning_service, get_forecast_service, get_repository
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.forecast import AlertsRequest, AlertsResult, Forecast, ForecastRequest, HuertaPanel, PlaceRequest
from app.schemas.huerta import HuertaRotationGuide
from app.services.early_warning import EarlyWarningService
from app.services.forecast.open_meteo import ForecastService
from app.services.huerta_rotation import huerta_rotation
from app.services.repository import Repository
from app.utils.exceptions import InvalidInputError

router = APIRouter(tags=["alerta temprana"])
_ERR = {404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 503: {"model": ErrorResponse}}


def _status(sources) -> DataStatus:
    for s in sources:
        if s.name == "NASA POWER" and s.origin:
            return s.origin
    return DataStatus.LIVE


@router.post("/forecast", response_model=ApiResponse[Forecast], summary="Pronóstico (Open-Meteo, no es NASA)", responses=_ERR)
def forecast(
    req: ForecastRequest = Body(openapi_examples={"lote": {"summary": "Lote", "value": {"field_id": "campo-este", "days": 10}}}),
    service: ForecastService = Depends(get_forecast_service),
    repo: Repository = Depends(get_repository),
) -> ApiResponse[Forecast]:
    """Temperaturas, lluvia, probabilidad de lluvia, ET0 y viento de los próximos días. Fuente: Open-Meteo, que NO es un
    producto de la NASA; se aclara en la respuesta."""
    if req.field_id:
        loc = repo.get_field(req.field_id).location
        lat, lon = loc.lat, loc.lon
    elif req.latitude is not None and req.longitude is not None:
        lat, lon = req.latitude, req.longitude
    else:
        raise InvalidInputError("Indicá field_id, o latitude y longitude.")
    fc = service.get(lat, lon, req.days)
    return ApiResponse(data=fc, meta=ResponseMeta(data_status=DataStatus.LIVE, origin_label=fc.source.name,
                                                  warnings=["Pronóstico de Open-Meteo: no es un dato de la NASA."]))


@router.post("/alerts", response_model=ApiResponse[AlertsResult], summary="Diagnóstico y alerta temprana", responses=_ERR)
def alerts(
    req: AlertsRequest = Body(openapi_examples={"agricultor": {"summary": "Agricultor", "value": {"field_id": "campo-este"}},
                                                "huerta": {"summary": "Huerta", "value": {"field_id": "campo-este", "profile": "huerta"}}}),
    service: EarlyWarningService = Depends(get_early_warning_service),
) -> ApiResponse[AlertsResult]:
    """Heladas, calor fuerte, lluvia intensa, viento, falta de agua y suelo seco, con mensajes según el perfil
    (huerta o agricultor). Usa NASA POWER (lluvia reciente y clima), Open-Meteo (pronóstico) y NASA SMAP."""
    r = service.alerts(req.profile, req.field_id, req.latitude, req.longitude)
    st = _status(r.sources)
    return ApiResponse(data=r, meta=ResponseMeta(data_status=st, origin_label=st.origin_label, warnings=r.warnings))


@router.post("/huerta", response_model=ApiResponse[HuertaPanel], summary="Panel de huerta", responses=_ERR)
def huerta(
    req: PlaceRequest = Body(openapi_examples={"lote": {"summary": "Huerta en un lote", "value": {"field_id": "campo-este"}}}),
    service: EarlyWarningService = Depends(get_early_warning_service),
) -> ApiResponse[HuertaPanel]:
    """Heladas (fechas típicas), cuánto regar (NASA POWER), calor, lluvia pasada (NASA POWER) y futura (Open-Meteo),
    verdor de la zona (MODIS) y alertas, en lenguaje simple."""
    r = service.huerta(req.field_id, req.latitude, req.longitude)
    st = _status(r.sources)
    return ApiResponse(data=r, meta=ResponseMeta(data_status=st, origin_label=st.origin_label, warnings=r.warnings))


@router.get("/huerta/rotation", response_model=ApiResponse[HuertaRotationGuide], summary="Rotación de huerta por familias")
def huerta_rotation_guide(repo: Repository = Depends(get_repository)) -> ApiResponse[HuertaRotationGuide]:
    """Guía simple para rotar canteros por familia botánica (solanáceas, leguminosas, hojas, raíces, cucurbitáceas,
    aliáceas), armada desde el catálogo. Fuente: INTA Pro-Huerta. Orientativa: requiere criterio local."""
    guide = huerta_rotation(repo.list_crops())
    return ApiResponse(data=guide, meta=ResponseMeta(
        data_status=DataStatus.SAMPLE,
        warnings=["Reglas orientativas de rotación de huerta (INTA Pro-Huerta): no reemplazan el criterio de un agrónomo local."],
    ))
