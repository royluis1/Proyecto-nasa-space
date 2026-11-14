import type { Priorities, ScoreComponentKey } from "@/types/api";

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

export const PRIORITY_META: Record<PriorityKey, { label: string; help: string; group: string }> = {
  ahorrar_agua: { label: "Ahorrar agua", help: "Rotaciones que necesitan menos agua.", group: "Agua" },
  salud_suelo: { label: "Mejorar la salud del suelo", help: "Más cobertura, raíces y leguminosas.", group: "Suelo" },
  reducir_erosion: { label: "Reducir la erosión", help: "Menos meses con el suelo desnudo, sobre todo en la época de viento.", group: "Suelo" },
  materia_organica: { label: "Aumentar la materia orgánica", help: "Más rastrojo y raíces que se incorporan al suelo.", group: "Suelo" },
  riesgo_climatico: { label: "Reducir el riesgo climático", help: "Menos exposición a calor, heladas y variabilidad de lluvia.", group: "Riesgo" },
  riesgo_sequia: { label: "Reducir el riesgo de sequía", help: "Cultivos tolerantes y que cubran su demanda de agua. Cuenta para Agua y para Riesgo.", group: "Agua y riesgo" },
  ingreso: { label: "Aumentar el ingreso estimado", help: "Cultivos de mayor ingreso relativo (no son precios).", group: "Ingreso" },
  forraje: { label: "Producir forraje", help: "Pasturas y verdeos para la hacienda. Hoy suma al grupo Ingreso: el catálogo todavía no puntúa el forraje por separado.", group: "Ingreso" },
  diversificar: { label: "Diversificar cultivos", help: "Más cultivos y familias distintas.", group: "Sostenibilidad" },
  plagas: { label: "Reducir las plagas", help: "Evitar repetir cultivos seguidos y respetar los intervalos de retorno. Hoy suma al grupo Sostenibilidad.", group: "Sostenibilidad" },
  eventos_extremos: { label: "Sostener la producción ante eventos extremos", help: "Que no se caiga todo en un año seco o muy caluroso.", group: "Riesgo" },
};

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

export const PRIORITY_PRESETS: { id: string; name: string; description: string; values: Partial<UiPriorities> }[] = [
  { id: "equilibrado", name: "Equilibrado", description: "Todo igual de importante.", values: {} },
  {
    id: "agua",
    name: "Cuidar el agua",
    description: "Pocos recursos hídricos: prioriza ahorrar agua y no depender de la lluvia.",
    values: { ahorrar_agua: 10, riesgo_sequia: 9, eventos_extremos: 7, ingreso: 3, forraje: 3 },
  },
  {
    id: "suelo",
    name: "Cuidar el suelo",
    description: "Suelos arenosos o con erosión: prioriza cobertura y materia orgánica.",
    values: { salud_suelo: 10, reducir_erosion: 10, materia_organica: 9, diversificar: 8, ingreso: 3 },
  },
  {
    id: "ingreso",
    name: "Ingreso",
    description: "Prioriza el ingreso relativo, sin descuidar el riesgo.",
    values: { ingreso: 10, forraje: 6, riesgo_climatico: 6, ahorrar_agua: 3, reducir_erosion: 3, materia_organica: 3 },
  },
];

export function presetValues(id: string): UiPriorities {
  const preset = PRIORITY_PRESETS.find((p) => p.id === id);
  return { ...DEFAULT_UI_PRIORITIES, ...(preset?.values ?? {}) };
}
