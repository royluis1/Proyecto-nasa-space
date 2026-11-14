from fastapi import APIRouter, Body, Depends

from app.api import examples
from app.api.deps import get_repository
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.scenario import ScenarioRequest, ScenarioResult
from app.services.repository import Repository

router = APIRouter(tags=["escenarios"])


@router.post(
    "/scenarios",
    response_model=ApiResponse[list[ScenarioResult]],
    summary="Simular escenarios climáticos",
    responses={404: {"model": ErrorResponse}, 422: {"model": ErrorResponse, "description": "Valores fuera de rango."}},
)
def run_scenarios(
    req: ScenarioRequest = Body(openapi_examples=examples.SCENARIOS),
    repo: Repository = Depends(get_repository),
) -> ApiResponse[list[ScenarioResult]]:
    """Recalcula el ranking bajo cada escenario (lluvia -50 a +30 %, temperatura 0 a +3 °C).

    **Por ahora devuelve rankings vacíos**: un ranking simulado que no cambia con el
    escenario sería engañoso. Se implementa en la fase de escenarios.
    """
    repo.get_field(req.field_id)
    return ApiResponse(
        data=[ScenarioResult(scenario=s) for s in req.scenarios],
        meta=ResponseMeta(data_status=DataStatus.MOCK, warnings=["Simulación de escenarios pendiente."]),
    )
