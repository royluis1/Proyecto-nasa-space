import csv
import io
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.api.deps import get_rotation_service
from app.models.constants import DISCLAIMER
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.report import Report
from app.schemas.rotation import CompareRequest
from app.services.engine.explain import strategy_label
from app.services.engine.service import RotationService

router = APIRouter(tags=["reporte"])


def _build(service: RotationService, field_id: str) -> tuple[Report, object, list[str]]:
    result, climate = service.compare(CompareRequest(field_id=field_id))
    report = Report(
        generated_at=datetime.now(timezone.utc),
        field=service.repo.get_field(field_id),
        rotations=[ev.rotation for ev in result.evaluations],
        ranking=result.ranking,
        explanations={ev.rotation.id: ev.recommendation.why for ev in result.evaluations},
        recommended_rotation_id=result.recommended_rotation_id,
        confidence=result.confidence,
        sources=result.sources,
        assumptions=result.assumptions,
        warnings=result.warnings,
        disclaimer=DISCLAIMER,
    )
    return report, climate, result.warnings


def _to_csv(report: Report, origin_label: str) -> str:
    rotations = {r.id: r for r in report.rotations}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["# " + DISCLAIMER])
    w.writerow(["# Origen del clima: " + origin_label])
    for warning in report.warnings:
        w.writerow(["# " + warning])
    w.writerow(["# Lote", report.field.id, report.field.name, f"generado {report.generated_at.isoformat()}"])
    keys = [c.key.value for c in report.ranking[0].components]
    w.writerow(["puesto", "rotacion_id", "estrategia", "rotacion", "puntaje_total", "rango_min", "rango_max", "confianza", *keys, "explicacion"])
    for s in report.ranking:
        rot = rotations[s.rotation_id]
        w.writerow([s.rank, s.rotation_id, strategy_label(rot.strategy), rot.name, s.total, s.uncertainty_low, s.uncertainty_high,
                    s.confidence.value, *[c.value for c in s.components], report.explanations[s.rotation_id]])
    return buf.getvalue()


@router.get(
    "/export/report",
    response_model=ApiResponse[Report],
    summary="Exportar reporte del lote",
    responses={
        200: {"content": {"text/csv": {}}, "description": "JSON (por defecto) o CSV según `format`."},
        404: {"model": ErrorResponse},
    },
)
def export_report(
    field_id: str = Query(examples=["campo-este"]),
    format: Literal["json", "csv"] = Query(default="json", description="El PDF llega en una fase posterior."),
    service: RotationService = Depends(get_rotation_service),
):
    """Reporte con lote, rotaciones, ranking, explicaciones, fuentes, supuestos y advertencia."""
    report, climate, warnings = _build(service, field_id)
    if format == "csv":
        return Response(
            content=_to_csv(report, climate.status.origin_label),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="fieldshift_{field_id}.csv"'},
        )
    return ApiResponse(data=report, meta=ResponseMeta(data_status=climate.status, origin_label=climate.status.origin_label, warnings=warnings))
