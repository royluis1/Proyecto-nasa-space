"""Cultivo del catálogo editable (app/data/crops.json).

Los atributos son cualitativos (bajo / medio / alto) o rangos. No se cargan valores
precisos sin fuente: los únicos números puntuales son los Kc de FAO-56, con su fuente.
"""

from pydantic import BaseModel, Field, model_validator

from app.models.enums import Confidence, CropCycle, CropFamily, CropGroup, CropScale, Level


class Range(BaseModel):
    min: float
    max: float
    unit: str

    @model_validator(mode="after")
    def _ordered(self) -> "Range":
        if self.min > self.max:
            raise ValueError("min no puede ser mayor que max.")
        return self


class CropCalendar(BaseModel):
    """Calendario típico: mes de siembra y último mes en el lote (cosecha o secado)."""

    start_month: int = Field(ge=1, le=12)
    end_month: int = Field(ge=1, le=12)


class KcValues(BaseModel):
    """Coeficientes de cultivo tipo FAO-56 (inicial, medio, final)."""

    ini: float = Field(ge=0, le=1.5)
    mid: float = Field(ge=0, le=1.5)
    end: float = Field(ge=0, le=1.5)


class RotationCompatibility(BaseModel):
    good_predecessors: list[str] = Field(default=[], description="Antecesores recomendados (ids de cultivo).")
    avoid_predecessors: list[str] = Field(default=[], description="Antecesores a evitar (enfermedades, plagas, agua).")
    return_interval_years: Range = Field(description="Cada cuántos años, como mínimo, conviene volver a sembrarlo en el lote.")
    notes: str | None = None


class Crop(BaseModel):
    id: str = Field(examples=["soja"])
    scale: CropScale = Field(default=CropScale.CAMPO, description="A qué perfil pertenece: huerta (m²) o campo (hectáreas).")
    name: str = Field(description="Nombre común.")
    scientific_name: str
    group: CropGroup
    family: CropFamily
    cycle: CropCycle
    cycle_months: Range = Field(description="Duración aproximada en el lote, en meses.")
    sowing_months: list[int] = Field(description="Meses de siembra (1-12).", examples=[[11, 12]])
    sowing_window: str = Field(description="Época de siembra en texto.")
    default_calendar: CropCalendar
    water_requirement: Level = Field(description="Requerimiento hídrico relativo entre los cultivos del catálogo.")
    drought_tolerance: Level
    heat_tolerance: Level
    frost_tolerance: Level
    root_depth: Level = Field(description="bajo = superficial, medio, alto = profundo.")
    organic_matter_contribution: Level
    soil_cover: Level
    fixes_nitrogen: bool
    nitrogen_fixation: Level | None = Field(default=None, description="Capacidad de fijación. None = no fija.")
    erosion_risk: Level = Field(description="Riesgo de erosión que deja el cultivo (poco rastrojo = alto).")
    forage_value: Level
    main_use: list[str]
    relative_yield: Level | None = Field(
        default=None, description="Rendimiento relativo esperado en San Luis. None = no se cosecha."
    )
    relative_income: Level | None = Field(default=None, description="None para coberturas sin cosecha.")
    local_market: Level | None = Field(default=None, description="Disponibilidad de mercado local. None = no se vende.")
    pest_risk: Level = Field(description="Riesgo de plagas y enfermedades, que sube con la repetición.")
    is_cover_crop: bool = False
    rotation: RotationCompatibility
    kc: KcValues | None = None
    kc_source: str | None = None
    ky: float | None = Field(default=None, ge=0, le=2, description="Respuesta del rendimiento al déficit hídrico (FAO-33). None = no se cosecha.")
    ky_source: str | None = None
    agronomic_notes: str
    sources: list[str] = Field(min_length=1)
    confidence: Confidence

    @model_validator(mode="after")
    def _check(self) -> "Crop":
        if not self.sowing_months or any(m < 1 or m > 12 for m in self.sowing_months):
            raise ValueError("sowing_months debe tener al menos un mes entre 1 y 12.")
        if self.default_calendar.start_month not in self.sowing_months:
            raise ValueError(f"{self.id}: el calendario por defecto debe empezar en un mes de siembra.")
        if self.fixes_nitrogen != (self.nitrogen_fixation is not None):
            raise ValueError(f"{self.id}: fixes_nitrogen y nitrogen_fixation no coinciden.")
        if self.kc is not None and not self.kc_source:
            raise ValueError(f"{self.id}: los Kc necesitan fuente.")
        if self.ky is not None and not self.ky_source:
            raise ValueError(f"{self.id}: el Ky necesita fuente.")
        return self
