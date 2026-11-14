import { describe, expect, it } from "vitest";
import { buildCalendar, fallowMonths, stepLength } from "@/lib/calendar";

const step = (crop_id: string, year: number, start_month: number, end_month: number) => ({ crop_id, year, start_month, end_month });

describe("calendario de la rotación", () => {
  it("el largo de un paso cuenta los meses, incluso cruzando de año", () => {
    expect(stepLength({ start_month: 11, end_month: 4 })).toBe(6);
    expect(stepLength({ start_month: 5, end_month: 9 })).toBe(5);
    expect(stepLength({ start_month: 3, end_month: 3 })).toBe(1);
  });

  it("soja (nov-abr) y maíz (oct-mar): ocupación y barbecho", () => {
    const cal = buildCalendar({ duration_years: 2, steps: [step("soja", 1, 11, 4), step("maiz", 2, 10, 3)] });
    expect(cal.nMonths).toBe(24);
    expect(cal.owner[10]).toBe(0); // noviembre del año 1: soja
    expect(cal.owner[5]).toBeNull(); // junio del año 1: barbecho
    expect(cal.owner[0]).toBe(1); // enero del año 1: todavía el maíz del año 2 anterior (cíclico)
    expect(fallowMonths(cal)).toBe(24 - 12);
    expect(cal.conflicts).toEqual([]);
  });

  it("un mes puede ser la cosecha de uno y la siembra del siguiente: queda para el que empieza", () => {
    const cal = buildCalendar({ duration_years: 2, steps: [step("soja", 1, 11, 4), step("cob", 2, 4, 9), step("maiz", 2, 10, 3)] });
    const april = 12 + 3; // abril del año 2
    expect(cal.steps[cal.owner[april] as number].step.crop_id).toBe("cob");
    expect(cal.conflicts).toEqual([]);
  });

  it("detecta superposiciones reales", () => {
    const cal = buildCalendar({ duration_years: 1, steps: [step("a", 1, 1, 6), step("b", 1, 4, 9)] });
    expect(cal.conflicts.length).toBeGreaterThan(0);
  });

  it("ordena los pasos cronológicamente aunque vengan desordenados", () => {
    const cal = buildCalendar({ duration_years: 2, steps: [step("maiz", 2, 10, 3), step("soja", 1, 11, 4)] });
    expect(cal.steps.map((p) => p.step.crop_id)).toEqual(["soja", "maiz"]);
  });
});

import { rotationTitle } from "@/lib/format";

describe("nombre de la rotación", () => {
  it("quita el prefijo de estrategia para no repetirlo junto a la etiqueta", () => {
    expect(rotationTitle({ name: "Mixta recomendada: Cobertura – soja", strategy: "mixta" })).toBe("Cobertura – soja");
    expect(rotationTitle({ name: "Conservadora: Soja – Maíz", strategy: "conservadora" })).toBe("Soja – Maíz");
    expect(rotationTitle({ name: "Soja – maíz con barbecho", strategy: "actual" })).toBe("Soja – maíz con barbecho");
  });
});
