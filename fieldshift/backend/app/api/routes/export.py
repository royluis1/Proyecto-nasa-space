import csv
import io
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import Response

from app.api.deps import get_rotation_service
from app.models.constants import disclaimer
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.priority import Priorities
from app.schemas.report import Report, ReportRequest, ScenarioResilience
from app.schemas.rotation import CompareRequest, ScenarioInput
from app.services.engine.explain import strategy_label
from app.services.engine.scenarios import PRESETS, PRESETS_BY_ID, resilience
from app.services.engine.service import RotationService

router = APIRouter(tags=["reporte"])

COMPONENT_NAMES = {"A": "agua", "S": "suelo", "R": "riesgo", "I": "ingreso", "E": "sostenibilidad"}


def _build(
    service: RotationService,
    field_id: str,
    priorities: Priorities | None = None,
    scenario: ScenarioInput | None = None,
    scenario_ids: list[str] | None = None,
) -> tuple[Report, object, list[str]]:
    result, climate = service.compare(CompareRequest(field_id=field_id, priorities=priorities), scenario)
    best = next(ev for ev in result.evaluations if ev.rotation.id == result.recommended_rotation_id)
    presets = PRESETS if scenario_ids is None else [PRESETS_BY_ID[i] for i in scenario_ids if i in PRESETS_BY_ID]
    table: list[ScenarioResilience] = []
    if presets:
        runs = [
            (p.scenario.id, service.compare(CompareRequest(field_id=field_id, priorities=priorities), p.scenario)[0].ranking)
            for p in presets
        ]
        names = {p.scenario.id: p.scenario.name for p in presets}
        table = [
            ScenarioResilience(
                rotation_id=r.rotation_id, mean_total=r.mean_total, worst_total=r.worst_total,
                worst_scenario=names[r.worst_scenario_id], worst_rank=r.worst_rank, wins=r.wins, max_drop=r.max_drop,
            )
            for r in resilience(runs)
        ]
    report = Report(
        generated_at=datetime.now(timezone.utc),
        field=service.repo.get_field(field_id),
        priorities=result.priorities,
        weights=result.weights,
        climate=result.inputs.climate,
        scenario=scenario,
        rotations=[ev.rotation for ev in result.evaluations],
        ranking=result.ranking,
        explanations={ev.rotation.id: ev.recommendation.why for ev in result.evaluations},
        recommended_rotation_id=result.recommended_rotation_id,
        recommendation=best.recommendation,
        confidence=result.confidence,
        resilience=table,
        sources=result.sources,
        assumptions=result.assumptions,
        warnings=result.warnings,
        disclaimer=disclaimer(),
    )
    return report, climate, result.warnings


