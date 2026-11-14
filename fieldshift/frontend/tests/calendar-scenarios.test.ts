import { describe, expect, it } from "vitest";
import { demoCalendar, demoCompare, demoScenarios, demoTerrain, nextCampaignYear, shiftTimeline } from "@/lib/demo";
import { friendlyWarning } from "@/lib/plain";
import { DEFAULT_UI_PRIORITIES, componentWeights, toBackendPriorities } from "@/lib/priorities";
import { rerank } from "@/lib/ranking";
import { buildReportModel, pdfSafe, reportCsv, reportPdf } from "@/lib/report";
import {
  BASE_ID, CUSTOM_ID, PRESET_SCENARIOS, customScenario, impact, isBaseline, normalizeScenario, resilience, sameEffect, scenarioMatrix, toRequest,
} from "@/lib/scenarios";
import { adviceFor, campaignSummary, cropSpans, describeMonth, stageText, timelineTotals, worstLevel } from "@/lib/timeline";
import type { TimelineMonth } from "@/types/api";

const W = componentWeights(toBackendPriorities(DEFAULT_UI_PRIORITIES));

describe("escenarios predefinidos", () => {
  it("están los 12 que pide el bloque, iguales a los del backend", () => {
    expect(PRESET_SCENARIOS.map((p) => p.id)).toEqual([
      "base", "anio-seco", "lluvias-intensas", "olas-calor", "lluvia-10", "lluvia-20", "lluvia-30", "temp-1", "temp-2",
      "sin-riego", "riego-limitado", "riego-disponible",
    ]);
    const by = Object.fromEntries(PRESET_SCENARIOS.map((p) => [p.id, p]));
    expect(by["lluvia-30"].rain_delta_pct).toBe(-30);
    expect(by["temp-1"].temp_delta_c).toBe(1);
    expect(by["olas-calor"].heat_wave).toBe(true);
    expect(by["lluvias-intensas"].heavy_rain).toBe(true);
    expect(by["riego-limitado"].irrigation_level).toBe("limitado");
    expect(PRESET_SCENARIOS.every((p) => p.help && p.group)).toBe(true);
  });
  it("el pedido no lleva la ayuda ni el grupo y completa los valores por defecto", () => {
    const req = toRequest(PRESET_SCENARIOS[3]);
    expect(req).not.toHaveProperty("help");
    expect(req).not.toHaveProperty("group");
    expect(normalizeScenario({ id: "a", name: "a" })).toMatchObject({ rain_delta_pct: 0, irrigation_level: "lote", heat_wave: false });
    expect(normalizeScenario({ id: "a", name: "a", irrigation: true }).irrigation_level).toBe("disponible");
  });
  it("reconoce el año normal y escenarios con el mismo efecto", () => {
    expect(isBaseline(null)).toBe(true);
    expect(isBaseline(PRESET_SCENARIOS[0])).toBe(true);
    expect(isBaseline(PRESET_SCENARIOS[1])).toBe(false);
    expect(sameEffect({ id: "x", name: "", rain_delta_pct: -20 }, PRESET_SCENARIOS.find((p) => p.id === "lluvia-20")!)).toBe(true);
  });
  it("arma un escenario propio con nombre legible", () => {
    const s = customScenario({ rain: -10, temp: 1.5, dry: false, heatWave: true, heavyRain: false, irrigation: "limitado" });
    expect(s.id).toBe(CUSTOM_ID);
    expect(s.name).toBe("Mi escenario: lluvia -10 %, +1,5 °C, olas de calor, riego limitado");
    expect(s).toMatchObject({ rain_delta_pct: -10, temp_delta_c: 1.5, heat_wave: true, irrigation_level: "limitado" });
  });
});

async function allScenarios(id = "campo-este") {
  return (await demoScenarios(id, PRESET_SCENARIOS)).data;
}

