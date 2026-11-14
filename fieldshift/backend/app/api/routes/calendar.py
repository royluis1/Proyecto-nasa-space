from fastapi import APIRouter, Body, Depends

from app.api.deps import get_rotation_service
from app.schemas.calendar import CalendarRequest, CalendarTimeline
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.services.engine.service import RotationService

router = APIRouter(tags=["calendario"])

EXAMPLES = {
    "recomendada": {
        "summary": "Rotación recomendada, 3 campañas",
        "value": {"field_id": "campo-este", "campaigns": 3},
    },
    "seco": {
        "summary": "Rotación actual en un año seco, 2 campañas",
        "value": {"field_id": "campo-este", "rotation_id": "campo-este-actual", "campaigns": 2,
                  "scenario": {"id": "anio-seco", "name": "Año seco", "dry_year": True}},
    },
}


@router.post(
    "/calendar",
    response_model=ApiResponse[CalendarTimeline],
    summary="Calendario agrícola de 2 a 4 campañas",
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def calendar(
    req: CalendarRequest = Body(openapi_examples=EXAMPLES),
    service: RotationService = Depends(get_rotation_service),
) -> ApiResponse[CalendarTimeline]:
    """Mes a mes: siembra, desarrollo, cosecha, barbecho, cobertura del suelo, riesgo de golpe de calor
    y de déficit hídrico, suelo desnudo y recomendaciones. Usa NASA POWER y, si están, SMAP y NDVI."""
    timeline, bundle = service.timeline(req)
    return ApiResponse(
        data=timeline,
        meta=ResponseMeta(data_status=bundle.status, origin_label=bundle.status.origin_label, warnings=timeline.warnings),
    )
