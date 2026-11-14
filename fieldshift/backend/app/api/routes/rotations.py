from fastapi import APIRouter, Body, Depends

from app.api import examples
from app.api.deps import get_repository
from app.models.enums import DataStatus, RotationStrategy
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.rotation import CompareRequest, CompareResult, Rotation, RotationDetail
from app.services.mock_scoring import MOCK_WARNING, mock_ranking
from app.services.repository import Repository
from app.utils.exceptions import InvalidInputError

router = APIRouter(tags=["rotaciones"])

MIN_ROTATIONS = 3


def _select(repo: Repository, req: CompareRequest) -> list[Rotation]:
    available = {r.id: r for r in repo.rotations_for_field(req.field_id)}
    ids = req.rotation_ids or list(available)
    foreign = [i for i in ids if i not in available]
    if foreign:
        raise InvalidInputError("Hay rotaciones que no pertenecen a este lote.", {"rotation_ids": foreign})
    selected = [available[i] for i in dict.fromkeys(ids)]  # sin duplicados, mismo orden
    if len(selected) < MIN_ROTATIONS:
        raise InvalidInputError(f"Se necesitan al menos {MIN_ROTATIONS} rotaciones para comparar.")
    if not any(r.strategy == RotationStrategy.ACTUAL for r in selected):
        raise InvalidInputError("La comparación debe incluir la rotación actual como línea base.")
    return selected


@router.post(
    "/rotations/compare",
    response_model=ApiResponse[CompareResult],
    summary="Comparar rotaciones de un lote",
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 422: {"model": ErrorResponse}},
)
def compare_rotations(
    req: CompareRequest = Body(openapi_examples=examples.COMPARE),
    repo: Repository = Depends(get_repository),
) -> ApiResponse[CompareResult]:
    """Ranking de al menos 3 rotaciones, incluida la actual.

    Si no se envían prioridades se usan las guardadas o, si no hay, las por defecto.
    **Por ahora los puntajes son simulados** (`data_status = mock`).
    """
    rotations = _select(repo, req)
    stored = repo.get_priorities(req.field_id)
    priorities = req.priorities or stored.priorities
    warnings = [MOCK_WARNING]
    if req.priorities is None and stored.is_default:
        warnings.append("Prioridades por defecto (estimado): el productor no las cargó.")
    return ApiResponse(
        data=CompareResult(
            field_id=req.field_id,
            priorities=priorities,
            ranking=mock_ranking(rotations, priorities, req.scenario_id),
        ),
        meta=ResponseMeta(data_status=DataStatus.MOCK, warnings=warnings),
    )


@router.get(
    "/rotations/{rotation_id}",
    response_model=ApiResponse[RotationDetail],
    summary="Detalle de una rotación",
    responses={404: {"model": ErrorResponse}},
)
def get_rotation(rotation_id: str, repo: Repository = Depends(get_repository)) -> ApiResponse[RotationDetail]:
    """Rotación con su puntaje, recomendación, advertencias y supuestos.

    Por ahora: puntaje simulado y recomendación vacía (se generan en fases posteriores).
    """
    rotation = repo.get_rotation(rotation_id)
    siblings = repo.rotations_for_field(rotation.field_id)
    ranking = mock_ranking(siblings, repo.get_priorities(rotation.field_id).priorities)
    score = next(s for s in ranking if s.rotation_id == rotation_id)
    return ApiResponse(
        data=RotationDetail(rotation=rotation, score=score, recommendation=None, risk_flags=[], assumptions=[]),
        meta=ResponseMeta(data_status=DataStatus.MOCK, warnings=[MOCK_WARNING]),
    )
