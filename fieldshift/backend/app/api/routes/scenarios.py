from fastapi import APIRouter, Body, Depends

from app.api import examples
from app.api.deps import get_rotation_service
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.rotation import CompareRequest
from app.schemas.scenario import ScenarioPreset, ScenarioRequest, ScenarioResult, ScenarioRotationNote
from app.services.engine.scenarios import PRESETS
from app.services.engine.service import RotationService

router = APIRouter(tags=["escenarios"])


@router.get("/scenarios/presets", response_model=ApiResponse[list[ScenarioPreset]], summary="Escenarios predefinidos")
def scenario_presets() -> ApiResponse[list[ScenarioPreset]]:
    """Año normal, seco, con lluvias intensas y con olas de calor; lluvia -10, -20 y -30 %; +1 y +2 °C;
    sin riego, con riego limitado y con riego disponible."""
    data = [ScenarioPreset(scenario=p.scenario, group=p.group, help=p.help) for p in PRESETS]
    return ApiResponse(data=data, meta=ResponseMeta(data_status=DataStatus.SAMPLE, origin_label="Supuestos de sensibilidad de FieldShift"))


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
    """Recalcula puntajes, ranking, riesgos, recomendación y explicaciones bajo cada escenario (lluvia -50 a
    +30 %, temperatura 0 a +3 °C, año seco análogo, lluvias intensas, olas de calor y nivel de riego). Las
    rotaciones son las mismas en todos los escenarios, así se pueden comparar. Son supuestos de sensibilidad,
    no proyecciones climáticas."""
    results = []
    status = None
    warnings: list[str] = []
    for scenario in req.scenarios:
        result, climate = service.compare(CompareRequest(field_id=req.field_id, priorities=req.priorities), scenario)
        status = climate.status
        warnings += result.warnings
        notes = [
            ScenarioRotationNote(
                rotation_id=ev.rotation.id,
                summary=ev.recommendation.summary,
                why=ev.recommendation.why,
                risks=ev.recommendation.risks,
                risk_level=ev.score.risk_level,
                risk_flags=ev.risk_flags,
            )
            for ev in result.evaluations
        ]
        results.append(ScenarioResult(scenario=scenario, recommended_rotation_id=result.recommended_rotation_id,
                                      ranking=result.ranking, rotations=notes, warnings=result.warnings))
    return ApiResponse(
        data=results,
        meta=ResponseMeta(data_status=status, origin_label=status.origin_label, warnings=list(dict.fromkeys(warnings))),
    )
