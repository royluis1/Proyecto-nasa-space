"""Pronóstico (Open-Meteo, no es NASA), alertas tempranas y panel de huerta."""

import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import DataStatus, Level, Severity

Profile = Literal["huerta", "agricultor"]


class PlaceRequest(BaseModel):
    field_id: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class ForecastRequest(PlaceRequest):
    days: int = Field(default=10, ge=1, le=16)


class ForecastDay(BaseModel):
    date: dt.date
    tmax_c: float | None
    tmin_c: float | None
    precip_mm: float | None
    precip_probability_pct: float | None = None
    et0_mm: float | None = Field(default=None, description="Evapotranspiración de referencia FAO-56 calculada por Open-Meteo.")
    wind_max_kmh: float | None = None


class SourceInfo(BaseModel):
    """Lo que se muestra en pantalla de cada dato: fuente, fecha de consulta y tipo."""

    name: str = Field(examples=["NASA POWER"])
    is_nasa: bool
    kind: Literal["modelado", "observado", "pronóstico", "estimado", "supuesto"]
    retrieved_at: dt.datetime | None
    origin: DataStatus | None = None
    origin_label: str | None = None
    detail: str | None = None


class Forecast(BaseModel):
    latitude: float
    longitude: float
    timezone: str | None
    days: list[ForecastDay]
    source: SourceInfo


class AlertsRequest(PlaceRequest):
    profile: Profile = "agricultor"


class Alert(BaseModel):
    id: str
    kind: Literal["helada", "calor", "lluvia_intensa", "falta_de_agua", "suelo_seco", "viento"]
    severity: Severity
    title: str
    message: str
    start: dt.date | None = None
    end: dt.date | None = None
    source: str = Field(description="De dónde sale: Open-Meteo (pronóstico), NASA POWER, NASA SMAP.")


class RainSummary(BaseModel):
    days: int
    total_mm: float | None
    normal_mm: float | None = Field(description="Lo normal para esas fechas (NASA POWER, promedio de 10 años).")
    pct_of_normal: float | None
    start: dt.date | None
    end: dt.date | None
    source: SourceInfo


class AlertsResult(BaseModel):
    profile: Profile
    latitude: float
    longitude: float
    alerts: list[Alert]
    forecast: Forecast | None
    past_rain: RainSummary | None
    future_rain_mm: float | None = Field(description="Lluvia pronosticada para los próximos días (Open-Meteo).")
    sources: list[SourceInfo]
    warnings: list[str]


class FrostInfo(BaseModel):
    frost_days_per_year: float | None
    frost_months: list[int] = Field(description="Meses con heladas en al menos 1 de cada 5 años.")
    last_frost_typical: str | None = Field(description="Fecha típica de la última helada de la primavera (día/mes, 8 de cada 10 años antes).")
    first_frost_typical: str | None = Field(description="Fecha típica de la primera helada del otoño (día/mes, 8 de cada 10 años después).")
    source: SourceInfo


class IrrigationInfo(BaseModel):
    weekly_l_per_m2: float = Field(description="Agua a reponer por semana en esta época (NASA POWER, promedio de 10 años; 1 mm = 1 litro por m²).")
    with_forecast_l_per_m2: float | None = Field(default=None, description="Lo mismo para los próximos 7 días, con la lluvia y la ET0 pronosticadas.")
    daily_l_per_m2: float
    basis: str = Field(description="Cómo se calculó.")
    et0_weekly_mm: float
    rain_weekly_mm: float
    source: SourceInfo


class HeatInfo(BaseModel):
    hot_days_per_year: float | None
    hot_months: list[int]
    next_hot_days: int = Field(description="Días con más de 35 °C en el pronóstico.")
    source: SourceInfo


class PlantingOption(BaseModel):
    """Hortaliza cuya época de siembra incluye este mes, con la evidencia para que decida la persona.

    No es una recomendación: ordena el dato NASA (heladas/calor del mes) frente al parámetro del cultivo.
    """

    crop_id: str
    crop_name: str
    frost_tolerance: Level
    heat_tolerance: Level
    evidence: list[str] = Field(description="Qué dato NASA y qué parámetro del cultivo sostienen esta opción.")
    cautions: list[str] = Field(default=[], description="Riesgos del mes para este cultivo (helada, calor).")


class HuertaPanel(BaseModel):
    """Panel de huerta: escala de pocos m². Solo NASA POWER + pronóstico (Open-Meteo).

    No lleva SMAP (9 km) ni MODIS/NDVI (250 m): esa resolución no puede describir una huerta.
    """

    field_id: str | None
    name: str | None
    latitude: float
    longitude: float
    frost: FrostInfo
    irrigation: IrrigationInfo
    heat: HeatInfo
    past_rain: RainSummary | None
    forecast: Forecast | None
    sowing_now: list[PlantingOption] = Field(description="Qué sembrar este mes según el catálogo, con evidencia; sin 'recomendado'.")
    alerts: list[Alert]
    tips: list[str]
    sources: list[SourceInfo]
    warnings: list[str]
