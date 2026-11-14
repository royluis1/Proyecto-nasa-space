"""Relieve del lote a partir de SRTM (NASA, vía Earthdata Login)."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import DataStatus


class TerrainRequest(BaseModel):
    field_id: str | None = None
    latitude: float | None = Field(default=None, ge=-60, le=60, description="SRTM cubre de 60° S a 60° N.")
    longitude: float | None = Field(default=None, ge=-180, le=180)
    radius_m: float | None = Field(default=None, ge=60, le=5000, description="Por defecto, según la superficie del lote (o 300 m).")

    @model_validator(mode="after")
    def _where(self) -> "TerrainRequest":
        if not self.field_id and (self.latitude is None or self.longitude is None):
            raise ValueError("Indicá field_id, o latitude y longitude.")
        return self


class TerrainSummary(BaseModel):
    product: Literal["SRTMGL1", "SRTMGL3"]
    tile: str = Field(examples=["S34W066"])
    latitude: float
    longitude: float
    area: str = Field(description="Zona analizada: polígono del lote o círculo alrededor del punto.")
    elevation_mean_m: float
    elevation_min_m: float
    elevation_max_m: float
    slope_mean_pct: float
    slope_p90_pct: float = Field(description="El 10 % del lote tiene más pendiente que esto.")
    slope_max_pct: float
    slope_class: Literal["plano", "suave", "moderada", "fuerte"]
    resolution_m: float
    origin: DataStatus
    origin_label: str
    interpretation: str
    limitations: list[str]


class EarthdataStatus(BaseModel):
    configured: bool
    method: Literal["token", "usuario", "ninguno"]
    note: str
