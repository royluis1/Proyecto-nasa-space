from fastapi import APIRouter, Body, Depends

from app.api import examples
from app.api.deps import get_rotation_service
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.rotation import CompareRequest
from app.schemas.scenario import ScenarioRequest, ScenarioResult
from app.services.engine.service import RotationService

router = APIRouter(tags=["escenarios"])


@router.post(
    "/scenarios",
    response_model=ApiResponse[list[ScenarioResult]],
    summary="Simular escenarios climáticos",
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse, "description": "Valores fuera de rango."}},
)
def run_scenarios(
    req: ScenarioRequest = Body(openapi_examples=examples.SCENARIOS),
    service: RotationService = Depends(get_rotation_service),
) -> ApiResponse[list[ScenarioResult]]:
    """Recalcula el ranking bajo cada escenario (lluvia -50 a +30 %, temperatura 0 a +3 °C,
    año seco análogo, riego). Las rotaciones son las mismas en todos los escenarios, así se
    pueden comparar. Los escenarios son supuestos de sensibilidad, no proyecciones climáticas."""
    results = []
    status = None
    warnings: list[str] = []
    for scenario in req.scenarios:
        result, climate = service.compare(CompareRequest(field_id=req.field_id, priorities=req.priorities), scenario)
        status = climate.status
        warnings += result.warnings
        results.append(ScenarioResult(scenario=scenario, recommended_rotation_id=result.recommended_rotation_id,
                                      ranking=result.ranking, warnings=result.warnings))
    return ApiResponse(
        data=results,
        meta=ResponseMeta(data_status=status, origin_label=status.origin_label, warnings=list(dict.fromkeys(warnings))),
    )
