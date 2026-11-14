import presetsJson from "./demo/data/scenario-presets.json";
import { scenarioTable } from "./ranking";
import type { IrrigationLevel, ScenarioInput, ScenarioPreset, ScenarioResult, ScoreComponentKey } from "@/types/api";

export type ScenarioGroup = ScenarioPreset["group"];
export type PresetScenario = ScenarioInput & { help: string; group: ScenarioGroup };

/**
 * Los 12 escenarios predefinidos. Salen del backend (app/services/engine/scenarios.py) vía scripts/export_demo_data.py,
 * así el frontend y el servidor usan exactamente los mismos. Son pruebas de sensibilidad, no pronósticos.
 */
export const PRESET_SCENARIOS: PresetScenario[] = (presetsJson as ScenarioPreset[]).map((p) => ({ ...p.scenario, help: p.help, group: p.group }));

export const BASE_ID = "base";
export const CUSTOM_ID = "personalizado";

export const GROUP_LABELS: Record<ScenarioGroup, string> = {
  clima: "Tipo de año",
  eventos: "Eventos extremos",
  lluvia: "Menos lluvia",
  temperatura: "Más temperatura",
  riego: "Riego",
};
export const GROUP_ORDER: ScenarioGroup[] = ["clima", "eventos", "lluvia", "temperatura", "riego"];

export const IRRIGATION_LABELS: Record<IrrigationLevel, string> = {
  lote: "Como está mi campo",
  sin_riego: "Sin riego",
  limitado: "Riego limitado",
  disponible: "Riego disponible",
};

/** Escenario completo, con los valores por defecto del servidor (para pedidos y comparaciones). */
export function normalizeScenario(s: ScenarioInput): Required<ScenarioInput> {
  return {
    id: s.id,
    name: s.name,
    rain_delta_pct: s.rain_delta_pct ?? 0,
    temp_delta_c: s.temp_delta_c ?? 0,
    dry_year: s.dry_year ?? false,
    irrigation: s.irrigation ?? false,
    irrigation_level: s.irrigation_level ?? (s.irrigation ? "disponible" : "lote"),
    heat_wave: s.heat_wave ?? false,
    heavy_rain: s.heavy_rain ?? false,
  };
}

/** Solo lo que manda el servidor (sin ayuda ni grupo). */
export function toRequest(s: ScenarioInput): Required<ScenarioInput> {
  return normalizeScenario({ ...s }); // normalizeScenario copia solo los campos del escenario
}

/** Mismo efecto climático y de riego (sin mirar id ni nombre). */
export function sameEffect(a: ScenarioInput, b: ScenarioInput): boolean {
  const x = normalizeScenario(a);
  const y = normalizeScenario(b);
  return (
    x.rain_delta_pct === y.rain_delta_pct && x.temp_delta_c === y.temp_delta_c && x.dry_year === y.dry_year &&
    x.irrigation_level === y.irrigation_level && x.heat_wave === y.heat_wave && x.heavy_rain === y.heavy_rain
  );
}

/** ¿Es el año normal, sin cambios? */
export const isBaseline = (s: ScenarioInput | null | undefined): boolean => !s || sameEffect(s, { id: BASE_ID, name: "" });

export interface CustomScenario {
  rain: number;
  temp: number;
  dry: boolean;
  heatWave: boolean;
  heavyRain: boolean;
  irrigation: IrrigationLevel;
}

export const DEFAULT_CUSTOM: CustomScenario = { rain: -20, temp: 1, dry: false, heatWave: false, heavyRain: false, irrigation: "lote" };

export function customScenario(c: CustomScenario): Required<ScenarioInput> {
  const parts = [
    c.rain !== 0 ? `lluvia ${c.rain > 0 ? "+" : ""}${c.rain} %` : null,
    c.temp > 0 ? `+${String(c.temp).replace(".", ",")} °C` : null,
    c.dry ? "año seco" : null,
    c.heavyRain ? "lluvias intensas" : null,
    c.heatWave ? "olas de calor" : null,
    c.irrigation !== "lote" ? IRRIGATION_LABELS[c.irrigation].toLowerCase() : null,
  ].filter(Boolean);
  return normalizeScenario({
    id: CUSTOM_ID,
    name: parts.length ? `Mi escenario: ${parts.join(", ")}` : "Mi escenario",
    rain_delta_pct: c.rain,
    temp_delta_c: c.temp,
    dry_year: c.dry,
    heat_wave: c.heatWave,
    heavy_rain: c.heavyRain,
    irrigation_level: c.irrigation,
  });
}

