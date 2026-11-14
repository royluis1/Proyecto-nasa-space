"""Escenarios climáticos. Los rangos admitidos son supuestos de diseño, no proyecciones."""

from pydantic import BaseModel, Field

from app.schemas.priority import Priorities
from app.schemas.rotation import RotationScore, ScenarioInput

Scenario = ScenarioInput


class ScenarioRequest(BaseModel):
    field_id: str
    scenarios: list[Scenario] = Field(min_length=1, max_length=8)
    priorities: Priorities | None = None


class ScenarioResult(BaseModel):
    scenario: Scenario
    recommended_rotation_id: str | None = None
    ranking: list[RotationScore] = []
    warnings: list[str] = []
