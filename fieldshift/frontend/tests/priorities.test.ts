import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_PRIORITIES, GROUPS, PRIORITY_KEYS, PRIORITY_PRESETS, componentWeights, presetValues, sanitizeUiPriorities, toBackendPriorities, weightsFromUi,
} from "@/lib/priorities";

describe("prioridades", () => {
  it("hay 11 controles y cada uno pertenece a algún grupo", () => {
    expect(PRIORITY_KEYS).toHaveLength(11);
    const grouped = new Set(Object.values(GROUPS).flat());
    for (const k of PRIORITY_KEYS) expect(grouped.has(k)).toBe(true);
  });

  it("con todo en 5, las 5 prioridades del backend son 5 y los pesos son iguales", () => {
    const b = toBackendPriorities(DEFAULT_UI_PRIORITIES);
    expect(b).toEqual({ water: 5, soil: 5, risk: 5, income: 5, sustainability: 5 });
    Object.values(componentWeights(b)).forEach((w) => expect(w).toBeCloseTo(0.2));
  });

  it("cada grupo usa el promedio de sus controles, redondeado", () => {
    const b = toBackendPriorities({ ...DEFAULT_UI_PRIORITIES, salud_suelo: 10, reducir_erosion: 5, materia_organica: 5 });
    expect(b.soil).toBe(7); // (10 + 5 + 5) / 3 = 6,67
    expect(b.water).toBe(5);
  });

  it("'reducir el riesgo de sequía' cuenta para agua y para riesgo", () => {
    const b = toBackendPriorities({ ...DEFAULT_UI_PRIORITIES, riesgo_sequia: 10 });
    expect(b.water).toBe(8); // (5 + 10) / 2 = 7,5 -> 8
    expect(b.risk).toBe(7); // (5 + 10 + 5) / 3 = 6,67 -> 7
  });

  it("los pesos suman 1 y respetan el orden", () => {
    const w = weightsFromUi({ ...DEFAULT_UI_PRIORITIES, ahorrar_agua: 10, riesgo_sequia: 10, ingreso: 0, forraje: 0 });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(w.A).toBeGreaterThan(w.S);
    expect(w.I).toBe(0);
  });

  it("todo en 0 da pesos iguales (como el backend)", () => {
    const zero = Object.fromEntries(PRIORITY_KEYS.map((k) => [k, 0])) as typeof DEFAULT_UI_PRIORITIES;
    Object.values(weightsFromUi(zero)).forEach((w) => expect(w).toBeCloseTo(0.2));
  });

  it("sanitiza lo que viene de localStorage", () => {
    const s = sanitizeUiPriorities({ ahorrar_agua: 99, salud_suelo: "hola", inventada: 3, ingreso: -4, plagas: 7.6 });
    expect(s.ahorrar_agua).toBe(10);
    expect(s.salud_suelo).toBe(5);
    expect(s.ingreso).toBe(0);
    expect(s.plagas).toBe(8);
    expect("inventada" in s).toBe(false);
    expect(sanitizeUiPriorities(null)).toEqual(DEFAULT_UI_PRIORITIES);
  });

  it("las combinaciones predefinidas son válidas y distintas", () => {
    const seen = new Set(PRIORITY_PRESETS.map((p) => JSON.stringify(presetValues(p.id))));
    expect(seen.size).toBe(PRIORITY_PRESETS.length);
    for (const p of PRIORITY_PRESETS) Object.values(presetValues(p.id)).forEach((v) => expect(v >= 0 && v <= 10).toBe(true));
  });
});
