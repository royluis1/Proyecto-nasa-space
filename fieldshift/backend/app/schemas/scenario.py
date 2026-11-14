"""Escenarios climáticos. Los rangos admitidos son supuestos de diseño, no proyecciones."""

from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import Level
from app.schemas.common import RiskFlag
from app.schemas.priority import Priorities
from app.schemas.rotation import RotationScore, ScenarioInput

Scenario = ScenarioInput


class ScenarioRequest(BaseModel):
    field_id: str
    scenarios: list[Scenario] = Field(min_length=1, max_length=16)
    priorities: Priorities | None = None


class ScenarioRotationNote(BaseModel):
    """Qué cambia para una rotación en el escenario: riesgos y explicación recalculados."""

    rotation_id: str
    summary: str
    why: str
    risks: list[str]
    risk_level: Level | None = None
    risk_flags: list[RiskFlag] = []


class ScenarioResult(BaseModel):
    scenario: Scenario
    recommended_rotation_id: str | None = None
    ranking: list[RotationScore] = []
    rotations: list[ScenarioRotationNote] = Field(default=[], description="Riesgos y explicación de cada rotación en este escenario.")
    warnings: list[str] = []


class ScenarioPreset(BaseModel):
    scenario: Scenario
    group: Literal["clima", "eventos", "lluvia", "temperatura", "riego"]
    help: str
