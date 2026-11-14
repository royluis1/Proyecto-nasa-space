from fastapi import APIRouter, Body, Depends, status

from app.api import examples
from app.api.deps import get_region_repository, get_repository, get_soil_provider
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.field import FieldCreate, FieldOut
from app.services.field_profile import build_auto_profile
from app.services.regions.repository import RegionRepository
from app.services.repository import Repository
from app.services.soil.soilgrids import SoilProvider
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
    regions: RegionRepository = Depends(get_region_repository),
    soil: SoilProvider = Depends(get_soil_provider),
) -> ApiResponse[FieldOut]:
    """Crea un lote a partir de coordenadas (WGS84). Se redondean a 4 decimales.

    Devuelve además el perfil automático (`auto_profile`): suelo ESTIMADO (SoilGrids, 250 m), zona climática derivada
    de NASA POWER, los cultivos más aptos y si está en una zona de transición. Lo que carga el productor siempre pisa
    lo automático. Si el punto cae fuera de San Luis se acepta, con advertencia.
    """
    field = repo.save_field(build_auto_profile(repo.create_field(data), regions, soil))
    warnings = ["El lote se guarda en memoria: se pierde al reiniciar el servidor.", *field.auto_profile.warnings]
    if not is_in_san_luis(field.location.lat, field.location.lon):
        warnings.append("La ubicación está fuera de San Luis: los supuestos agronómicos pueden no aplicar.")
    return ApiResponse(data=field, meta=ResponseMeta(data_status=DataStatus.SAMPLE, warnings=warnings))


@router.get("/fields", response_model=ApiResponse[list[FieldOut]], summary="Listar lotes")
def list_fields(repo: Repository = Depends(get_repository)) -> ApiResponse[list[FieldOut]]:
    """Lotes de ejemplo y los creados en la sesión."""
    return ApiResponse(
        data=repo.list_fields(),
        meta=ResponseMeta(data_status=DataStatus.SAMPLE, warnings=["Los lotes de ejemplo tienen datos ILUSTRATIVOS."]),
    )


@router.put(
    "/fields/{field_id}",
    response_model=ApiResponse[FieldOut],
    summary="Actualizar un lote",
    responses={**NOT_FOUND, 400: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def update_field(
    field_id: str,
    data: FieldCreate = Body(),
    repo: Repository = Depends(get_repository),
    regions: RegionRepository = Depends(get_region_repository),
    soil: SoilProvider = Depends(get_soil_provider),
) -> ApiResponse[FieldOut]:
    """Reemplaza los datos del lote y recalcula el perfil automático (lo cargado por el productor tiene prioridad).
    Los cambios se guardan en memoria (se pierden al reiniciar)."""
    field = repo.save_field(build_auto_profile(repo.update_field(field_id, data), regions, soil))
    warnings = ["El lote se guarda en memoria: se pierde al reiniciar el servidor.", *field.auto_profile.warnings]
    if not is_in_san_luis(field.location.lat, field.location.lon):
        warnings.append("La ubicación está fuera de San Luis: los supuestos agronómicos pueden no aplicar.")
    return ApiResponse(data=field, meta=ResponseMeta(data_status=DataStatus.SAMPLE, warnings=warnings))


@router.get("/fields/{field_id}", response_model=ApiResponse[FieldOut], summary="Obtener un lote", responses=NOT_FOUND)
def get_field(field_id: str, repo: Repository = Depends(get_repository)) -> ApiResponse[FieldOut]:
    """Devuelve el lote con su ubicación, perfil de suelo y rotación actual."""
    field = repo.get_field(field_id)
    warnings = [field.sample_note] if field.sample_note else []
    return ApiResponse(data=field, meta=ResponseMeta(data_status=DataStatus.SAMPLE, warnings=warnings))
