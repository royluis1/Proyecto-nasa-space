import type { Priorities, ScoreComponentKey } from "@/types/api";
import { L, localize } from "./i18n";

/**
 * Las 11 prioridades que ve el productor (0 a 10). El backend puntúa con 5 componentes
 * (agua, suelo, riesgo, ingreso y sostenibilidad), así que cada control pertenece a uno o dos grupos
 * y el peso de cada grupo es el promedio de sus controles.
 */
export const PRIORITY_KEYS = [
  "ahorrar_agua",
  "salud_suelo",
  "reducir_erosion",
  "materia_organica",
  "riesgo_climatico",
  "riesgo_sequia",
  "ingreso",
  "forraje",
  "diversificar",
  "plagas",
  "eventos_extremos",
] as const;

export type PriorityKey = (typeof PRIORITY_KEYS)[number];
export type UiPriorities = Record<PriorityKey, number>;
export type GroupKey = keyof Priorities;

export const GROUPS: Record<GroupKey, PriorityKey[]> = {
  water: ["ahorrar_agua", "riesgo_sequia"],
  soil: ["salud_suelo", "reducir_erosion", "materia_organica"],
  risk: ["riesgo_climatico", "riesgo_sequia", "eventos_extremos"],
  income: ["ingreso", "forraje"],
  sustainability: ["diversificar", "plagas"],
};

export const GROUP_TO_COMPONENT: Record<GroupKey, ScoreComponentKey> = {
  water: "A",
  soil: "S",
  risk: "R",
  income: "I",
  sustainability: "E",
};

export const PRIORITY_META: Record<PriorityKey, { label: string; help: string; group: string }> = localize({
  ahorrar_agua: { label: L("Ahorrar agua", "Save water"), help: L("Rotaciones que necesitan menos agua.", "Rotations that need less water."), group: L("Agua", "Water") },
  salud_suelo: { label: L("Mejorar la salud del suelo", "Improve soil health"), help: L("Más cobertura, raíces y leguminosas.", "More cover, roots and legumes."), group: L("Suelo", "Soil") },
  reducir_erosion: { label: L("Reducir la erosión", "Reduce erosion"), help: L("Menos meses con el suelo desnudo, sobre todo en la época de viento.", "Fewer months of bare soil, especially in the windy season."), group: L("Suelo", "Soil") },
  materia_organica: { label: L("Aumentar la materia orgánica", "Increase organic matter"), help: L("Más rastrojo y raíces que se incorporan al suelo.", "More residue and roots added to the soil."), group: L("Suelo", "Soil") },
  riesgo_climatico: { label: L("Reducir el riesgo climático", "Reduce climate risk"), help: L("Menos exposición a calor, heladas y variabilidad de lluvia.", "Less exposure to heat, frost and rainfall variability."), group: L("Riesgo", "Risk") },
  riesgo_sequia: { label: L("Reducir el riesgo de sequía", "Reduce drought risk"), help: L("Cultivos tolerantes y que cubran su demanda de agua. Cuenta para Agua y para Riesgo.", "Tolerant crops that cover their water demand. Counts toward Water and Risk."), group: L("Agua y riesgo", "Water and risk") },
  ingreso: { label: L("Aumentar el ingreso estimado", "Increase estimated income"), help: L("Cultivos de mayor ingreso relativo (no son precios).", "Crops with higher relative income (not prices)."), group: L("Ingreso", "Income") },
  forraje: { label: L("Producir forraje", "Produce forage"), help: L("Pasturas y verdeos para la hacienda. Hoy suma al grupo Ingreso: el catálogo todavía no puntúa el forraje por separado.", "Pastures and green forage for livestock. Today it adds to the Income group: the catalog does not score forage separately yet."), group: L("Ingreso", "Income") },
  diversificar: { label: L("Diversificar cultivos", "Diversify crops"), help: L("Más cultivos y familias distintas.", "More crops and different families."), group: L("Sostenibilidad", "Sustainability") },
  plagas: { label: L("Reducir las plagas", "Reduce pests"), help: L("Evitar repetir cultivos seguidos y respetar los intervalos de retorno. Hoy suma al grupo Sostenibilidad.", "Avoid repeating crops back to back and respect return intervals. Today it adds to the Sustainability group."), group: L("Sostenibilidad", "Sustainability") },
  eventos_extremos: { label: L("Sostener la producción ante eventos extremos", "Sustain production through extreme events"), help: L("Que no se caiga todo en un año seco o muy caluroso.", "So that everything doesn't collapse in a dry or very hot year."), group: L("Riesgo", "Risk") },
});

