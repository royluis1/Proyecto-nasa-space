from fastapi import APIRouter, Depends

from app.api.deps import get_repository
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.crop import Crop
from app.services.repository import Repository

router = APIRouter(tags=["cultivos"])


@router.get("/crops", response_model=ApiResponse[list[Crop]], summary="Catálogo de cultivos")
def list_crops(repo: Repository = Depends(get_repository)) -> ApiResponse[list[Crop]]:
    """Cultivos y coberturas con atributos cualitativos, fuente y nivel de confianza."""
    return ApiResponse(
        data=repo.list_crops(),
        meta=ResponseMeta(
            data_status=DataStatus.SAMPLE,
            warnings=["Catálogo provisorio: valores cualitativos a verificar con FAO e INTA."],
        ),
    )
