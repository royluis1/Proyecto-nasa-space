from fastapi import APIRouter, Depends, Query

from app.api.deps import get_repository
from app.models.enums import CropScale, DataStatus
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.crop import Crop
from app.schemas.forecast import Profile
from app.services.repository import Repository

router = APIRouter(tags=["cultivos"])


@router.get("/crops", response_model=ApiResponse[list[Crop]], summary="Catálogo de cultivos")
def list_crops(
    repo: Repository = Depends(get_repository),
    scale: CropScale | None = Query(default=None, description="Filtrar por escala: huerta o campo."),
    profile: Profile | None = Query(default=None, description="Perfil del usuario: define la escala si no se pasa scale."),
) -> ApiResponse[list[Crop]]:
    """Cultivos del perfil pedido (huerta = hortalizas, agricultor = los 16 de campo), con atributos cualitativos, fuente y confianza."""
    if scale is None and profile is not None:
        scale = CropScale.HUERTA if profile == "huerta" else CropScale.CAMPO
    return ApiResponse(
        data=repo.list_crops(scale),
        meta=ResponseMeta(
            data_status=DataStatus.SAMPLE,
            warnings=["Catálogo editable con valores cualitativos: los Kc y Ky citan FAO-56 y FAO-33; el resto debe validarse con INTA y agrónomos locales."],
        ),
    )
