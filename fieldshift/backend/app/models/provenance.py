"""Tipos de procedencia: todo valor mostrado lleva su origen, fuente y confianza."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Confidence, DataLabel


class Provenance(BaseModel):
    model_config = ConfigDict(frozen=True)

    label: DataLabel
    source_id: str | None = Field(default=None, description="Id de DataSource, si aplica.")
    retrieved_at: datetime | None = None
    resolution: str | None = Field(default=None, examples=["~0.5° x 0.625°", "500 m"])
    method: str | None = None
    confidence: Confidence = Confidence.MEDIA
    note: str | None = None


class Valued(BaseModel):
    """Un valor numérico con unidad y procedencia. `value=None` significa dato faltante."""

    value: float | None
    unit: str
    provenance: Provenance


MOCK_PROVENANCE = Provenance(
    label=DataLabel.SUPUESTO,
    confidence=Confidence.BAJA,
    note="Valor simulado: la lógica correspondiente todavía no está implementada.",
)
