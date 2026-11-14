import csv
import io
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.api.deps import get_repository
from app.models.constants import DISCLAIMER
from app.models.enums import DataStatus
from app.schemas.common import ApiResponse, ErrorResponse, ResponseMeta
from app.schemas.report import Report
from app.services.mock_scoring import MOCK_WARNING, mock_ranking
from app.services.repository import Repository

router = APIRouter(tags=["reporte"])


def _build(repo: Repository, field_id: str) -> Report:
    field = repo.get_field(field_id)
    rotations = repo.rotations_for_field(field_id)
    return Report(
        generated_at=datetime.now(timezone.utc),
        field=field,
        rotations=rotations,
        ranking=mock_ranking(rotations, repo.get_priorities(field_id).priorities),
        sources=[],
        assumptions=[],
        disclaimer=DISCLAIMER,
    )


def _to_csv(report: Report) -> str:
    names = {r.id: r.name for r in report.rotations}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["# " + DISCLAIMER])
    w.writerow(["# " + MOCK_WARNING])
    w.writerow(["# Lote", report.field.id, report.field.name, f"generado {report.generated_at.isoformat()}"])
    w.writerow(["puesto", "rotacion_id", "rotacion", "puntaje_total", *[c.key.value for c in report.ranking[0].components]])
    for s in report.ranking:
        w.writerow([s.rank, s.rotation_id, names[s.rotation_id], s.total, *[c.value for c in s.components]])
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
    repo: Repository = Depends(get_repository),
):
    """Reporte con lote, rotaciones, ranking, fuentes, supuestos y advertencia.

    **Por ahora el ranking es simulado** y fuentes y supuestos van vacíos.
    """
    report = _build(repo, field_id)
    if format == "csv":
        return Response(
            content=_to_csv(report),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="fieldshift_{field_id}.csv"'},
        )
    return ApiResponse(data=report, meta=ResponseMeta(data_status=DataStatus.MOCK, warnings=[MOCK_WARNING]))
