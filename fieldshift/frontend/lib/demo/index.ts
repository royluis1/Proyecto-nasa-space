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

/** Escenario predefinido que coincide con lo pedido (por id o por parámetros). */
function findPreset(all: ScenarioResult[], s: ScenarioInput): ScenarioResult | undefined {
  return (
    all.find((p) => p.scenario.id === s.id) ??
    all.find(
      (p) =>
        p.scenario.rain_delta_pct === s.rain_delta_pct && p.scenario.temp_delta_c === s.temp_delta_c &&
        p.scenario.dry_year === s.dry_year && p.scenario.irrigation === s.irrigation,
    )
  );
}

/**
 * Resultado de la comparación. Con un escenario, los puntajes salen de los escenarios precalculados;
 * el detalle de factores sigue siendo el del clima del período (se avisa).
 */
export async function demoCompare(fieldId: string, scenario?: ScenarioInput | null): Promise<ApiEnvelope<CompareResult>> {
  const { id, note } = await exampleIdFor(fieldId);
  const data = await load<Omit<CompareResult, "ranking">>(`compare-${id}`);
  let evaluations = data.evaluations;
  const extra: string[] = note ? [note] : [];
  let applied: ScenarioInput | null = null;

  const isBase = !scenario || (scenario.id === "base" && !scenario.irrigation && !scenario.rain_delta_pct && !scenario.temp_delta_c && !scenario.dry_year);
  if (!isBase) {
    const preset = findPreset(await load<ScenarioResult[]>(`scenarios-${id}`), scenario!);
    if (preset) {
      applied = preset.scenario;
      const byId = Object.fromEntries(preset.ranking.map((s) => [s.rotation_id, s]));
      evaluations = data.evaluations
        .map((ev) => {
          const sc = byId[ev.rotation.id];
          if (!sc) return ev;
          const components = sc.components.map((c) => ({ ...c, drivers: ev.score.components.find((b) => b.key === c.key)?.drivers ?? [] }));
          return { ...ev, score: { ...sc, components } };
        })
        .sort((a, b) => a.score.rank - b.score.rank);
      extra.push("En modo demostración, los puntajes reflejan el escenario elegido pero el detalle de factores es el del clima del período.");
    } else {
      extra.push("En modo demostración solo hay escenarios predefinidos: se muestra el clima del período.");
    }
  }
  const result = { ...data, evaluations, scenario: applied, field_id: fieldId, ranking: evaluations.map((e) => e.score) } as CompareResult;
  return env(result, [...extra, ...result.warnings]);
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
