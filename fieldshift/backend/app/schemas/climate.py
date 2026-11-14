"""Request y response de POST /climate-summary (NASA POWER)."""

import datetime as dt
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import DataStatus, PowerParameter
from app.utils.validators import round_coord, validate_date_range


class DateRange(BaseModel):
    start: dt.date = Field(examples=["2015-01-01"])
    end: dt.date = Field(examples=["2025-12-31"])

    @model_validator(mode="after")
    def _valid(self) -> "DateRange":
        validate_date_range(self.start, self.end)
        return self


class ClimateSummaryRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    field_id: str | None = Field(default=None, description="Alternativa a latitud/longitud: usa las del lote.")
    latitude: float | None = Field(default=None, ge=-90, le=90, examples=[-33.85])
    longitude: float | None = Field(default=None, ge=-180, le=180, examples=[-65.2])
    start_date: dt.date = Field(examples=["2015-01-01"])
    end_date: dt.date = Field(examples=["2025-12-31"])
    community: Literal["AG", "RE", "SB"] = "AG"
    parameters: list[PowerParameter] | None = Field(
        default=None,
        max_length=20,
        description="Si se omite, se piden los 8 parámetros. T2M, T2M_MAX, T2M_MIN y PRECTOTCORR se agregan siempre.",
    )
    include_daily: bool = Field(default=True, description="Incluir la serie diaria completa (respuesta más grande).")

    @model_validator(mode="after")
    def _check(self) -> "ClimateSummaryRequest":
        if self.field_id is None and (self.latitude is None or self.longitude is None):
            raise ValueError("Indicá field_id o latitude y longitude.")
        if self.latitude is not None:
            self.latitude = round_coord(self.latitude)
        if self.longitude is not None:
            self.longitude = round_coord(self.longitude)
        validate_date_range(self.start_date, self.end_date)
        return self


class ParameterInfo(BaseModel):
    units: str
    longname: str
    missing_days: int


class ClimateSource(BaseModel):
    provider: str = "NASA POWER"
    community: str
    endpoint: str
    resolution: str = "Meteorología ~0.5° x 0.625° (MERRA-2/GEOS); solar ~1° (CERES)"
    origin: DataStatus
    origin_label: str
    retrieved_at: dt.datetime
    sample_site: str | None = None


class DailyRecord(BaseModel):
    date: dt.date
    T2M: float | None = None
    T2M_MAX: float | None = None
    T2M_MIN: float | None = None
    PRECTOTCORR: float | None = None
    RH2M: float | None = None
    WS2M: float | None = None
    ALLSKY_SFC_SW_DWN: float | None = None
    PS: float | None = None
    ET0: float | None = Field(default=None, description="mm/día, estimado (FAO-56).")
    ET0_method: Literal["PM", "HG"] | None = None


class MonthlyRecord(BaseModel):
    year: int
    month: int
    precip_mm: float | None
    t2m_mean: float | None
    tmax_mean: float | None
    tmin_mean: float | None
    heat_days: int
    et0_mm: float | None
    balance_mm: float | None = Field(description="Lluvia - ET0 (negativo = déficit).")
    missing_precip_days: int
    valid: bool


class MonthlyClimatology(BaseModel):
    month: int
    precip_mm: float | None
    t2m_mean: float | None
    tmax_mean: float | None
    tmin_mean: float | None
    heat_days: float | None
    et0_mm: float | None
    years: int


class SeasonalSummary(BaseModel):
    season: str
    months: list[int]
    precip_mm: float | None
    t2m_mean: float | None
    heat_days: float | None
    years: int


class AnnualRecord(BaseModel):
    year: int
    complete: bool
    precip_mm: float | None
    precip_anomaly_pct: float | None
    t2m_mean: float | None
    tmax_max: float | None
    tmin_min: float | None
    heat_days: int
    et0_mm: float | None
    deficit_mm: float | None
    classification: Literal["seco", "normal", "húmedo"] | None
    heat_stress: bool


class Extreme(BaseModel):
    value: float | None
    date: dt.date | None = None


class VariableStats(BaseModel):
    mean: float | None
    min: Extreme
    max: Extreme
    units: str


class TrendResult(BaseModel):
    slope_per_decade: float | None
    units: str
    kendall_tau: float | None
    p_value: float | None
    significant: bool
    n_years: int
    method: str = "Pendiente de Sen + test de Mann-Kendall (años completos)"


class Trends(BaseModel):
    precipitation: TrendResult
    temperature: TrendResult


class HeatSummary(BaseModel):
    threshold_c: float
    mean_days_per_year: float | None
    frequency_pct_by_month: list[float | None] = Field(description="12 valores, enero a diciembre.")
    heat_stress_years: list[int]


class PrecipitationSummary(BaseModel):
    total_mm: float | None
    mean_annual_mm: float | None
    max_daily: Extreme
    dry_years: list[int]
    wet_years: list[int]


class Variability(BaseModel):
    annual_precip_cv_pct: float | None = Field(description="Coeficiente de variación de la lluvia anual.")
    annual_temp_cv_pct: float | None


class WaterDeficit(BaseModel):
    mean_annual_et0_mm: float | None
    mean_annual_precip_mm: float | None
    mean_annual_deficit_mm: float | None = Field(description="Promedio de la suma anual de max(0, ET0 - P) mensual.")
    months_with_deficit_pct: float | None
    method: str
    pm_days_pct: float | None = Field(description="% de días con ET0 por Penman-Monteith (el resto, Hargreaves).")


class MissingDataReport(BaseModel):
    total_days: int
    missing_by_parameter: dict[str, int]
    invalid_months: int
    incomplete_years: list[int]


class ClimateSummary(BaseModel):
    latitude: float
    longitude: float
    field_id: str | None = None
    grid_elevation_m: float | None = None
    period: DateRange
    source: ClimateSource
    parameters: dict[str, ParameterInfo]
    labels: dict[str, str] = Field(description="Etiqueta de honestidad por bloque de resultados.")
    stats: dict[str, VariableStats]
    precipitation: PrecipitationSummary
    heat: HeatSummary
    trends: Trends
    variability: Variability
    water_deficit: WaterDeficit
    annual: list[AnnualRecord]
    seasonal: list[SeasonalSummary]
    monthly_climatology: list[MonthlyClimatology]
    monthly: list[MonthlyRecord]
    daily: list[DailyRecord] | None = None
    missing: MissingDataReport
    limitations: list[str]
