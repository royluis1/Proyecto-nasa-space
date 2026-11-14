from fastapi import APIRouter, Body, Depends, status

from app.api import examples
from app.api.deps import get_repository
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.field import FieldCreate, FieldOut
from app.services.repository import Repository
from app.utils.validators import is_in_san_luis

router = APIRouter(tags=["lotes"])

NOT_FOUND = {404: {"model": ErrorResponse, "description": "El lote no existe."}}


@router.post(
    "/fields",
    response_model=ApiResponse[FieldOut],
    status_code=status.HTTP_201_CREATED,
    summary="Crear un lote",
    responses={422: {"model": ErrorResponse, "description": "Coordenadas o datos inválidos."}},
)
def create_field(
    data: FieldCreate = Body(openapi_examples=examples.FIELD_CREATE),
    repo: Repository = Depends(get_repository),
) -> ApiResponse[FieldOut]:
    """Crea un lote a partir de coordenadas (WGS84). Se redondean a 4 decimales.

    Si el punto cae fuera de San Luis se acepta, pero con advertencia: los datos
    de muestra y los supuestos agronómicos son de San Luis.
    """
    field = repo.create_field(data)
    warnings = ["El lote se guarda en memoria: se pierde al reiniciar el servidor."]
    if not is_in_san_luis(field.location.lat, field.location.lon):
        warnings.append("La ubicación está fuera de San Luis: los supuestos agronómicos pueden no aplicar.")
    return ApiResponse(data=field, meta=ResponseMeta(data_status=DataStatus.SAMPLE, warnings=warnings))


@router.get("/fields/{field_id}", response_model=ApiResponse[FieldOut], summary="Obtener un lote", responses=NOT_FOUND)
def get_field(field_id: str, repo: Repository = Depends(get_repository)) -> ApiResponse[FieldOut]:
    """Devuelve el lote con su ubicación, perfil de suelo y rotación actual."""
    field = repo.get_field(field_id)
    warnings = [field.sample_note] if field.sample_note else []
    return ApiResponse(data=field, meta=ResponseMeta(data_status=DataStatus.SAMPLE, warnings=warnings))
