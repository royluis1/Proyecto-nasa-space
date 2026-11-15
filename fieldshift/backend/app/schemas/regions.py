"""Provincias, zonas climáticas derivadas de NASA POWER, aptitud de cultivos, transición, suelo estimado y perfil automático."""

import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.enums import Confidence, DataStatus, Level, SoilTexture

ZoneClass = Literal["arido", "semiarido", "subhumedo_seco", "humedo"]
VALIDATION = "Requiere validación agronómica local."


class ProvincesOut(BaseModel):
    source: str
    license: str
    note: str | None
    generated_at: str | None
    features: list[dict[str, Any]] = Field(description="GeoJSON Features: properties {id, name, has_zones, zones_origin}.")


class ZoneClimate(BaseModel):
    precip_mm: float
    et0_mm: float
    deficit_mm: float = Field(description="ET0 - lluvia, promedio anual.")
    aridity_index: float = Field(description="Lluvia / ET0 (UNEP).")
    hot_days: float = Field(description="Días por año con Tmax > 35 °C.")
    frost_days: float = Field(description="Días por año con Tmin <= 2 °C.")
    precip_cv_pct: float | None
    years_other_class_pct: float = Field(description="% de años en que la celda cae en otra zona.")


class CropSuitability(BaseModel):
    crop_id: str
    crop_name: str
    level: Level = Field(description="Aptitud orientativa: alto, medio o bajo.")
    reasons: list[str]
    risks: list[str]
    depends_on: list[str] = Field(description="Lo que la zona no captura: suelo y manejo.")
    confidence: Confidence
    note: str = VALIDATION


class ZoneSummary(BaseModel):
    zone_id: str
    zone_class: ZoneClass
    label: str
    province_id: str
    climate: ZoneClimate
    cells: int
    area_km2: float
    origin: DataStatus
    origin_label: str
    period: str
    method: str
    generated_at: str | None


class ZonesOut(BaseModel):
    province_id: str
    province_name: str
    available: bool
    title: str | None = None
    origin: DataStatus | None = None
    origin_label: str | None = None
    period: str | None = None
    method: str | None = None
    thresholds: dict[str, str] | None = None
    generated_at: str | None = None
    warning: str | None = None
    zones: list[dict[str, Any]] = Field(default=[], description="GeoJSON Features de zonas, con clima y aptitud resumida.")
    cells: list[dict[str, Any]] = Field(default=[], description="GeoJSON Features de las celdas de POWER (resolución real del dato).")


class TransitionOption(BaseModel):
    title: str
    detail: str
    reason: str
    source: str


class Transition(BaseModel):
    is_transition: bool
    reasons: list[str]
    message: str | None
    other_zone_class: ZoneClass | None
    other_zone_label: str | None
    distance_to_border_km: float | None
    aridity_margin: float | None = Field(description="Distancia del índice de aridez al límite de clase más cercano.")
    years_other_class_pct: float | None
    options: list[TransitionOption] = []
    suitability_other: list[CropSuitability] = Field(default=[], description="Aptitud si el año se comporta como la otra zona.")


class ZoneCell(BaseModel):
    cell_id: str
    center_lat: float
    center_lon: float
    climate: ZoneClimate


class ZoneAt(BaseModel):
    latitude: float
    longitude: float
    province_id: str
    province_name: str
    zones_available: bool
    zone: ZoneSummary | None = None
    cell: ZoneCell | None = None
    transition: Transition | None = None
    top_crops: list[CropSuitability] = []
    note: str | None = None


class ZoneSuitability(BaseModel):
    zone: ZoneSummary
    crops: list[CropSuitability]


class SoilEstimate(BaseModel):
    """Suelo ESTIMADO desde un mapa de suelos (no se mide desde satélite). El análisis de laboratorio tiene prioridad."""

    source: str
    resolution: str
    depth: str
    label: Literal["estimado"] = "estimado"
    origin: DataStatus
    origin_label: str
    retrieved_at: dt.datetime | None
    clay_pct: float | None
    sand_pct: float | None
    silt_pct: float | None
    texture_usda: str | None = Field(description="Clase textural USDA.")
    texture: SoilTexture | None = Field(description="Clase de AgroOrbit.")
    organic_matter_pct: float | None = Field(description="Materia orgánica = carbono orgánico x 1,724 (factor de van Bemmelen).")
    organic_matter: Level | None
    note: str