/** Cambia el riego de un escenario. "lote" deja el escenario como está. */
export function withIrrigationLevel(s: ScenarioInput, level: IrrigationLevel): Required<ScenarioInput> {
  const n = normalizeScenario(s);
  if (level === "lote" || n.irrigation_level === level) return n;
  const label = IRRIGATION_LABELS[level].toLowerCase();
  return { ...n, id: `${n.id}+${level}`, name: n.id === BASE_ID ? `Año normal, ${label}` : `${n.name}, ${label}`, irrigation: false, irrigation_level: level };
}

/** Partes del escenario en palabras simples. */
export function scenarioParts(s: ScenarioInput): string[] {
  const n = normalizeScenario(s);
  const parts: string[] = [];
  if (n.dry_year) parts.push("se repite el año más seco de los últimos 10");
  if (n.heavy_rain) parts.push("llueve mucho más de octubre a marzo, en tormentas");
  if (n.heat_wave) parts.push("hay olas de calor en verano");
  if (n.rain_delta_pct) parts.push(`llueve ${Math.abs(n.rain_delta_pct)} % ${n.rain_delta_pct < 0 ? "menos" : "más"}`);
  if (n.temp_delta_c) parts.push(`hace ${String(n.temp_delta_c).replace(".", ",")} °C más`);
  if (n.irrigation_level === "sin_riego") parts.push("el lote se evalúa sin riego");
  if (n.irrigation_level === "limitado") parts.push("hay riego limitado (la mitad del agua)");
  if (n.irrigation_level === "disponible") parts.push("se evalúa como si el lote tuviera riego");
  return parts;
}

/* ------------------------------ resistencia ------------------------------ */

export interface ScenarioCells {
  scenario: ScenarioInput;
  cells: Record<string, { total: number; rank: number }>;
}

/** Puntajes con las prioridades actuales para cada escenario (se recalcula al instante al mover prioridades). */
export function scenarioMatrix(results: ScenarioResult[], weights: Record<ScoreComponentKey, number>, actualId?: string): ScenarioCells[] {
  return results.map((r) => ({ scenario: r.scenario, cells: scenarioTable(r.ranking, weights, actualId) }));
}

export interface Resilience {
  id: string;
  mean: number;
  worst: number;
  worstScenario: string;
  worstRank: number;
  wins: number;
  /** Mayor caída frente al año normal (o al primer escenario). */
  maxDrop: number;
}

/** Qué rotación aguanta mejor: menor peor puesto, después mejor peor puntaje y mejor promedio (mismo criterio que el backend). */
export function resilience(matrix: ScenarioCells[]): Resilience[] {
  if (!matrix.length) return [];
  const base = matrix.find((m) => m.scenario.id === BASE_ID) ?? matrix[0];
  const ids = Object.keys(base.cells);
  return ids
    .map((id) => {
      const items = matrix.filter((m) => m.cells[id]).map((m) => ({ name: m.scenario.name, ...m.cells[id] }));
      const worst = items.reduce((a, b) => (b.total < a.total ? b : a));
      return {
        id,
        mean: items.reduce((a, b) => a + b.total, 0) / items.length,
        worst: worst.total,
        worstScenario: worst.name,
        worstRank: Math.max(...items.map((i) => i.rank)),
        wins: items.filter((i) => i.rank === 1).length,
        maxDrop: Math.max(0, ...items.map((i) => base.cells[id].total - i.total)),
      };
    })
    .sort((a, b) => a.worstRank - b.worstRank || b.worst - a.worst || b.mean - a.mean);
}

/** Cambio de una rotación entre el año normal y otro escenario. */
export function impact(base: ScenarioCells, other: ScenarioCells, id: string): { delta: number; rankDelta: number } | null {
  const a = base.cells[id];
  const b = other.cells[id];
  if (!a || !b) return null;
  return { delta: b.total - a.total, rankDelta: a.rank - b.rank };
}

/** La mejor rotación de un escenario. */
export const bestOf = (cells: ScenarioCells["cells"]): string | undefined => Object.keys(cells).find((id) => cells[id].rank === 1);