describe("simulador: recálculo y resistencia", () => {
  it("con datos de ejemplo hay resultados, riesgos y explicaciones para los 12", async () => {
    const res = await allScenarios();
    expect(res).toHaveLength(12);
    for (const r of res) {
      expect(r.ranking.length).toBeGreaterThan(2);
      expect(r.rotations).toHaveLength(r.ranking.length);
      expect(r.rotations.every((n) => n.why.length > 20)).toBe(true);
    }
  });
  it("menos lluvia baja el puntaje de la mejor opción y el riego lo sube", async () => {
    const m = scenarioMatrix(await allScenarios(), W);
    const best = (id: string) => Math.max(...Object.values(m.find((x) => x.scenario.id === id)!.cells).map((c) => c.total));
    expect(best("lluvia-10")).toBeLessThan(best(BASE_ID));
    expect(best("lluvia-30")).toBeLessThan(best("lluvia-10"));
    expect(best("riego-disponible")).toBeGreaterThan(best("riego-limitado"));
    expect(best("riego-limitado")).toBeGreaterThan(best(BASE_ID));
  });
  it("el ranking de cada escenario sigue las prioridades al instante", async () => {
    const res = await allScenarios();
    const water = componentWeights({ water: 10, soil: 0, risk: 0, income: 0, sustainability: 0 });
    const income = componentWeights({ water: 0, soil: 0, risk: 0, income: 10, sustainability: 0 });
    const a = scenarioMatrix(res, water)[0].cells;
    const b = scenarioMatrix(res, income)[0].cells;
    expect(Object.keys(a).some((id) => a[id].rank !== b[id].rank)).toBe(true);
  });
  it("calcula el impacto frente al año normal", async () => {
    const m = scenarioMatrix(await allScenarios(), W);
    const base = m[0];
    const dry = m.find((x) => x.scenario.id === "lluvia-30")!;
    const id = Object.keys(base.cells)[0];
    const d = impact(base, dry, id)!;
    expect(d.delta).toBeCloseTo(dry.cells[id].total - base.cells[id].total, 6);
    expect(d.rankDelta).toBe(base.cells[id].rank - dry.cells[id].rank);
    expect(impact(base, dry, "no-existe")).toBeNull();
  });
  it("la más resistente nunca cae al fondo y está primera", async () => {
    const res = resilience(scenarioMatrix(await allScenarios(), W));
    expect(res.length).toBeGreaterThan(2);
    for (let i = 1; i < res.length; i++) expect(res[i - 1].worstRank).toBeLessThanOrEqual(res[i].worstRank);
    const top = res[0];
    expect(top.worst).toBeLessThanOrEqual(top.mean);
    expect(top.maxDrop).toBeGreaterThanOrEqual(0);
    expect(PRESET_SCENARIOS.map((p) => p.name)).toContain(top.worstScenario);
  });
  it("resistencia con datos armados: a igual peor puesto, desempata por el peor puntaje", () => {
    const m = [
      { scenario: { id: "base", name: "Normal" }, cells: { a: { total: 80, rank: 1 }, b: { total: 75, rank: 2 } } },
      { scenario: { id: "seco", name: "Seco" }, cells: { b: { total: 70, rank: 1 }, a: { total: 50, rank: 2 } } },
    ];
    const r = resilience(m);
    expect(r[0].id).toBe("b");
    expect(r.find((x) => x.id === "a")).toMatchObject({ maxDrop: 30, worstScenario: "Seco", wins: 1 });
    expect(r.find((x) => x.id === "b")).toMatchObject({ mean: 72.5, maxDrop: 5 });
  });
});