class AutoProfile(BaseModel):
    """Lo que AgroOrbit completa solo al cargar el campo. Lo que carga el productor siempre pisa esto."""

    soil_estimate: SoilEstimate | None
    soil_applied: list[str] = Field(description="Datos del suelo que se completaron con la estimación (los que el productor no cargó).")
    zone: ZoneAt | None
    top_crops: list[CropSuitability]
    warnings: list[str]
    generated_at: dt.datetime


# --- humedad del suelo satelital por lote ---


class MoisturePoint(BaseModel):
    date: dt.date
    value: float | None


class SoilMoistureProduct(BaseModel):
    product: str
    name: str
    label: Literal["observado", "modelado"]
    depth: str | None
    resolution: str
    temporal_resolution: str
    units: str
    last_observation: dt.date | None = Field(description="Última observación disponible (no es tiempo real).")
    last_value: float | None
    recent: list[MoisturePoint] = Field(description="Serie de los últimos días con dato.")
    month: int | None
    month_mean: float | None = Field(description="Promedio del mes de la última observación.")
    month_normal: float | None = Field(description="Promedio del mismo mes en los otros años.")
    anomaly_pct: float | None
    reading: str = Field(description="Lectura en palabras.")
    origin: DataStatus
    origin_label: str
    retrieved_at: dt.datetime | None
    limitations: list[str]


class FieldSoilMoisture(BaseModel):
    field_id: str
    title: str = "Humedad del suelo satelital (contexto regional)"
    context: str = ("SMAP mide desde el espacio en píxeles de ~9 km: describe la zona, no tu lote. Se muestra la última "
                    "observación disponible, con días de atraso: no es tiempo real ni un sensor en el campo.")
    products: list[SoilMoistureProduct]
    sensors: str = "Sensores propios del productor: todavía no están conectados (punto de entrada preparado para el futuro)."
    warnings: list[str]


# --- Landsat/HLS por sectores y ECOSTRESS ---


class Sector(BaseModel):
    id: str
    name: str = Field(examples=["Noreste"])
    latitude: float
    longitude: float
    observations: int
    mean_ndvi: float | None
    peak_ndvi: float | None = Field(description="Percentil 90 del NDVI del período.")
    bare_pct: float | None = Field(description="% de observaciones con NDVI por debajo del umbral de suelo desnudo.")
    vs_field_pct: float | None = Field(description="Diferencia del NDVI medio contra la mediana del lote, en %.")
    vigor: Literal["más débil", "parecido", "más vigoroso"] | None


class FieldSectors(BaseModel):
    field_id: str
    title: str = "Vigor y suelo desnudo por sector (Landsat, 30 m)"
    product: str
    resolution: str
    label: Literal["observado"] = "observado"
    period: str
    bare_threshold: float
    sectors: list[Sector]
    weakest: str | None
    barest: str | None
    reading: str
    method: str
    origin: DataStatus
    origin_label: str
    retrieved_at: dt.datetime | None
    task_id: str | None = None
    limitations: list[str]
    warnings: list[str]


class HeatReading(BaseModel):
    product: str
    name: str
    label: Literal["observado", "modelado"]
    resolution: str
    observations: int
    last_observation: dt.date | None
    origin: DataStatus
    origin_label: str
    limitations: list[str]


class FieldHeatStress(BaseModel):
    field_id: str
    title: str = "Calor y estrés de la zona (ECOSTRESS)"
    period: str
    lst: HeatReading | None
    lst_summer_mean_c: float | None = Field(description="Temperatura media de la superficie en verano (dic-feb), °C.")
    lst_max_c: float | None
    hot_surface_obs: int | None = Field(description="Observaciones con la superficie a más de 45 °C.")
    esi: HeatReading | None
    esi_recent: float | None = Field(description="ESI medio de los últimos 90 días con dato.")
    esi_normal: float | None = Field(description="ESI medio de los mismos meses en los otros años.")
    stress_level: Literal["bajo", "medio", "alto"] | None
    reading: str
    warnings: list[str]
