/** Lógica del dashboard comparativo: contribuciones, factores que favorecen o penalizan, indicadores. Todo puro y testeable. */
import type { DataLabel, Level, RotationEvaluation, ScenarioInput, ScoreComponentKey } from "@/types/api";
import { COMPONENT_ORDER, COMPONENTS, LEVEL_LABELS, num } from "./format";
import { isBaseline, scenarioParts } from "./scenarios";
import { tr, L, localize } from "./i18n";

export type Weights = Record<ScoreComponentKey, number>;

/* ------------------------- contribución al puntaje ------------------------- */

export interface Contribution {
  key: ScoreComponentKey;
  name: string;
  value: number;
  weight: number;
  /** Puntos que aporta al total: valor × peso. */
  points: number;
}

export function contributions(ev: RotationEvaluation, weights: Weights): Contribution[] {
  const byKey = Object.fromEntries(ev.score.components.map((c) => [c.key, c]));
  return COMPONENT_ORDER.map((key) => {
    const value = byKey[key]?.value ?? 0;
    const weight = weights[key] ?? 0;
    return { key, name: COMPONENTS[key].name, value, weight, points: value * weight };
  });
}

/* --------------------- factores que favorecen o penalizan --------------------- */

export interface Impact {
  component: ScoreComponentKey;
  factor: string;
  /** Puntos al total. Frente a la rotación actual si `vsActual`; absolutos si no. */
  delta: number;
  detail: string;
  label: DataLabel;
}

interface WeightedDriver {
  component: ScoreComponentKey;
  factor: string;
  weighted: number;
  detail: string;
  label: DataLabel;
}

function weightedDrivers(ev: RotationEvaluation, weights: Weights): Map<string, WeightedDriver> {
  const out = new Map<string, WeightedDriver>();
  for (const c of ev.score.components) {
    for (const d of c.drivers) {
      if (d.points == null || d.points === 0) continue;
      const key = `${c.key}|${d.factor}`;
      const prev = out.get(key);
      const weighted = d.points * (weights[c.key] ?? 0);
      out.set(key, { component: c.key, factor: d.factor, weighted: (prev?.weighted ?? 0) + weighted, detail: d.detail, label: d.provenance.label });
    }
  }
  return out;
}

export interface FavorPenalty {
  favor: Impact[];
  penalize: Impact[];
  /** true si los puntos son la diferencia con la rotación actual. */
  vsActual: boolean;
}

const MIN_IMPACT = 0.15;

/**
 * Qué datos favorecen y cuáles penalizan a una rotación. Frente a la rotación actual: la diferencia de puntos que cada
 * factor aporta al total (con tus pesos). Para la actual (o si no hay otra con qué compararla): lo que cada factor suma o resta.
 */
export function favorAndPenalty(ev: RotationEvaluation, baseline: RotationEvaluation | undefined, weights: Weights, n = 3): FavorPenalty {
  const vsActual = Boolean(baseline) && baseline!.rotation.id !== ev.rotation.id;
  const mine = weightedDrivers(ev, weights);
  const base = vsActual ? weightedDrivers(baseline!, weights) : new Map<string, WeightedDriver>();
  const keys = new Set([...mine.keys(), ...base.keys()]);
  const impacts: Impact[] = [];
  for (const k of keys) {
    const a = mine.get(k);
    const b = base.get(k);
    const delta = (a?.weighted ?? 0) - (b?.weighted ?? 0);
    if (Math.abs(delta) < MIN_IMPACT) continue;
    const src = a ?? b!;
    impacts.push({ component: src.component, factor: src.factor, delta, detail: a ? src.detail : tr(`${src.detail} (en tu rotación actual)`, `${src.detail} (in your current rotation)`), label: src.label });
  }
  impacts.sort((x, y) => y.delta - x.delta);
  return {
    favor: impacts.filter((i) => i.delta > 0).slice(0, n),
    penalize: impacts.filter((i) => i.delta < 0).slice(-n).reverse(),
    vsActual,
  };
}

/* ------------------------------ indicadores ------------------------------ */

