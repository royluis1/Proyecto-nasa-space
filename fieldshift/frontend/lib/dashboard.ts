/** Lógica del dashboard comparativo: contribuciones, factores que favorecen o penalizan, indicadores. Todo puro y testeable. */
import type { DataLabel, Level, RotationEvaluation, ScenarioInput, ScoreComponentKey } from "@/types/api";
import { COMPONENT_ORDER, COMPONENTS, LEVEL_LABELS, num } from "./format";

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
    impacts.push({ component: src.component, factor: src.factor, delta, detail: a ? src.detail : `${src.detail} (en tu rotación actual)`, label: src.label });
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

export const GROUP_LABELS: Record<IndicatorGroup, string> = {
  total: "Puntaje",
  agua: "Agua",
  suelo: "Suelo",
  riesgo: "Riesgo",
  ingreso: "Ingreso relativo",
  sostenibilidad: "Sostenibilidad",
};

export const INDICATORS: Indicator[] = [
  { id: "total", group: "total", label: "Puntaje total", hint: "De 0 a 100, con tus prioridades.", better: "high", tolerance: 0.5, value: (e) => e.score.total, format: (v) => `${num(v, 1)} / 100` },
  { id: "demanda", group: "agua", label: "Agua que necesitan los cultivos", hint: "Demanda estimada por año (Kc × evapotranspiración).", better: "low", tolerance: 15, value: (e) => e.profile.water_demand_mm_year, format: (v) => `${num(v)} mm/año` },
  { id: "cobertura", group: "agua", label: "Parte de esa agua que cubren la lluvia y el suelo", hint: "El resto sería falta de agua (estrés hídrico).", better: "high", tolerance: 1, value: (e) => e.profile.rain_coverage_pct, format: (v) => `${num(v)} %` },
  { id: "deficit", group: "agua", label: "Agua que falta cubrir", hint: "Antes de regar.", better: "low", tolerance: 15, value: (e) => e.profile.deficit_mm_year, format: (v) => `${num(v)} mm/año` },
  { id: "riego", group: "agua", label: "Riego necesario", hint: "Solo si el lote tiene riego.", better: "low", tolerance: 15, value: (e) => e.profile.irrigation_mm_year ?? 0, format: (v) => (v === 0 ? "sin riego" : `${num(v)} mm/año`) },
  { id: "A", group: "agua", label: "Resiliencia hídrica (A)", hint: "Qué tan bien resiste la falta de agua.", better: "high", tolerance: 0.5, value: score("A"), format: (v) => `${num(v)} / 100` },
  { id: "cubierto", group: "suelo", label: "Tiempo con cultivo vivo", hint: "Porcentaje de los meses con algo creciendo.", better: "high", tolerance: 1, value: (e) => e.profile.covered_months_pct, format: (v) => `${num(v)} %` },
  { id: "desnudo", group: "suelo", label: "Meses con el suelo sin cultivo", hint: "Por año. Más meses, más exposición al viento.", better: "low", tolerance: 0.2, value: (e) => e.profile.bare_months_per_year, format: (v) => `${num(v, 1)} meses/año` },
  { id: "S", group: "suelo", label: "Salud del suelo (S)", hint: "Cobertura, materia orgánica, leguminosas y erosión.", better: "high", tolerance: 0.5, value: score("S"), format: (v) => `${num(v)} / 100` },
  { id: "R", group: "riesgo", label: "Resiliencia climática (R)", hint: "Qué tan expuesto queda a sequía, calor y heladas.", better: "high", tolerance: 0.5, value: score("R"), format: (v) => `${num(v)} / 100` },
  { id: "alertas-altas", group: "riesgo", label: "Alertas serias", hint: "Riesgos marcados como alerta.", better: "low", tolerance: 0, value: flags("alta"), format: (v) => `${num(v)}` },
  { id: "alertas-media", group: "riesgo", label: "Alertas de atención", hint: "Riesgos para tener presentes.", better: "low", tolerance: 0, value: flags("media"), format: (v) => `${num(v)}` },
  { id: "I", group: "ingreso", label: "Ingreso relativo (I)", hint: "Índice cualitativo: no son precios ni márgenes.", better: "high", tolerance: 0.5, value: score("I"), format: (v) => `${num(v)} / 100` },
  { id: "ingreso-nivel", group: "ingreso", label: "Nivel de ingreso estimado", hint: "Bajo, medio o alto.", better: "high", tolerance: 0, value: (e) => LEVEL_VALUE[e.profile.relative_income], format: (v) => LEVEL_LABELS[(["bajo", "medio", "alto"] as Level[])[Math.round(v)]] },
  { id: "cultivos", group: "sostenibilidad", label: "Cultivos distintos", hint: "Más variedad corta ciclos de plagas.", better: "high", tolerance: 0, value: (e) => e.profile.distinct_crops, format: (v) => `${num(v)}` },
  { id: "E", group: "sostenibilidad", label: "Sostenibilidad y diversificación (E)", hint: "Diversidad, leguminosas, coberturas y repeticiones.", better: "high", tolerance: 0.5, value: score("E"), format: (v) => `${num(v)} / 100` },
];

export type Verdict = "mejor" | "peor" | "igual" | "sin_dato";

/** ¿Es mejor, peor o igual que la referencia, según qué indicador sea? */
export function judge(value: number | null, base: number | null, better: Better, tolerance: number): Verdict {
  if (value == null || base == null) return "sin_dato";
  const diff = value - base;
  if (Math.abs(diff) <= tolerance || better === "none") return "igual";
  return (diff > 0) === (better === "high") ? "mejor" : "peor";
}

export const VERDICT_TEXT: Record<Verdict, string> = { mejor: "Mejor", peor: "Peor", igual: "Igual", sin_dato: "Sin dato" };

/* ----------------------------- escenario y riego ----------------------------- */


/** Aplica la opción "evaluar con riego" sobre un escenario predefinido. */
export function withIrrigation(s: ScenarioInput, irrigation: boolean): ScenarioInput {
  if (!irrigation || s.irrigation) return s;
  return { ...s, id: `${s.id}+riego`, name: s.id === "base" ? "Clima del período con riego" : `${s.name}, con riego`, irrigation: true };
}

/** Texto corto que explica qué cambió el escenario. */
export function describeScenario(s: ScenarioInput | null | undefined, baseline: { rainMm: number; scenarioRainMm: number }): string | null {
  if (!s || (s.id === "base" && !s.irrigation)) return null;
  const parts: string[] = [];
  if (s.dry_year) parts.push("se repite el año más seco de los últimos 10");
  if (s.rain_delta_pct) parts.push(`llueve ${Math.abs(s.rain_delta_pct)} % ${s.rain_delta_pct < 0 ? "menos" : "más"}`);
  if (s.temp_delta_c) parts.push(`hace ${num(s.temp_delta_c, 1)} °C más`);
  if (s.irrigation) parts.push("se evalúa como si el lote tuviera riego");
  const rain = Math.round(baseline.scenarioRainMm) !== Math.round(baseline.rainMm) ? ` (${num(baseline.scenarioRainMm)} mm de lluvia al año en vez de ${num(baseline.rainMm)})` : "";
  return `${parts.join(", ")}${rain}`;
}
