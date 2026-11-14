"""Requests y respuestas de POST /soil-moisture (SMAP) y POST /vegetation-index (MODIS NDVI)."""

import datetime as dt
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import DataLabel, DataStatus, Level
from app.utils.validators import round_coord

MAX_CSV_CHARS = 5_000_000


class DataTrace(BaseModel):
    """Trazabilidad de un bloque de datos satelitales."""

    source: str = Field(examples=["NASA SMAP, NSIDC DAAC (vía AppEEARS)"])
    product: str = Field(examples=["SPL4SMGP.008 · Geophysical_Data_sm_rootzone"])
    product_name: str
    label: DataLabel = Field(description="observado (medido por el satélite) o modelado.")
    status: DataStatus = Field(
        description="live = real en vivo, cached = cacheado, uploaded = CSV cargado, sample = muestra."
    )
    status_label: str
    period_start: dt.date
    period_end: dt.date
    last_observation: dt.date | None
    retrieved_at: dt.datetime
    spatial_resolution: str
    temporal_resolution: str
    depth: str | None = None
    latitude: float
    longitude: float
    pixel_site: str | None = Field(default=None, description="Sitio de la muestra o punto del CSV usado.")
    task_id: str | None = Field(default=None, description="Tarea de AppEEARS asociada, si se pidió.")
    citation: str
    limitations: list[str]


class SatelliteRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    field_id: str | None = Field(default=None, description="Alternativa a latitud/longitud: usa las del lote.")
    latitude: float | None = Field(default=None, ge=-90, le=90, examples=[-33.85])
    longitude: float | None = Field(default=None, ge=-180, le=180, examples=[-65.2])
    start_date: dt.date | None = Field(default=None, description="Por defecto, 10 años completos hasta el año pasado.")
    end_date: dt.date | None = None
    csv_content: str | None = Field(
        default=None,
        max_length=MAX_CSV_CHARS,
        description="CSV de AppEEARS (extracción por punto) o `date,value[,qa]` (p. ej. convertido desde GeoTIFF).",
    )
    include_series: bool = Field(default=False, description="Incluir la serie completa.")

    @model_validator(mode="after")
    def _check(self):
        if self.field_id is None and (self.latitude is None or self.longitude is None):
            raise ValueError("Indicá field_id o latitude y longitude.")
        if self.latitude is not None:
            self.latitude = round_coord(self.latitude)
        if self.longitude is not None:
            self.longitude = round_coord(self.longitude)
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("La fecha de inicio no puede ser posterior a la fecha de fin.")
        return self


class QualityReport(BaseModel):
    records: int
    valid: int
    missing_or_fill: int
    bad_quality: int = Field(description="Descartados por la capa de calidad (nubes, nieve, recuperación dudosa).")
    valid_pct: float
    format: str = Field(description="appeears o simple.")
    scaled: bool = Field(description="True si se aplicó el factor de escala del producto.")
    warnings: list[str] = []


class Trend(BaseModel):
    slope_per_decade: float | None
    units: str
    kendall_tau: float | None
    p_value: float | None
    significant: bool
    n_years: int
    method: str = "Pendiente de Sen + test de Mann-Kendall"


# --- SMAP ---


class SoilMoistureRequest(SatelliteRequest):
    product: Literal["SPL4SMGP_rootzone", "SPL4SMGP_surface", "SPL3SMP_E"] = Field(
        default="SPL4SMGP_rootzone", description="Por defecto, SMAP L4 en zona de raíces (0-100 cm)."
    )
    recent_days: int = Field(default=90, ge=15, le=365, description="Ventana para el estrés hídrico relativo.")


class SoilMoisturePoint(BaseModel):
    date: dt.date
    value: float | None


class SoilMoistureMonth(BaseModel):
    year: int
    month: int
    mean: float | None
    days: int
    anomaly_z: float | None = Field(description="Anomalía estandarizada frente al mismo mes de otros años.")
    drought: bool = Field(description="z <= -1: sequía de humedad de suelo.")
    low: bool = Field(description="Por debajo del percentil 25 de todos los meses.")