export type Better = "high" | "low" | "none";
export type IndicatorGroup = "total" | "agua" | "suelo" | "riesgo" | "ingreso" | "sostenibilidad";

export interface Indicator {
  id: string;
  group: IndicatorGroup;
  label: string;
  hint: string;
  better: Better;
  /** Margen por debajo del cual se considera "igual". */
  tolerance: number;
  value: (ev: RotationEvaluation) => number | null;
  format: (v: number) => string;
}

const score = (key: ScoreComponentKey) => (ev: RotationEvaluation) => ev.score.components.find((c) => c.key === key)?.value ?? null;
const LEVEL_VALUE: Record<Level, number> = { bajo: 0, medio: 1, alto: 2 };
const flags = (sev: string) => (ev: RotationEvaluation) => ev.risk_flags.filter((f) => f.severity === sev).length;

export const GROUP_LABELS: Record<IndicatorGroup, string> = localize({
  total: L("Puntaje", "Score"),
  agua: L("Agua", "Water"),
  suelo: L("Suelo", "Soil"),
  riesgo: L("Riesgo", "Risk"),
  ingreso: L("Ingreso relativo", "Relative income"),
  sostenibilidad: L("Sostenibilidad", "Sustainability"),
});

export const INDICATORS: Indicator[] = localize([
  { id: "total", group: "total", label: L("Puntaje total", "Total score"), hint: L("De 0 a 100, con tus prioridades.", "From 0 to 100, with your priorities."), better: "high", tolerance: 0.5, value: (e) => e.score.total, format: (v) => `${num(v, 1)} / 100` },
  { id: "demanda", group: "agua", label: L("Agua que necesitan los cultivos", "Water the crops need"), hint: L("Demanda estimada por año (Kc × evapotranspiración).", "Estimated demand per year (Kc × evapotranspiration)."), better: "low", tolerance: 15, value: (e) => e.profile.water_demand_mm_year, format: (v) => `${num(v)} ${tr("mm/año", "mm/yr")}` },
  { id: "cobertura", group: "agua", label: L("Parte de esa agua que cubren la lluvia y el suelo", "Share of that water covered by rain and soil"), hint: L("El resto sería falta de agua (estrés hídrico).", "The rest would be a water shortage (water stress)."), better: "high", tolerance: 1, value: (e) => e.profile.rain_coverage_pct, format: (v) => `${num(v)} %` },
  { id: "deficit", group: "agua", label: L("Agua que falta cubrir", "Water still to cover"), hint: L("Antes de regar.", "Before irrigation."), better: "low", tolerance: 15, value: (e) => e.profile.deficit_mm_year, format: (v) => `${num(v)} ${tr("mm/año", "mm/yr")}` },
  { id: "riego", group: "agua", label: L("Riego necesario", "Irrigation needed"), hint: L("Solo si el lote tiene riego.", "Only if the plot is irrigated."), better: "low", tolerance: 15, value: (e) => e.profile.irrigation_mm_year ?? 0, format: (v) => (v === 0 ? tr("sin riego", "no irrigation") : `${num(v)} ${tr("mm/año", "mm/yr")}`) },
  { id: "A", group: "agua", label: L("Resiliencia hídrica (A)", "Water resilience (A)"), hint: L("Qué tan bien resiste la falta de agua.", "How well it withstands water shortage."), better: "high", tolerance: 0.5, value: score("A"), format: (v) => `${num(v)} / 100` },
  { id: "cubierto", group: "suelo", label: L("Tiempo con cultivo vivo", "Time with a living crop"), hint: L("Porcentaje de los meses con algo creciendo.", "Share of months with something growing."), better: "high", tolerance: 1, value: (e) => e.profile.covered_months_pct, format: (v) => `${num(v)} %` },
  { id: "desnudo", group: "suelo", label: L("Meses con el suelo sin cultivo", "Months with no crop on the soil"), hint: L("Por año. Más meses, más exposición al viento.", "Per year. More months, more wind exposure."), better: "low", tolerance: 0.2, value: (e) => e.profile.bare_months_per_year, format: (v) => `${num(v, 1)} ${tr("meses/año", "months/yr")}` },
  { id: "S", group: "suelo", label: L("Salud del suelo (S)", "Soil health (S)"), hint: L("Cobertura, materia orgánica, leguminosas y erosión.", "Cover, organic matter, legumes and erosion."), better: "high", tolerance: 0.5, value: score("S"), format: (v) => `${num(v)} / 100` },
  { id: "R", group: "riesgo", label: L("Resiliencia climática (R)", "Climate resilience (R)"), hint: L("Qué tan expuesto queda a sequía, calor y heladas.", "How exposed it is to drought, heat and frost."), better: "high", tolerance: 0.5, value: score("R"), format: (v) => `${num(v)} / 100` },
  { id: "alertas-altas", group: "riesgo", label: L("Alertas serias", "Serious alerts"), hint: L("Riesgos marcados como alerta.", "Risks flagged as alerts."), better: "low", tolerance: 0, value: flags("alta"), format: (v) => `${num(v)}` },
  { id: "alertas-media", group: "riesgo", label: L("Alertas de atención", "Watch alerts"), hint: L("Riesgos para tener presentes.", "Risks to keep in mind."), better: "low", tolerance: 0, value: flags("media"), format: (v) => `${num(v)}` },
  { id: "I", group: "ingreso", label: L("Ingreso relativo (I)", "Relative income (I)"), hint: L("Índice cualitativo: no son precios ni márgenes.", "Qualitative index: not prices or margins."), better: "high", tolerance: 0.5, value: score("I"), format: (v) => `${num(v)} / 100` },
  { id: "ingreso-nivel", group: "ingreso", label: L("Nivel de ingreso estimado", "Estimated income level"), hint: L("Bajo, medio o alto.", "Low, medium or high."), better: "high", tolerance: 0, value: (e) => LEVEL_VALUE[e.profile.relative_income], format: (v) => LEVEL_LABELS[(["bajo", "medio", "alto"] as Level[])[Math.round(v)]] },
  { id: "cultivos", group: "sostenibilidad", label: L("Cultivos distintos", "Distinct crops"), hint: L("Más variedad corta ciclos de plagas.", "More variety breaks pest cycles."), better: "high", tolerance: 0, value: (e) => e.profile.distinct_crops, format: (v) => `${num(v)}` },
  { id: "E", group: "sostenibilidad", label: L("Sostenibilidad y diversificación (E)", "Sustainability and diversification (E)"), hint: L("Diversidad, leguminosas, coberturas y repeticiones.", "Diversity, legumes, cover crops and repetitions."), better: "high", tolerance: 0.5, value: score("E"), format: (v) => `${num(v)} / 100` },
]);

