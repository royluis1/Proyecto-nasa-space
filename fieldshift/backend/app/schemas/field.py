"""Ubicación, perfil de suelo y campo/lote."""

from typing import Literal

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


class Boundary(BaseModel):
    """Polígono del lote en GeoJSON (WGS84). Se guarda para futuras consultas por área (Sentinel-2, MODIS)."""

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[tuple[float, float]]] = Field(description="Anillos [lon, lat]; el primero es el borde exterior.")

    @field_validator("coordinates")
    @classmethod
    def _ring(cls, rings: list[list[tuple[float, float]]]) -> list[list[tuple[float, float]]]:
        if not rings or len(rings[0]) < 4:
            raise ValueError("El polígono necesita al menos 3 vértices y cerrar en el primero.")
        for lon, lat in rings[0]:
            if not (-180 <= lon <= 180 and -90 <= lat <= 90):
                raise ValueError("Coordenadas del polígono fuera de rango.")
        if rings[0][0] != rings[0][-1]:
            raise ValueError("El polígono tiene que cerrar: el último vértice debe repetir el primero.")
        return rings


class FieldCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, examples=["Lote Norte"])
    farm_name: str | None = Field(default=None, max_length=100)
    location: Location
    area_ha: float = Field(gt=0, le=100_000, examples=[250])
    irrigated: bool = False
    soil_profile: SoilProfile | None = None
    current_crop: str | None = Field(default=None, description="Cultivo actual (id del catálogo).")
    crop_history: list[str] = Field(
        default=[], max_length=10, description="Cultivos principales de campañas anteriores, del más antiguo al más reciente."
    )
    drainage: Level | None = Field(default=None, description="Drenaje: bajo = anegable, alto = excesivo. Todavía no influye en el puntaje.")
    budget: Level | None = Field(default=None, description="Presupuesto disponible para cambios. Todavía no influye en el puntaje.")
    boundary: Boundary | None = None


class FieldOut(FieldCreate):
    """Campo/lote guardado."""

    id: str
    current_rotation_id: str | None = None
    sample_note: str | None = Field(
        default=None, description="Indica si los datos del lote son reales o ilustrativos."
    )
