from fastapi import APIRouter, Body, Depends

from app.api import examples
from app.api.deps import get_repository
from app.models.enums import DataStatus
from app.schemas.climate import ClimateSummary, ClimateSummaryRequest
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.services.repository import Repository

router = APIRouter(tags=["clima"])


@router.post(
    "/climate-summary",
    response_model=ApiResponse[ClimateSummary],
    summary="Resumen climático del lote",
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse, "description": "Fechas inválidas."}},
)
def climate_summary(
    req: ClimateSummaryRequest = Body(openapi_examples=examples.CLIMATE),
    repo: Repository = Depends(get_repository),
) -> ApiResponse[ClimateSummary]:
    """Resumen climático a partir de NASA POWER (entorno regional, ~0.5° x 0.625°).

    **Por ahora devuelve la estructura vacía**: la integración con POWER es la próxima fase.
    """
    repo.get_field(req.field_id)
    return ApiResponse(
        data=ClimateSummary(field_id=req.field_id, period=req.period),
        meta=ResponseMeta(
            data_status=DataStatus.MOCK,
            warnings=["Integración con NASA POWER pendiente: los valores están vacíos."],
        ),
    )
