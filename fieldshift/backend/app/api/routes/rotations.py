from fastapi import APIRouter, Body, Depends

from app.api import examples
from app.api.deps import get_rotation_service
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.rotation import CompareRequest, CompareResult, RotationEvaluation
from app.services.engine.service import RotationService

router = APIRouter(tags=["rotaciones"])


@router.post(
    "/rotations/compare",
    response_model=ApiResponse[CompareResult],
    summary="Comparar rotaciones de un lote",
    responses={
        400: {"model": ErrorResponse, "description": "Rotación, historial o período inválido."},
        404: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse, "description": "Sin datos climáticos."},
    },
)
def compare_rotations(
    req: CompareRequest = Body(openapi_examples=examples.COMPARE),
    service: RotationService = Depends(get_rotation_service),
) -> ApiResponse[CompareResult]:
    """Genera y compara al menos 3 rotaciones, siempre con la actual como línea base.

    Estrategias: actual, conservadora, diversificada, ahorro de agua, salud del suelo,
    rentabilidad y mixta recomendada. Cada una trae puntaje total (0-100) con rango de
    incertidumbre, desglose A/S/R/I/E con bonificaciones y penalizaciones, explicación en
    lenguaje simple, riesgos, supuestos, fuentes, nivel de confianza y advertencias.

    Clima: NASA POWER de los últimos 10 años completos (con caché y fallback a muestra).
    Si no se envían prioridades, se usan las guardadas o, si no hay, las por defecto.
    """
    result, climate = service.compare(req)
    return ApiResponse(
        data=result,
        meta=ResponseMeta(data_status=climate.status, origin_label=climate.status.origin_label, warnings=result.warnings),
    )


@router.get(
    "/rotations/{rotation_id}",
    response_model=ApiResponse[RotationEvaluation],
    summary="Detalle de una rotación",
    responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
def get_rotation(rotation_id: str, service: RotationService = Depends(get_rotation_service)) -> ApiResponse[RotationEvaluation]:
    """Rotación declarada o generada (por ejemplo `campo-este-suelo`) con su perfil, puntaje,
    explicación, riesgos y supuestos, calculada con las prioridades guardadas del lote."""
    evaluation, result, climate = service.evaluation(rotation_id)
    return ApiResponse(
        data=evaluation,
        meta=ResponseMeta(data_status=climate.status, origin_label=climate.status.origin_label,
                          warnings=[*result.warnings, *evaluation.warnings]),
    )
