from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import Confidence
from app.schemas.common import Assumption, DataSource
from app.schemas.field import FieldOut
from app.schemas.priority import Priorities
from app.schemas.rotation import ClimateInputSummary, Recommendation, Rotation, RotationScore, ScenarioInput


class ScenarioResilience(BaseModel):
    """Cómo aguanta una rotación los escenarios simulados."""

    rotation_id: str
    mean_total: float
    worst_total: float
    worst_scenario: str
    worst_rank: int
    wins: int = Field(description="Escenarios en los que queda primera.")
    max_drop: float = Field(description="Mayor caída de puntaje frente al año normal.")


class ReportRequest(BaseModel):
    field_id: str
    priorities: Priorities | None = None
    scenario: ScenarioInput | None = Field(default=None, description="Escenario del reporte. Por defecto, el año normal.")
    scenario_ids: list[str] | None = Field(
        default=None, description="Escenarios predefinidos para la tabla de resistencia. [] = sin tabla; None = todos."
    )
    format: Literal["json", "csv"] = "json"


class Report(BaseModel):
    generated_at: datetime
    field: FieldOut
    priorities: Priorities
    weights: dict[str, float]
    climate: ClimateInputSummary
    scenario: ScenarioInput | None = None
    rotations: list[Rotation]
    ranking: list[RotationScore]
    explanations: dict[str, str]
    recommended_rotation_id: str
    recommendation: Recommendation
    confidence: Confidence
    resilience: list[ScenarioResilience] = []
    sources: list[DataSource]
    assumptions: list[Assumption]
    warnings: list[str]
    disclaimer: str