def _to_csv(report: Report, origin_label: str) -> str:
    """CSV por secciones (con BOM para que Excel respete los acentos)."""
    rotations = {r.id: r for r in report.rotations}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["# AgroOrbit: reporte para revisar con un ingeniero agrónomo"])
    w.writerow(["# " + disclaimer()])
    w.writerow(["# Generado", report.generated_at.isoformat()])
    w.writerow(["# Origen del clima", origin_label])
    w.writerow([])
    f = report.field
    w.writerow(["seccion", "dato", "valor"])
    for key, value in [
        ("lote", f.id), ("nombre", f.name), ("superficie_ha", f.area_ha), ("latitud", f.location.lat),
        ("longitud", f.location.lon), ("riego", "si" if f.irrigated else "no"),
        ("textura", f.soil_profile.texture.value if f.soil_profile and f.soil_profile.texture else "sin dato"),
        ("cultivo_actual", f.current_crop or "sin dato"), ("historial", " > ".join(f.crop_history) or "sin dato"),
    ]:
        w.writerow(["campo", key, value])
    for key, value in report.priorities.model_dump().items():
        w.writerow(["prioridades", key, value])
    for key, value in report.weights.items():
        w.writerow(["pesos", COMPONENT_NAMES.get(key, key), round(value, 3)])
    c = report.climate
    for key, value in [
        ("periodo", c.period), ("lluvia_mm_anio", c.annual_precip_mm), ("et0_mm_anio", c.annual_et0_mm),
        ("indice_aridez", c.aridity_index), ("zona", c.zone.value), ("variabilidad_lluvia_pct", c.precip_cv_pct),
        ("dias_calor_anio", c.heat_days_per_year), ("escenario", c.scenario or "Año normal"),
        ("lluvia_escenario_mm", c.scenario_precip_mm), ("et0_escenario_mm", c.scenario_et0_mm),
    ]:
        w.writerow(["clima", key, value])
    rec = report.recommendation
    w.writerow(["recomendacion", "rotacion", rotations[report.recommended_rotation_id].name])
    w.writerow(["recomendacion", "por_que", rec.why])
    for risk in rec.risks:
        w.writerow(["recomendacion", "riesgo", risk])
    w.writerow(["recomendacion", "validar", rec.validation_note])
    w.writerow([])
    keys = [c.key.value for c in report.ranking[0].components]
    w.writerow(["puesto", "rotacion_id", "estrategia", "rotacion", "puntaje_total", "rango_min", "rango_max", "confianza", "riesgo",
                *[f"{k}_{COMPONENT_NAMES.get(k, k)}" for k in keys], "explicacion"])
    for s in report.ranking:
        rot = rotations[s.rotation_id]
        w.writerow([s.rank, s.rotation_id, strategy_label(rot.strategy), rot.name, s.total, s.uncertainty_low, s.uncertainty_high,
                    s.confidence.value, s.risk_level.value if s.risk_level else "", *[c.value for c in s.components],
                    report.explanations[s.rotation_id]])
    if report.resilience:
        w.writerow([])
        w.writerow(["resistencia_rotacion", "promedio", "peor_puntaje", "peor_escenario", "peor_puesto", "escenarios_ganados", "mayor_caida"])
        for r in report.resilience:
            w.writerow([rotations[r.rotation_id].name, r.mean_total, r.worst_total, r.worst_scenario, r.worst_rank, r.wins, r.max_drop])
    w.writerow([])
    w.writerow(["supuesto", "texto", "fuente"])
    for a in report.assumptions:
        w.writerow(["supuesto", a.text, a.source or "a validar"])
    w.writerow(["fuente", "nombre", "detalle"])
    for src in report.sources:
        w.writerow(["fuente", src.name, f"{src.provider}. {src.citation}"])
    for warning in report.warnings:
        w.writerow(["advertencia", warning, ""])
    w.writerow(["advertencia", disclaimer(), ""])
    return "﻿" + buf.getvalue()


def _respond(report: Report, climate, warnings: list[str], fmt: str, field_id: str):
    if fmt == "csv":
        return Response(
            content=_to_csv(report, climate.status.origin_label),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="fieldshift_{field_id}.csv"'},
        )
    return ApiResponse(data=report, meta=ResponseMeta(data_status=climate.status, origin_label=climate.status.origin_label, warnings=warnings))


_RESPONSES = {
    200: {"content": {"text/csv": {}}, "description": "JSON (por defecto) o CSV según `format`."},
    404: {"model": ErrorResponse},
}


@router.get("/export/report", response_model=ApiResponse[Report], summary="Exportar reporte del lote", responses=_RESPONSES)
def export_report(
    field_id: str = Query(examples=["campo-este"]),
    format: Literal["json", "csv"] = Query(default="json", description="El PDF lo arma el frontend con estos mismos datos."),
    scenarios: bool = Query(default=False, description="Sumar la tabla de resistencia a los 12 escenarios predefinidos."),
    service: RotationService = Depends(get_rotation_service),
):
    """Reporte con campo, prioridades, resumen climático, rotaciones, puntajes, recomendación, supuestos,
    fuentes, advertencias y fecha de generación. Con las prioridades guardadas del lote."""
    report, climate, warnings = _build(service, field_id, scenario_ids=None if scenarios else [])
    return _respond(report, climate, warnings, format, field_id)


@router.post("/export/report", response_model=ApiResponse[Report], summary="Exportar reporte con prioridades y escenario", responses=_RESPONSES)
def export_report_custom(req: ReportRequest = Body(), service: RotationService = Depends(get_rotation_service)):
    """Igual que GET, pero con las prioridades y el escenario que se elijan, y la tabla de resistencia a escenarios."""
    report, climate, warnings = _build(service, req.field_id, req.priorities, req.scenario, req.scenario_ids)
    return _respond(report, climate, warnings, req.format, req.field_id)
