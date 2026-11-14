"""Escenarios climáticos. Los rangos admitidos son supuestos de diseño, no proyecciones."""

from pydantic import BaseModel, Field

from app.schemas.priority import Priorities
from app.schemas.rotation import RotationScore


class Scenario(BaseModel):
    id: str = Field(examples=["seco-20"])
    name: str = Field(examples=["Lluvia -20%"])
    rain_delta_pct: float = Field(default=0, ge=-50, le=30)
    temp_delta_c: float = Field(default=0, ge=0, le=3)
    dry_year: bool = Field(default=False, description="Usar el año más seco observado como análogo.")
    irrigation: bool = False


class ScenarioRequest(BaseModel):
    field_id: str
    scenarios: list[Scenario] = Field(min_length=1, max_length=8)
    priorities: Priorities | None = None


class ScenarioResult(BaseModel):
    scenario: Scenario
    ranking: list[RotationScore] = []