describe("calendario agrícola", () => {
  it("de ejemplo: 2 a 4 campañas de julio a junio, empezando en la próxima campaña", async () => {
    for (const n of [2, 3, 4]) {
      const tl = (await demoCalendar("campo-este", { field_id: "campo-este", campaigns: n })).data;
      expect(tl.campaigns).toHaveLength(n);
      const first = nextCampaignYear();
      expect(tl.campaigns[0].label).toBe(`${first}/${String(first + 1).slice(-2)}`);
      for (const c of tl.campaigns) {
        expect(c.months).toHaveLength(12);
        expect(c.months[0].month).toBe(7);
        expect(c.months[0].label).toMatch(new RegExp(`jul ${first + c.index - 1}`));
      }
      expect(tl.advice.every((a) => a.campaigns.every((x) => x <= n))).toBe(true);
    }
  });
  it("cada mes tiene etapa, cobertura y riesgos coherentes", async () => {
    const tl = (await demoCalendar("campo-centro", { field_id: "campo-centro", campaigns: 4 })).data;
    const months = tl.campaigns.flatMap((c) => c.months);
    expect(months.some((m) => m.stage === "siembra")).toBe(true);
    expect(months.some((m) => m.stage === "cosecha")).toBe(true);
    for (const m of months) {
      if (m.crop_id) expect(m.heat_risk && m.water_risk).toBeTruthy();
      else expect(m.stage).toBe("barbecho");
      expect(m.bare_soil).toBe(m.cover === "desnudo");
    }
    expect(tl.data_used.join(" ")).toMatch(/NASA POWER/);
    expect(tl.data_used.join(" ")).toMatch(/SMAP/);
    expect(tl.data_used.join(" ")).toMatch(/NDVI/);
  });
  it("elige la rotación pedida y avisa si el escenario no está precalculado", async () => {
    const rots = (await demoCompare("campo-este")).data.evaluations;
    const actual = rots.find((e) => e.rotation.strategy === "actual")!;
    const r = await demoCalendar("campo-este", { field_id: "campo-este", rotation_id: actual.rotation.id, scenario: PRESET_SCENARIOS[1] });
    expect(r.data.rotation.id).toBe(actual.rotation.id);
    expect(r.meta.warnings.join(" ")).toMatch(/solo para el año normal/);
  });
  it("corre los años de etiquetas y textos", async () => {
    const tl = (await demoCalendar("campo-este", { field_id: "campo-este", campaigns: 2, first_campaign_year: 2030 })).data;
    const moved = shiftTimeline(tl, 2041);
    expect(moved.campaigns[0].label).toBe("2041/42");
    expect(moved.campaigns[1].months[11]).toMatchObject({ year: 2043, label: "jun 2043" });
    expect(moved.advice.map((a) => a.text).join(" ")).not.toMatch(/\b203\d\b/);
  });
  it("junta meses en tramos y los describe en palabras", () => {
    const m = (crop: string | null, stage: TimelineMonth["stage"], extra: Partial<TimelineMonth> = {}): TimelineMonth => ({
      index: 0, campaign: 1, year: 2027, month: 7, label: "jul 2027", crop_id: crop, crop_name: crop, is_cover_crop: false, stage, harvest_of: null,
      cover: crop ? "cultivo" : "desnudo", bare_soil: !crop, heat_risk: crop ? "bajo" : null, water_risk: crop ? "alto" : null,
      heat_days_pct: 0, precip_mm: 0, et0_mm: 0, water_stress_pct: null, ...extra,
    });
    const months = [m(null, "barbecho"), m(null, "barbecho"), m("Soja", "siembra"), m("Soja", "desarrollo"), m("Soja", "cosecha"), m("Soja", "siembra")];
    expect(cropSpans(months).map((s) => [s.cropId, s.length])).toEqual([[null, 2], ["Soja", 3], ["Soja", 1]]);
    expect(describeMonth(months[2])).toBe("Soja: siembra, cultivo vivo, riesgo de calor bajo, riesgo de falta de agua alto");
    expect(describeMonth(m("Vicia", "siembra", { harvest_of: "Maíz" }))).toMatch(/cosecha de Maíz/);
    expect(stageText(m("Vicia", "cosecha", { is_cover_crop: true }))).toBe("Fin de la cobertura");
    expect(worstLevel(["bajo", null, "alto", "medio"])).toBe("alto");
    expect(worstLevel([null])).toBeNull();
  });
  it("resume cada campaña y el total", async () => {
    const tl = (await demoCalendar("campo-este", { field_id: "campo-este", campaigns: 3 })).data;
    const c = tl.campaigns[0];
    expect(campaignSummary(c)).toMatch(new RegExp(`^${c.covered_months} mes`));
    const t = timelineTotals(tl);
    expect(t.covered).toBe(tl.campaigns.reduce((a, x) => a + x.covered_months, 0));
    expect(adviceFor(tl.advice, 1).length).toBeGreaterThan(0);
  });
});

async function reportInput(withExtras = true) {
  const { data } = await demoCompare("campo-este");
  const evaluations = rerank(data.evaluations, W);
  const field = (await import("@/lib/demo/data/fields.json")).default.find((f: { id: string }) => f.id === "campo-este");
  const res = resilience(scenarioMatrix(await allScenarios(), W));
  const tl = (await demoCalendar("campo-este", { field_id: "campo-este", campaigns: 3 })).data;
  return {
    field, ui: DEFAULT_UI_PRIORITIES, weights: W, result: data, evaluations, origin: "DATOS DE EJEMPLO (SIN CONEXIÓN)",
    generatedAt: new Date("2026-11-14T15:00:00Z"), resilience: withExtras ? res : null, timeline: withExtras ? tl : null,
  } as Parameters<typeof buildReportModel>[0];
}