export type Verdict = "mejor" | "peor" | "igual" | "sin_dato";

/** ¿Es mejor, peor o igual que la referencia, según qué indicador sea? */
export function judge(value: number | null, base: number | null, better: Better, tolerance: number): Verdict {
  if (value == null || base == null) return "sin_dato";
  const diff = value - base;
  if (Math.abs(diff) <= tolerance || better === "none") return "igual";
  return (diff > 0) === (better === "high") ? "mejor" : "peor";
}

export const VERDICT_TEXT: Record<Verdict, string> = localize({ mejor: L("Mejor", "Better"), peor: L("Peor", "Worse"), igual: L("Igual", "Same"), sin_dato: L("Sin dato", "No data") });

/* ----------------------------- escenario y riego ----------------------------- */


/** Texto corto que explica qué cambió el escenario. */
export function describeScenario(s: ScenarioInput | null | undefined, baseline: { rainMm: number; scenarioRainMm: number }): string | null {
  if (!s || isBaseline(s)) return null;
  const parts = scenarioParts(s);
  const rain = Math.round(baseline.scenarioRainMm) !== Math.round(baseline.rainMm) ? tr(` (${num(baseline.scenarioRainMm)} mm de lluvia al año en vez de ${num(baseline.rainMm)})`, ` (${num(baseline.scenarioRainMm)} mm of rain per year instead of ${num(baseline.rainMm)})`) : "";
  return `${parts.join(", ")}${rain}`;
}