class MonthlyClimatologySM(BaseModel):
    month: int
    mean: float | None
    std: float | None
    years: int


class DroughtEvent(BaseModel):
    start: str = Field(examples=["2022-11"])
    end: str
    months: int
    min_anomaly_z: float


class WaterStress(BaseModel):
    window_start: dt.date
    window_end: dt.date
    recent_mean: float | None
    normal_mean: float | None = Field(description="Promedio de los mismos meses en el resto del período.")
    anomaly_pct: float | None
    percentile: float | None = Field(
        description="Posición de la ventana reciente frente a la misma época de otros años (0-100)."
    )
    stress_index: float | None = Field(description="0 = sin estrés relativo, 1 = el más seco del registro.")
    level: Level | None
    method: str = "Promedio de los últimos días frente a la misma época de los otros años (percentil)."


class SoilMoistureSummary(BaseModel):
    variable: str
    units: str
    trace: DataTrace
    quality: QualityReport
    mean: float | None
    min: SoilMoisturePoint
    max: SoilMoisturePoint
    drought_frequency_pct: float | None = Field(description="% de meses con sequía de humedad de suelo (z <= -1).")
    drought_months: int
    drought_events: list[DroughtEvent]
    low_moisture_months: list[SoilMoistureMonth] = Field(description="Meses por debajo del percentil 25 (absoluto).")
    typically_dry_months: list[int] = Field(
        description="Meses del año con la humedad media más baja (tercio inferior)."
    )
    monthly_climatology: list[MonthlyClimatologySM]
    monthly: list[SoilMoistureMonth]
    annual_means: dict[int, float]
    trend: Trend
    water_stress: WaterStress
    series: list[SoilMoisturePoint] | None = None
    assumptions: list[str]


# --- MODIS NDVI ---


class VegetationRequest(SatelliteRequest):
    product: Literal["MOD13Q1", "MYD13Q1", "MOD13A1"] = Field(
        default="MOD13Q1", description="Por defecto, MODIS Terra 250 m."
    )
    bare_threshold: float = Field(
        default=0.3, ge=0.1, le=0.5, description="NDVI por debajo del cual se considera barbecho o suelo desnudo."
    )


class NdviPoint(BaseModel):
    date: dt.date
    ndvi: float | None
    cover_fraction: float | None
    interpolated: bool = False


class FallowPeriod(BaseModel):
    start: dt.date
    end: dt.date
    days: int
    mean_ndvi: float


class Campaign(BaseModel):
    campaign: str = Field(examples=["2023/24"], description="Campaña agrícola de julio a junio.")
    complete: bool
    valid_composites: int
    mean_ndvi: float | None
    peak_ndvi: float | None
    peak_date: dt.date | None
    integrated_ndvi: float | None = Field(
        description="Suma de (NDVI - NDVI de suelo) x días: proxy de biomasa producida."
    )
    cover_fraction: float | None
    bare_fraction: float | None
    growth_cycles: int = Field(
        description="Ciclos de crecimiento detectados (1 = un cultivo, 2 = doble cultivo o cobertura)."
    )
    anomaly_pct: float | None = Field(description="NDVI integrado frente al promedio de las campañas completas.")


class VegetationSummary(BaseModel):
    variable: str = "NDVI"
    trace: DataTrace
    quality: QualityReport
    mean_ndvi: float | None
    cover_fraction_mean: float | None = Field(description="Cobertura vegetal estimada (0-1).")
    cover_method: str
    bare_threshold: float
    bare_soil_fraction: float | None = Field(description="Fracción de compuestos válidos con NDVI bajo el umbral.")
    recent_bare_soil_fraction: float | None = Field(description="Lo mismo en las últimas 3 campañas completas.")
    fallow_periods: list[FallowPeriod]
    monthly_climatology: dict[int, float | None]
    campaigns: list[Campaign]
    best_campaign: str | None
    worst_campaign: str | None
    biomass_trend: Trend
    biomass_trend_pct_per_decade: float | None
    series: list[NdviPoint] | None = None
    assumptions: list[str]
