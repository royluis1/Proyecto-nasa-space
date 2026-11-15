/** Tipos de la API, derivados del esquema OpenAPI del backend (types/openapi.d.ts, generado con `npm run gen:api`). */
import type { components } from "./openapi";

type S = components["schemas"];

/** Los pedidos aceptan omitir lo que tiene valor por defecto en el servidor (el generador los marca como obligatorios). */
type Optional<T, Required extends keyof T = never> = Partial<Omit<T, Required>> & Pick<T, Required>;

export type Level = S["Level"];
export type Confidence = S["Confidence"];
export type DataStatus = S["DataStatus"];
export type DataLabel = S["DataLabel"];
export type Severity = S["Severity"];
export type RotationStrategy = S["RotationStrategy"];
export type SoilTexture = S["SoilTexture"];
export type ScoreComponentKey = S["ScoreComponentKey"];
export type CropGroup = S["CropGroup"];

export type Crop = S["Crop"];
export type FieldOut = S["FieldOut"];
export type FieldCreate = S["FieldCreate"];
export type Boundary = S["Boundary"];
export type Priorities = S["Priorities"];

export type CompareRequest = Omit<Optional<S["CompareRequest"], "field_id">, "scenario"> & { scenario?: ScenarioInput | null };
export type CompareResult = S["CompareResult"];
export type Rotation = S["Rotation"];
export type RotationStep = S["RotationStep"];
export type RotationEvaluation = S["RotationEvaluation"];
export type RotationProfile = S["RotationProfile"];
export type RotationScore = S["RotationScore"];
export type ScoreComponent = S["ScoreComponent"];
export type ScoreDriver = S["ScoreDriver"];
export type Recommendation = S["Recommendation"];
export type RiskFlag = S["RiskFlag"];
export type Assumption = S["Assumption"];
export type DataSource = S["DataSource"];
export type Provenance = S["Provenance"];

/** Los campos nuevos (riego, ola de calor, lluvias intensas) tienen valor por defecto en el servidor. */
export type ScenarioInput = Optional<S["ScenarioInput"], "id" | "name">;
export type IrrigationLevel = S["ScenarioInput"]["irrigation_level"];
export type ScenarioRequest = S["ScenarioRequest"];
export type ScenarioResult = S["ScenarioResult"];
export type ScenarioRotationNote = S["ScenarioRotationNote"];
export type ScenarioPreset = S["ScenarioPreset"];

export type CalendarRequest = Omit<Optional<S["CalendarRequest"], "field_id">, "scenario"> & { scenario?: ScenarioInput | null };
export type CalendarTimeline = S["CalendarTimeline"];
export type TimelineCampaign = S["TimelineCampaign"];
export type TimelineMonth = S["TimelineMonth"];
export type TimelineAdvice = S["TimelineAdvice"];

export type Report = S["Report"];
export type ScenarioResilience = S["ScenarioResilience"];

export type ClimateSummary = S["ClimateSummary"];
export type ClimateSummaryRequest = Optional<S["ClimateSummaryRequest"], "start_date" | "end_date">;
export type SoilMoistureSummary = S["SoilMoistureSummary"];
export type SoilMoistureRequest = Optional<S["SoilMoistureRequest"]>;
export type VegetationSummary = S["VegetationSummary"];
export type VegetationRequest = Optional<S["VegetationRequest"]>;
export type DataTrace = S["DataTrace"];
export type TerrainSummary = S["TerrainSummary"];
export type Forecast = S["Forecast"];
export type ForecastDay = S["ForecastDay"];
export type SourceInfo = S["SourceInfo"];
export type Alert = S["Alert"];
export type AlertsResult = S["AlertsResult"];
export type RainSummary = S["RainSummary"];
export type HuertaPanel = S["HuertaPanel"];
export type ProvincesOut = S["ProvincesOut"];
export type ZonesOut = S["ZonesOut"];
export type ZoneAt = S["ZoneAt"];
export type ZoneSummary = S["ZoneSummary"];
export type ZoneClimate = S["ZoneClimate"];
export type ZoneSuitability = S["ZoneSuitability"];
export type CropSuitability = S["CropSuitability"];
export type Transition = S["Transition"];
export type SoilEstimate = S["SoilEstimate"];
export type PointSoilEstimate = S["PointSoilEstimate"];
export type AutoProfile = S["AutoProfile"];
export type FieldSoilMoisture = S["FieldSoilMoisture"];
export type FieldSectors = S["FieldSectors"];
export type Sector = S["Sector"];
export type FieldHeatStress = S["FieldHeatStress"];
export type SoilMoistureProduct = S["SoilMoistureProduct"];
export type TerrainRequest = Optional<S["TerrainRequest"]>;

export type LocalityOut = S["LocalityOut"];
export type LocalitySearch = S["LocalitySearch"];
export type NearestLocality = S["NearestLocality"];

export type ResponseMeta = S["ResponseMeta"];

/** Sobre de toda respuesta exitosa del backend. */
export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

/** Lo que devuelve el cliente: el sobre más si son datos de ejemplo por falta de conexión. */
export interface ApiResult<T> extends ApiEnvelope<T> {
  demo: boolean;
}

/** Estado de origen que se muestra en pantalla: los del backend más el modo demostración del frontend. */
export type OriginStatus = DataStatus | "demo";
