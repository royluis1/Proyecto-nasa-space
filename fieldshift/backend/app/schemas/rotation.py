"""Rotación, puntaje explicable, recomendación y resultado de la comparación."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.constants import disclaimer
from app.models.enums import (
    AridityZone,
    Confidence,
    DataStatus,
    ImpactDirection,
    Level,
    RotationStrategy,
    ScoreComponentKey,
    SoilTexture,
)
from app.models.provenance import Provenance
from app.schemas.common import Assumption, DataSource, RiskFlag
from app.schemas.field import Location
from app.schemas.priority import Priorities

P_LIMITED = 0.5  # = parameters.LIMITED_IRRIGATION_SHARE (sin importar el motor desde los esquemas)


class RotationStep(BaseModel):
    crop_id: str
    year: int = Field(ge=1, description="Año relativo en que se siembra (1 = primero). La rotación es cíclica.")
    start_month: int = Field(ge=1, le=12)
    end_month: int = Field(ge=1, le=12, description="Si es menor que start_month, termina en el año siguiente.")


class Rotation(BaseModel):
    id: str = Field(examples=["campo-este-actual"])
    field_id: str
    name: str
    strategy: RotationStrategy
    duration_years: int = Field(ge=1, le=6)
    steps: list[RotationStep] = Field(min_length=1)
    description: str | None = None
    origin: Literal["declarada", "generada"] = "declarada"
    rule_ids: list[str] = Field(default=[], description="Reglas o plantillas que generaron la rotación.")
    management: list[str] = Field(default=[], description="Requisitos de manejo para implementarla.")

    @model_validator(mode="after")
    def _steps_within_duration(self) -> "Rotation":
        if any(s.year > self.duration_years for s in self.steps):
            raise ValueError("Hay pasos fuera de la duración de la rotación.")
        return self


# --- Reglas de rotación (app/data/rotation_templates.json) ---


class TemplateConditions(BaseModel):
    zones: list[Literal["semiarido", "subhumedo"]] = ["semiarido", "subhumedo"]
    irrigated: list[bool] = [False, True]


class RotationTemplate(BaseModel):
    id: str
    strategy: RotationStrategy
    name: str
    when: TemplateConditions
    duration_years: int = Field(ge=1, le=6)
    steps: list[RotationStep] = Field(min_length=1)
    rationale: str = Field(description="Justificación agronómica de la plantilla.")
    management: list[str] = []


# --- Perfil, puntaje y explicación ---


class Impact(BaseModel):
    direction: ImpactDirection
    detail: str


class RotationProfile(BaseModel):
    """Características calculadas de la rotación (independientes de las prioridades)."""

    sequence: list[str] = Field(description="Secuencia legible, en orden.")
    duration_years: int
    distinct_crops: int
    water_demand_mm_year: float = Field(description="Demanda hídrica estimada de los cultivos (Kc x ET0), mm/año.")
    water_requirement: Level
    rain_coverage_pct: float = Field(description="% de la demanda cubierta por lluvia efectiva y agua almacenada.")
    deficit_mm_year: float = Field(description="Demanda no cubierta antes del riego, mm/año.")
    irrigation_mm_year: float | None = Field(description="Riego estimado, mm/año. None = secano.")
    relative_water_demand: float | None = Field(description="Demanda relativa a la rotación actual (1,0 = igual).")
    covered_months_pct: float
    bare_months_per_year: float
    soil_impact: Impact
    erosion_impact: Impact
    erosion_risk: Level
    biodiversity_impact: Impact
    relative_income: Level
    implementation_complexity: Level
    benefits: list[str]
    risks: list[str]
    justification: str


class ScoreDriver(BaseModel):
    factor: str = Field(examples=["Meses con cobertura viva"])
    effect: str = Field(pattern="^(sube|baja|neutro)$")
    points: float | None = Field(default=None, description="Puntos que suma o resta al componente.")
    detail: str
    provenance: Provenance


class ScoreComponent(BaseModel):
    key: ScoreComponentKey
    name: str
    value: float | None = Field(ge=0, le=100, description="0 a 100. None = no calculable.")
    weight: float = Field(ge=0, le=1, description="Peso normalizado a partir de las prioridades.")
    drivers: list[ScoreDriver] = []
    provenance: Provenance


class RotationScore(BaseModel):
    rotation_id: str
    scenario_id: str | None = None
    rank: int = Field(ge=1)
    total: float | None = Field(ge=0, le=100)
    uncertainty_low: float | None = Field(default=None, ge=0, le=100)
    uncertainty_high: float | None = Field(default=None, ge=0, le=100)
    components: list[ScoreComponent]
    relative_water_demand: float | None = Field(
        default=None, ge=0, description="Demanda hídrica relativa a la rotación actual (1.0 = igual)."
    )
    risk_level: Level | None = None
    confidence: Confidence = Confidence.BAJA


class EvidenceBreakdown(BaseModel):
    """Las 4 fuentes de evidencia que pide el desafío, siempre separadas."""

    nasa_data: list[str] = Field(description="Qué muestran los datos NASA.")
    local_soil: list[str] = Field(description="Qué depende del suelo local.")
    producer: list[str] = Field(description="Qué depende del productor.")
    needs_validation: list[str] = Field(description="Qué requiere validación agronómica.")


class Recommendation(BaseModel):
    rotation_id: str
    summary: str
    why: str = Field(description="Explicación en lenguaje simple.")
    benefits: list[str]
    risks: list[str]
    assumptions: list[str]
    uncertainties: list[str]
    information_gaps: list[str]
    evidence: EvidenceBreakdown
    validation_note: str
    requires_agronomist: bool = True
    disclaimer: str = Field(default_factory=disclaimer)
    generated_by: str = Field(default="plantilla", pattern="^(plantilla|llm)$")


class RotationEvaluation(BaseModel):
    rotation: Rotation
    profile: RotationProfile
    score: RotationScore
    recommendation: Recommendation
    risk_flags: list[RiskFlag]
    assumption_ids: list[str] = Field(description="Supuestos (ver CompareResult.assumptions) que usa el puntaje.")
    source_ids: list[str]
    confidence: Confidence
    confidence_reasons: list[str]
    warnings: list[str]


# --- Entradas opcionales de sensores (se cargan desde los CSV preprocesados) ---


class SoilMoistureInput(BaseModel):
    """Resumen de SMAP que usa el motor. Se arma solo desde /soil-moisture o se puede enviar a mano."""

    product: Literal["SMAP_L3", "SMAP_L4"] = Field(description="L3: capa superficial (observado). L4: zona de raíces (modelado).")
    anomaly_pct: float = Field(ge=-100, le=300, description="Humedad reciente respecto de la misma época de otros años, en %.")
    period: str | None = Field(default=None, examples=["2025-10-03 a 2025-12-31"])
    drought_frequency_pct: float | None = Field(default=None, ge=0, le=100, description="% de meses con sequía de humedad de suelo.")
    stress_level: Level | None = None
    origin: DataStatus | None = Field(default=None, description="Origen del dato (en vivo, cacheado, cargado o muestra).")


class VegetationInput(BaseModel):
    """Resumen de NDVI que usa el motor. Se arma solo desde /vegetation-index o se puede enviar a mano."""

    product: Literal["MOD13Q1", "MYD13Q1", "MOD13A1"] = "MOD13Q1"
    bare_soil_fraction: float = Field(ge=0, le=1, description="Fracción de compuestos de 16 días con NDVI bajo el umbral.")
    threshold: float = Field(default=0.3, ge=0, le=1)
    mean_ndvi: float | None = Field(default=None, ge=-1, le=1)
    cover_fraction: float | None = Field(default=None, ge=0, le=1, description="Cobertura vegetal estimada promedio.")
    biomass_trend_pct_per_decade: float | None = Field(default=None, description="Tendencia del NDVI integrado por campaña.")
    trend_significant: bool = False
    period: str | None = None
    origin: DataStatus | None = None


# --- Request y resultado ---


class ScenarioInput(BaseModel):
    """Escenario climático aplicado al puntaje (mismos rangos que /scenarios)."""

    id: str = Field(default="base", examples=["seco-20"])
    name: str = Field(default="Clima del período", examples=["Lluvia -20%"])
    rain_delta_pct: float = Field(default=0, ge=-50, le=30)
    temp_delta_c: float = Field(default=0, ge=0, le=3)
    dry_year: bool = Field(default=False, description="Usar el año más seco observado como análogo.")
    irrigation: bool = Field(default=False, description="Compatibilidad: igual a irrigation_level='disponible'.")
    irrigation_level: Literal["lote", "sin_riego", "limitado", "disponible"] = Field(
        default="lote",
        description="Riego del escenario: 'lote' = el del lote; 'sin_riego' = secano; 'limitado' = la mitad de la lámina; "
        "'disponible' = riego pleno (80 % del déficit).",
    )
    heat_wave: bool = Field(default=False, description="Ola de calor en verano: +3 °C en la Tmax de dic-feb y +10 % de ET0.")
    heavy_rain: bool = Field(default=False, description="Lluvias intensas: +35 % de lluvia de oct a mar, más erosión hídrica.")

    def irrigation_share(self, field_irrigated: bool) -> float:
        """Fracción del riego pleno que se aplica (0 = secano)."""
        level = "disponible" if self.irrigation and self.irrigation_level == "lote" else self.irrigation_level
        if level == "lote":
            return 1.0 if field_irrigated else 0.0
        return {"sin_riego": 0.0, "limitado": P_LIMITED, "disponible": 1.0}[level]


class CompareRequest(BaseModel):
    field_id: str
    priorities: Priorities | None = None
    scenario: ScenarioInput | None = None
    strategies: list[RotationStrategy] | None = Field(
        default=None, description="Estrategias a generar. La actual se incluye siempre. Por defecto, todas."
    )
    rotation_ids: list[str] | None = Field(default=None, description="Rotaciones guardadas del lote para sumar a la comparación.")
    current_crop: str | None = Field(default=None, description="Cultivo actual. Por defecto, el último del historial.")
    history: list[str] | None = Field(default=None, description="Cultivos de campañas anteriores, del más antiguo al más reciente.")
    soil_moisture: SoilMoistureInput | None = None
    vegetation: VegetationInput | None = None
    use_satellite: bool = Field(
        default=True, description="Si no se envían soil_moisture o vegetation, buscarlos (AppEEARS, caché o muestra)."
    )
    start_year: int | None = Field(default=None, ge=1981, description="Período climático. Por defecto, los últimos 10 años completos.")
    end_year: int | None = Field(default=None, ge=1981)


class ClimateInputSummary(BaseModel):
    origin: DataStatus
    origin_label: str
    period: str
    annual_precip_mm: float
    annual_et0_mm: float
    aridity_index: float = Field(description="Lluvia / ET0 anual (UNEP).")
    zone: AridityZone
    precip_cv_pct: float | None
    heat_days_per_year: float | None
    scenario: str | None = None
    scenario_precip_mm: float
    scenario_et0_mm: float


class SoilInputSummary(BaseModel):
    texture: SoilTexture | None
    texture_assumed: bool
    lab_analysis: bool
    available_water_mm: float = Field(description="Agua útil estimada en la zona de raíces.")
    fallow_efficiency: float = Field(description="Fracción de la lluvia del barbecho que queda almacenada.")
    slope_pct: float | None


class EngineInputsSummary(BaseModel):
    location: Location
    climate: ClimateInputSummary
    soil: SoilInputSummary
    irrigated: bool
    current_crop: str | None
    history: list[str]
    soil_moisture: SoilMoistureInput | None
    vegetation: VegetationInput | None
    priorities_default: bool


class CompareResult(BaseModel):
    field_id: str
    priorities: Priorities
    weights: dict[str, float]
    scenario: ScenarioInput | None
    inputs: EngineInputsSummary
    ranking: list[RotationScore]
    evaluations: list[RotationEvaluation]
    recommended_rotation_id: str
    confidence: Confidence
    confidence_reasons: list[str]
    assumptions: list[Assumption]
    sources: list[DataSource]
    warnings: list[str]
    disclaimer: str = Field(default_factory=disclaimer)
