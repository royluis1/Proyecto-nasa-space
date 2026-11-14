from fastapi import APIRouter, Body, Depends

from app.api import examples
from app.api.deps import get_repository
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.priority import FarmerPriority
from app.services.repository import Repository

router = APIRouter(tags=["prioridades"])


@router.post(
    "/priorities",
    response_model=ApiResponse[FarmerPriority],
    summary="Guardar prioridades del productor",
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def save_priorities(
    data: FarmerPriority = Body(openapi_examples=examples.PRIORITIES),
    repo: Repository = Depends(get_repository),
) -> ApiResponse[FarmerPriority]:
    """Guarda las prioridades (0 a 10) de un lote. Se usan como pesos del puntaje."""
    saved = repo.save_priorities(data.model_copy(update={"is_default": False}))
    return ApiResponse(data=saved, meta=ResponseMeta(data_status=DataStatus.SAMPLE))
