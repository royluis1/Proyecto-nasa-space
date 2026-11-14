/**
 * Datos de ejemplo para cuando el servidor no responde (se generan con scripts/export_demo_data.py).
 * Son SIMULADOS: clima, SMAP y NDVI de muestra. Se cargan bajo demanda para no inflar el bundle inicial.
 */
import type {
  ApiEnvelope, ClimateSummary, CompareResult, Crop, FieldOut, ResponseMeta, Rotation, ScenarioInput, ScenarioResult,
  SoilMoistureSummary, VegetationSummary,
} from "@/types/api";
import { DEMO_NOTICE, DISCLAIMER } from "../content";
import { ORIGIN_LABELS } from "../format";
import { getLocalField, isLocalId, listLocalFields } from "../local-fields";

export const EXAMPLE_IDS = ["campo-este", "campo-centro", "campo-conlara"] as const;
type ExampleId = (typeof EXAMPLE_IDS)[number];

const demoMeta = (extra: string[] = []): ResponseMeta => ({
  data_status: "sample",
  origin_label: ORIGIN_LABELS.demo,
  warnings: [DEMO_NOTICE, ...extra],
  disclaimer: DISCLAIMER,
});
const env = <T>(data: T, extra: string[] = []): ApiEnvelope<T> => ({ data, meta: demoMeta(extra) });

async function load<T>(name: string): Promise<T> {
  // Las rutas están acotadas a los archivos de ./data: el bundler solo incluye esos.
  const mod = await import(`./data/${name}.json`);
  return (mod.default ?? mod) as T;
}

const sq = (a: number, b: number) => a * a + b * b;

async function exampleFields(): Promise<FieldOut[]> {
  return load<FieldOut[]>("fields");
}

/** Para un campo guardado solo en el navegador, el ejemplo con ubicación más parecida. */
export async function exampleIdFor(fieldId: string): Promise<{ id: ExampleId; note: string | null }> {
  if ((EXAMPLE_IDS as readonly string[]).includes(fieldId)) return { id: fieldId as ExampleId, note: null };
  const local = getLocalField(fieldId);
  const examples = await exampleFields();
  const ref = local?.location ?? examples[0].location;
  const nearest = examples.reduce((best, f) =>
    sq(f.location.lat - ref.lat, f.location.lon - ref.lon) < sq(best.location.lat - ref.lat, best.location.lon - ref.lon) ? f : best,
  );
  return {
    id: nearest.id as ExampleId,
    note: `Este campo está guardado solo en este navegador: se muestran los resultados del campo de ejemplo más cercano (${nearest.name}).`,
  };
}

export async function demoFields(): Promise<ApiEnvelope<FieldOut[]>> {
  return env([...(await exampleFields()), ...listLocalFields()]);
}

export async function demoField(id: string): Promise<ApiEnvelope<FieldOut> | null> {
  const field = isLocalId(id) ? getLocalField(id) : (await exampleFields()).find((f) => f.id === id);
  return field ? env(field, field.sample_note ? [field.sample_note] : []) : null;
}

export async function demoCrops(): Promise<ApiEnvelope<Crop[]>> {
  return env(await load<Crop[]>("crops"));
}

export async function demoCompare(fieldId: string): Promise<ApiEnvelope<CompareResult>> {
  const { id, note } = await exampleIdFor(fieldId);
  const data = await load<Omit<CompareResult, "ranking">>(`compare-${id}`);
  const result = { ...data, field_id: fieldId, ranking: data.evaluations.map((e) => e.score) } as CompareResult;
  return env(result, [...(note ? [note] : []), ...result.warnings]);
}

export async function demoRotations(fieldId: string): Promise<Rotation[]> {
  const { id } = await exampleIdFor(fieldId);
  return load<Rotation[]>(`rotations-${id}`);
}

export async function demoClimate(fieldId: string): Promise<ApiEnvelope<ClimateSummary>> {
  const { id, note } = await exampleIdFor(fieldId);
  return env(await load<ClimateSummary>(`climate-${id}`), note ? [note] : []);
}

export async function demoSoilMoisture(fieldId: string): Promise<ApiEnvelope<SoilMoistureSummary>> {
  const { id, note } = await exampleIdFor(fieldId);
  return env(await load<SoilMoistureSummary>(`soil-moisture-${id}`), note ? [note] : []);
}

export async function demoVegetation(fieldId: string): Promise<ApiEnvelope<VegetationSummary>> {
  const { id, note } = await exampleIdFor(fieldId);
  return env(await load<VegetationSummary>(`vegetation-${id}`), note ? [note] : []);
}

export const DEMO_SCENARIOS: { id: string; name: string }[] = [
  { id: "base", name: "Clima del período" },
  { id: "seco-20", name: "Lluvia -20 %" },
  { id: "calor-2", name: "+2 °C" },
  { id: "seco-20-calor-2", name: "Lluvia -20 % y +2 °C" },
  { id: "anio-seco", name: "Año más seco observado" },
  { id: "con-riego", name: "Con riego" },
];

export async function demoScenarios(fieldId: string, requested: ScenarioInput[]): Promise<ApiEnvelope<ScenarioResult[]>> {
  const { id, note } = await exampleIdFor(fieldId);
  const all = await load<ScenarioResult[]>(`scenarios-${id}`);
  const wanted = requested.map((r) => all.find((s) => s.scenario.id === r.id)).filter((s): s is ScenarioResult => Boolean(s));
  const extra = wanted.length < requested.length ? ["En modo demostración solo hay escenarios predefinidos: los demás no se calcularon."] : [];
  return env(wanted.length ? wanted : all, [...(note ? [note] : []), ...extra]);
}
