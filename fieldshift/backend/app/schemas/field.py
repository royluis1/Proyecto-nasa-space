"""Ubicación, perfil de suelo y campo/lote."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import Level, SoilTexture
from app.models.provenance import Provenance
from app.utils.validators import round_coord


class Location(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    lat: float = Field(ge=-90, le=90, description="Latitud en grados decimales (WGS84).", examples=[-33.85])
    lon: float = Field(ge=-180, le=180, description="Longitud en grados decimales (WGS84).", examples=[-65.2])
    elevation_m: float | None = Field(default=None, description="De SRTM, si está disponible.")
    slope_pct: float | None = Field(default=None, ge=0, description="De SRTM, si está disponible.")

    @field_validator("lat", "lon")
    @classmethod
    def _round(cls, v: float) -> float:
        return round_coord(v)


class SoilProfile(BaseModel):
    texture: SoilTexture | None = None
    effective_depth: Level | None = Field(default=None, description="Somera=bajo, media, profunda=alto.")
    organic_matter: Level | None = Field(
        default=None, description="Categoría. No se mide desde satélite: siempre es estimación o dato de laboratorio."
    )
    lab_analysis: bool = Field(default=False, description="True si hay análisis de suelo de laboratorio.")
    provenance: Provenance


class FieldCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, examples=["Lote Norte"])
    farm_name: str | None = Field(default=None, max_length=100)
    location: Location
    area_ha: float = Field(gt=0, le=100_000, examples=[250])
    irrigated: bool = False
    soil_profile: SoilProfile | None = None


class FieldOut(FieldCreate):
    """Campo/lote guardado."""

    id: str
    current_rotation_id: str | None = None
    sample_note: str | None = Field(
        default=None, description="Indica si los datos del lote son reales o ilustrativos."
    )