describe("reporte exportable", () => {
  it("incluye todo lo que pide el bloque", async () => {
    const m = buildReportModel(await reportInput());
    expect(m.field.map(([k]) => k)).toEqual(expect.arrayContaining(["Nombre", "Superficie", "Ubicación", "Riego", "Suelo"]));
    expect(m.priorities).toHaveLength(11);
    expect(m.climate.map(([k]) => k).join(" ")).toMatch(/Lluvia media.*ET0.*aridez.*SMAP.*NDVI/);
    expect(m.ranking.rows.length).toBe(m.explanations.length);
    expect(m.recommendation.why.length).toBeGreaterThan(20);
    expect(m.assumptions.length).toBeGreaterThan(0);
    expect(m.sources.join(" ")).toMatch(/POWER/);
    expect(m.disclaimer).toMatch(/agrónomo/);
    expect(m.generated).toBe("14 de noviembre de 2026");
    expect(m.resilience?.rows.length).toBe(m.ranking.rows.length);
    expect(m.calendar?.campaigns).toHaveLength(3);
  });
  it("sin escenarios ni calendario, esas secciones no aparecen", async () => {
    const m = buildReportModel(await reportInput(false));
    expect(m.resilience).toBeNull();
    expect(m.calendar).toBeNull();
    expect(reportCsv(m)).not.toMatch(/Resistencia/);
  });
  it("CSV por secciones, con BOM y fecha", async () => {
    const csv = reportCsv(buildReportModel(await reportInput()));
    expect(csv.startsWith("﻿")).toBe(true);
    for (const s of ["campo,", "prioridades,", "clima,", "recomendacion,", "supuesto,", "fuente,", "advertencia,", "calendario,", "# Resistencia"]) {
      expect(csv).toContain(s);
    }
    expect(csv).toContain("# Generado,2026-11-14T15:00:00.000Z");
  });
  it("el texto del PDF solo usa caracteres latinos", () => {
    expect(pdfSafe("Σ peso × valor → ≥ 3 – “ok” … año ñ °C ±")).toBe('Suma peso x valor -> >= 3 - "ok" ... año ñ °C ±');
    expect(pdfSafe("riesgo 🌵 alto")).toBe("riesgo  alto");
  });
  it("genera un PDF de varias páginas con las secciones", async () => {
    const doc = await reportPdf(buildReportModel(await reportInput()));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const raw = doc.output();
    expect(raw.startsWith("%PDF-")).toBe(true);
    for (const t of ["Recomendaci", "Datos del campo", "Prioridades del productor", "Resumen clim", "Rotaciones comparadas", "Supuestos", "Fuentes", "Advertencias", "Resistencia", "Calendario del plan"]) {
      expect(raw).toContain(t);
    }
  });
});

describe("relieve (SRTM vía Earthdata)", () => {
  it("de ejemplo: pendiente y altura de cada campo, marcadas como muestra", async () => {
    const r = await demoTerrain("campo-conlara");
    expect(r.data).toMatchObject({ tile: "S33W066", product: "SRTMGL1", slope_class: "suave", origin: "sample" });
    expect(r.data.elevation_max_m).toBeGreaterThan(r.data.elevation_min_m);
    expect(r.meta.warnings.join(" ")).toMatch(/MUESTRA SIMULADA/);
  });
  it("traduce los avisos de SRTM", () => {
    expect(friendlyWarning("SRTM: SRTM no disponible (sin credenciales de Earthdata (FIELDSHIFT_EARTHDATA_USERNAME y _PASSWORD)).")).toMatch(/cuenta de Earthdata/);
    expect(friendlyWarning("SRTM: Se usa un relieve de MUESTRA SIMULADA del sitio 'x': no es una medición de tu lote.")).toMatch(/SIMULADA/);
  });
  it("el motor usa la pendiente del relieve", async () => {
    const r = (await demoCompare("campo-conlara")).data;
    expect(r.inputs.soil.slope_pct).toBe(2.3);
  });
});
