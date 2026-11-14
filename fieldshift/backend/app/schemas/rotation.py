"""Rotación, puntaje explicable y recomendación."""

from pydantic import BaseModel, Field, model_validator

from app.models.enums import Level, RotationStrategy, ScoreComponentKey
from app.models.provenance import Provenance
from app.schemas.common import Assumption, RiskFlag
from app.schemas.priority import Priorities


class RotationStep(BaseModel):
    crop_id: str
    year: int = Field(ge=1, description="Año relativo en que se siembra (1 = primero). La rotación es cíclica.")
    start_month: int = Field(ge=1, le=12)
    end_month: int = Field(ge=1, le=12, description="Si es menor que start_month, termina en el año siguiente.")


class Rotation(BaseModel):
    id: str = Field(examples=["campo-este-actual"])
    field_id: str
    name: str
    strategy: RotationStrategy
    duration_years: int = Field(ge=1, le=6)
    steps: list[RotationStep] = Field(min_length=1)
    description: str | None = None

    @model_validator(mode="after")
    def _steps_within_duration(self) -> "Rotation":
        if any(s.year > self.duration_years for s in self.steps):
            raise ValueError("Hay pasos fuera de la duración de la rotación.")
        return self


class ScoreDriver(BaseModel):
    factor: str = Field(examples=["Meses con cobertura viva"])
    effect: str = Field(pattern="^(sube|baja|neutro)$")
    detail: str
    provenance: Provenance


class ScoreComponent(BaseModel):
    key: ScoreComponentKey
    name: str
    value: float | None = Field(ge=0, le=100, description="0 a 100. None = no calculable.")
    weight: float = Field(ge=0, le=1, description="Peso normalizado a partir de las prioridades.")
    drivers: list[ScoreDriver] = []
    provenance: Provenance


class RotationScore(BaseModel):
    rotation_id: str
    scenario_id: str | None = None
    rank: int = Field(ge=1)
    total: float | None = Field(ge=0, le=100)
    uncertainty_low: float | None = Field(default=None, ge=0, le=100)
    uncertainty_high: float | None = Field(default=None, ge=0, le=100)
    components: list[ScoreComponent]
    relative_water_demand: float | None = Field(
        default=None, ge=0, description="Demanda hídrica relativa a la rotación actual (1.0 = igual)."
    )
    risk_level: Level | None = None


class EvidenceBreakdown(BaseModel):
    """Las 4 fuentes de evidencia que pide el desafío, siempre separadas."""

    nasa_data: list[str] = Field(description="Qué muestran los datos NASA.")
    local_soil: list[str] = Field(description="Qué depende del suelo local.")
    producer: list[str] = Field(description="Qué depende del productor.")
    needs_validation: list[str] = Field(description="Qué requiere validación agronómica.")


class Recommendation(BaseModel):
    rotation_id: str
    summary: str
    why: str
    benefits: list[str]
    risks: list[str]
    information_gaps: list[str]
    evidence: EvidenceBreakdown
    requires_agronomist: bool = True
    generated_by: str = Field(default="plantilla", pattern="^(plantilla|llm)$")


class CompareRequest(BaseModel):
    field_id: str
    rotation_ids: list[str] | None = Field(
        default=None, description="Si se omite, se usan todas las rotaciones del lote."
    )
    priorities: Priorities | None = None
    scenario_id: str | None = None


class CompareResult(BaseModel):
    field_id: str
    priorities: Priorities
    ranking: list[RotationScore]


class RotationDetail(BaseModel):
    rotation: Rotation
    score: RotationScore | None
    recommendation: Recommendation | None
    risk_flags: list[RiskFlag]
    assumptions: list[Assumption]