export const DEFAULT_UI_PRIORITIES: UiPriorities = Object.fromEntries(PRIORITY_KEYS.map((k) => [k, 5])) as UiPriorities;

const clamp10 = (v: number) => Math.min(10, Math.max(0, Number.isFinite(v) ? v : 0));

/** Prioridades de la pantalla -> las 5 que entiende el backend (enteros de 0 a 10). */
export function toBackendPriorities(ui: UiPriorities): Priorities {
  const out = {} as Priorities;
  (Object.keys(GROUPS) as GroupKey[]).forEach((g) => {
    const vals = GROUPS[g].map((k) => clamp10(ui[k]));
    out[g] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  });
  return out;
}

/** Pesos normalizados (suman 1) de los 5 componentes. Si todo está en 0, pesos iguales (igual que el backend). */
export function componentWeights(p: Priorities): Record<ScoreComponentKey, number> {
  const raw: Record<ScoreComponentKey, number> = { A: p.water, S: p.soil, R: p.risk, I: p.income, E: p.sustainability };
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const keys = Object.keys(raw) as ScoreComponentKey[];
  return Object.fromEntries(keys.map((k) => [k, total === 0 ? 1 / keys.length : raw[k] / total])) as Record<ScoreComponentKey, number>;
}

export const weightsFromUi = (ui: UiPriorities) => componentWeights(toBackendPriorities(ui));

/** Valida lo que viene de localStorage: solo claves conocidas y números de 0 a 10. */
export function sanitizeUiPriorities(raw: unknown): UiPriorities {
  const out = { ...DEFAULT_UI_PRIORITIES };
  if (raw && typeof raw === "object") {
    for (const k of PRIORITY_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(clamp10(v));
    }
  }
  return out;
}

export const PRIORITY_PRESETS: { id: string; name: string; description: string; values: Partial<UiPriorities> }[] = localize([
  { id: "equilibrado", name: L("Equilibrado", "Balanced"), description: L("Todo igual de importante.", "Everything equally important."), values: {} },
  {
    id: "agua",
    name: L("Cuidar el agua", "Care for water"),
    description: L("Pocos recursos hídricos: prioriza ahorrar agua y no depender de la lluvia.", "Scarce water: prioritizes saving water and not depending on rain."),
    values: { ahorrar_agua: 10, riesgo_sequia: 9, eventos_extremos: 7, ingreso: 3, forraje: 3 },
  },
  {
    id: "suelo",
    name: L("Cuidar el suelo", "Care for the soil"),
    description: L("Suelos arenosos o con erosión: prioriza cobertura y materia orgánica.", "Sandy or eroded soils: prioritizes cover and organic matter."),
    values: { salud_suelo: 10, reducir_erosion: 10, materia_organica: 9, diversificar: 8, ingreso: 3 },
  },
  {
    id: "ingreso",
    name: L("Ingreso", "Income"),
    description: L("Prioriza el ingreso relativo, sin descuidar el riesgo.", "Prioritizes relative income without neglecting risk."),
    values: { ingreso: 10, forraje: 6, riesgo_climatico: 6, ahorrar_agua: 3, reducir_erosion: 3, materia_organica: 3 },
  },
]);

export function presetValues(id: string): UiPriorities {
  const preset = PRIORITY_PRESETS.find((p) => p.id === id);
  return { ...DEFAULT_UI_PRIORITIES, ...(preset?.values ?? {}) };
}
