"""Cultivo. Campos cualitativos; la base completa se arma en la fase de base de cultivos."""

from pydantic import BaseModel, Field, model_validator

from app.models.enums import Confidence, CropCycle, CropGroup, Level


class KcValues(BaseModel):
    """Coeficientes de cultivo tipo FAO-56 (inicial, medio, final)."""

    ini: float = Field(ge=0, le=1.5)
    mid: float = Field(ge=0, le=1.5)
    end: float = Field(ge=0, le=1.5)


class Crop(BaseModel):
    id: str = Field(examples=["soja"])
    name: str
    group: CropGroup
    cycle: CropCycle
    sowing_months: list[int] = Field(description="Meses de siembra (1-12).", examples=[[11, 12]])
    water_requirement: Level
    drought_tolerance: Level
    heat_tolerance: Level
    frost_tolerance: Level
    organic_matter_contribution: Level
    soil_cover: Level
    fixes_nitrogen: bool
    erosion_risk: Level
    forage_value: Level
    relative_income: Level | None = Field(default=None, description="None para coberturas sin cosecha.")
    kc: KcValues | None = None
    source: str = Field(description="Fuente verificable o 'supuesto a validar'.")
    confidence: Confidence

    @model_validator(mode="after")
    def _check_months(self) -> "Crop":
        if not self.sowing_months or any(m < 1 or m > 12 for m in self.sowing_months):
            raise ValueError("sowing_months debe tener al menos un mes entre 1 y 12.")
        return self
