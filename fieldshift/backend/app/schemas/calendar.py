"""Calendario agrícola de 2 a 4 campañas para una rotación."""

from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import Level
from app.schemas.priority import Priorities
from app.schemas.rotation import Rotation, ScenarioInput

Stage = Literal["siembra", "desarrollo", "cosecha", "barbecho"]
Cover = Literal["cultivo", "cobertura", "rastrojo", "desnudo"]


class CalendarRequest(BaseModel):
    field_id: str
    rotation_id: str | None = Field(default=None, description="Por defecto, la recomendada para el escenario.")
    campaigns: int = Field(default=3, ge=2, le=4, description="Campañas (julio a junio) a mostrar.")
    first_campaign_year: int | None = Field(
        default=None, ge=2000, le=2100, description="Año en que empieza la primera campaña. Por defecto, la próxima."
    )
    scenario: ScenarioInput | None = None
    priorities: Priorities | None = None


class TimelineMonth(BaseModel):
    index: int = Field(ge=0, description="Posición en la línea de tiempo.")
    campaign: int = Field(ge=1)
    year: int
    month: int = Field(ge=1, le=12)
    label: str = Field(examples=["nov 2027"])
    crop_id: str | None
    crop_name: str | None
    is_cover_crop: bool = False
    stage: Stage
    harvest_of: str | None = Field(default=None, description="Cultivo que se cosecha este mes si otro se siembra en el mismo mes.")
    cover: Cover = Field(description="cultivo/cobertura = vivo; rastrojo = barbecho con residuo; desnudo = poco o nada de residuo.")
    bare_soil: bool
    heat_risk: Level | None = Field(description="Riesgo de golpe de calor para el cultivo del mes (None en barbecho).")
    water_risk: Level | None = Field(description="Riesgo de déficit hídrico para el cultivo del mes (None en barbecho).")
    heat_days_pct: float = Field(description="% de días con Tmax > 35 °C (NASA POWER, con el escenario).")
    precip_mm: float
    et0_mm: float
    water_stress_pct: float | None = Field(description="Demanda no cubierta después del riego, % (None en barbecho).")


class TimelineCampaign(BaseModel):
    index: int
    label: str = Field(examples=["2027/28"])
    months: list[TimelineMonth]
    covered_months: int
    bare_months: int
    heat_risk_months: int = Field(description="Meses con riesgo de calor alto.")
    water_risk_months: int = Field(description="Meses con riesgo hídrico alto.")


class TimelineAdvice(BaseModel):
    kind: Literal["cobertura", "calor", "agua", "siembra", "rotacion", "datos"]
    severity: Level
    text: str
    campaigns: list[int] = []


class CalendarTimeline(BaseModel):
    field_id: str
    rotation: Rotation
    scenario: ScenarioInput | None
    irrigated: bool
    campaigns: list[TimelineCampaign]
    advice: list[TimelineAdvice]
    recommended_rotation_id: str
    is_recommended: bool
    score_total: float | None
    recommended_total: float | None
    data_used: list[str] = Field(description="Qué datos NASA se usaron y de dónde salieron.")
    assumptions: list[str]
    warnings: list[str]
