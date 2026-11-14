/**
 * Datos de ejemplo para cuando el servidor no responde (se generan con scripts/export_demo_data.py).
 * Son SIMULADOS: clima, SMAP y NDVI de muestra. Se cargan bajo demanda para no inflar el bundle inicial.
 */
import type {
  ApiEnvelope, CalendarRequest, CalendarTimeline, ClimateSummary, CompareResult, Crop, FieldOut, ResponseMeta, Rotation,
  AlertsResult, HuertaPanel, ScenarioInput, ScenarioResult, SoilMoistureSummary, TerrainSummary, VegetationSummary,
} from "@/types/api";
import { isBaseline, sameEffect } from "../scenarios";
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

/** Escenario predefinido que coincide con lo pedido (por id o por su efecto). */
function findPreset(all: ScenarioResult[], s: ScenarioInput): ScenarioResult | undefined {
  return all.find((p) => p.scenario.id === s.id) ?? all.find((p) => sameEffect(p.scenario, s));
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

  if (!isBaseline(scenario)) {
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

const NO_FORECAST = "Sin conexión con el servidor: el pronóstico (Open-Meteo) no está disponible y las alertas son solo de ejemplo.";

export async function demoHuerta(fieldId: string): Promise<ApiEnvelope<HuertaPanel>> {
  const { id, note } = await exampleIdFor(fieldId);
  const data = await load<HuertaPanel>(`huerta-${id}`);
  return env({ ...data, field_id: fieldId }, [...(note ? [note] : []), NO_FORECAST, ...data.warnings]);
}

export async function demoAlerts(fieldId: string, profile: "huerta" | "agricultor"): Promise<ApiEnvelope<AlertsResult>> {
  const { id, note } = await exampleIdFor(fieldId);
  const data = await load<AlertsResult>(`alerts-${id}-${profile}`);
  return env(data, [...(note ? [note] : []), NO_FORECAST, ...data.warnings]);
}

export async function demoTerrain(fieldId: string): Promise<ApiEnvelope<TerrainSummary>> {
  const { id, note } = await exampleIdFor(fieldId);
  return env(await load<TerrainSummary>(`terrain-${id}`), [
    ...(note ? [note] : []),
    "Relieve de MUESTRA SIMULADA: con credenciales de Earthdata, el servidor descarga SRTM real.",
  ]);
}

export async function demoScenarios(fieldId: string, requested: ScenarioInput[]): Promise<ApiEnvelope<ScenarioResult[]>> {
  const { id, note } = await exampleIdFor(fieldId);
  const all = await load<ScenarioResult[]>(`scenarios-${id}`);
  const wanted = requested
    .map((r) => {
      const hit = findPreset(all, r);
      return hit ? { ...hit, scenario: { ...hit.scenario, id: r.id, name: r.name } } : undefined;
    })
    .filter((s): s is ScenarioResult => Boolean(s));
  const extra = wanted.length < requested.length ? ["En modo demostración solo hay escenarios predefinidos: los demás no se calcularon."] : [];
  return env(wanted.length ? wanted : all, [...(note ? [note] : []), ...extra]);
}

/** Año de la primera campaña por defecto: la próxima que empieza en julio (igual que el backend). */
export function nextCampaignYear(today = new Date()): number {
  return today.getMonth() < 6 ? today.getFullYear() : today.getFullYear() + 1;
}

/** Corre los años de la línea de tiempo (etiquetas y textos) para que empiece en `first`. */
export function shiftTimeline(tl: CalendarTimeline, first: number): CalendarTimeline {
  const d = first - (tl.campaigns[0] ? Number(tl.campaigns[0].label.slice(0, 4)) : first);
  if (!d) return tl;
  const fix = (t: string) => t.replace(/\b(20\d\d)\b/g, (y) => String(Number(y) + d));
  return {
    ...tl,
    campaigns: tl.campaigns.map((c) => ({
      ...c,
      label: `${Number(c.label.slice(0, 4)) + d}/${String(Number(c.label.slice(0, 4)) + d + 1).slice(-2)}`,
      months: c.months.map((m) => ({ ...m, year: m.year + d, label: fix(m.label) })),
    })),
    advice: tl.advice.map((a) => ({ ...a, text: fix(a.text) })),
  };
}

/**
 * Calendario de ejemplo: está precalculado para el año normal y 4 campañas. Con otro escenario se avisa y se muestra
 * el año normal.
 */
export async function demoCalendar(fieldId: string, req: CalendarRequest): Promise<ApiEnvelope<CalendarTimeline>> {
  const { id, note } = await exampleIdFor(fieldId);
  const all = await load<CalendarTimeline[]>(`calendar-${id}`);
  const tl = all.find((t) => t.rotation.id === req.rotation_id) ?? all.find((t) => t.is_recommended) ?? all[0];
  const n = Math.min(4, Math.max(2, req.campaigns ?? 3));
  const extra = note ? [note] : [];
  if (!isBaseline(req.scenario)) extra.push("En modo demostración el calendario está calculado solo para el año normal.");
  const shifted = shiftTimeline({ ...tl, field_id: fieldId, campaigns: tl.campaigns.slice(0, n), scenario: null }, req.first_campaign_year ?? nextCampaignYear());
  const campaigns = shifted.campaigns.map((c) => c.index);
  return env(
    { ...shifted, advice: shifted.advice.map((a) => ({ ...a, campaigns: a.campaigns.filter((c) => campaigns.includes(c)) })).filter((a) => a.campaigns.length) },
    [...extra, ...tl.warnings],
  );
}
