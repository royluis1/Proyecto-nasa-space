import { describe, expect, it } from "vitest";
import { droughtHistory, droughtSentence } from "@/lib/drought";
import type { ClimateSummary } from "@/types/api";

type Annual = ClimateSummary["annual"][number];
const year = (y: number, deficit: number | null, complete = true): Annual =>
  ({ year: y, complete, precip_mm: 700, precip_anomaly_pct: 0, t2m_mean: 16, tmax_max: 40, tmin_min: -5, heat_days: 30,
     et0_mm: 1200, deficit_mm: deficit, classification: "normal", heat_stress: false }) as Annual;

describe("historial de sequía", () => {
  it("usa solo años completos y con dato", () => {
    const h = droughtHistory([year(2020, 500), year(2021, 600, false), year(2022, null)]);
    expect(h.years.map((y) => y.year)).toEqual([2020]);
  });

  it("calcula el promedio y los dos años más secos", () => {
    const h = droughtHistory([year(2018, 400), year(2019, 700), year(2020, 500), year(2021, 650), year(2022, 450)]);
    expect(h.mean).toBe(540);
    expect(h.driest).toEqual([2019, 2021]);
  });

  it("la tendencia sube si el déficit crece año a año", () => {
    const h = droughtHistory([2016, 2017, 2018, 2019, 2020, 2021].map((y, i) => year(y, 400 + i * 20)));
    expect(h.slopePerDecade).toBeCloseTo(200, 5); // 20 mm por año = 200 por década
    expect(h.trend[2016]).toBeCloseTo(400, 5);
  });

  it("con menos de 5 años no dibuja tendencia", () => {
    const h = droughtHistory([year(2020, 500), year(2021, 600), year(2022, 550)]);
    expect(h.slopePerDecade).toBeNull();
    expect(h.trend).toEqual({});
  });

  it("sin años completos lo dice en vez de inventar", () => {
    expect(droughtSentence(droughtHistory([]), String)).toMatch(/No hay años completos/);
  });

  it("la frase aclara que la tendencia es orientativa", () => {
    const h = droughtHistory([2016, 2017, 2018, 2019, 2020, 2021].map((y, i) => year(y, 400 + i * 20)));
    expect(droughtSentence(h, String)).toMatch(/solo orientativa/);
  });
});
