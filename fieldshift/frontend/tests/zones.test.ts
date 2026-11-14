import { describe, expect, it } from "vitest";
import { demoFieldSoilMoisture, demoProvinces, demoSuitability, demoZoneAt, demoZones } from "@/lib/demo";
import { LEVEL_STYLES, ZONE_STYLES, climateRows, groupByLevel, levelFor, mapLabel, styleFor } from "@/lib/zones";
import type { CropSuitability } from "@/types/api";

describe("estilos del mapa: nunca solo color", () => {
  it("cada zona y cada nivel de aptitud tiene color, patrón y rótulo distintos", () => {
    for (const group of [Object.values(ZONE_STYLES), Object.values(LEVEL_STYLES)]) {
      expect(new Set(group.map((s) => s.color)).size).toBe(group.length);
      expect(new Set(group.map((s) => s.pattern)).size).toBe(group.length);
      expect(new Set(group.map((s) => s.label)).size).toBe(group.length);
    }
  });
  it("con un cultivo elegido, la zona se pinta y se rotula por su aptitud", () => {
    const props = { zone_class: "semiarido", zone_label: "Semiárida", suitability: [{ crop_id: "maiz", crop_name: "Maíz", level: "bajo" as const }] };
    expect(styleFor(props, null)).toBe(ZONE_STYLES.semiarido);
    expect(styleFor(props, "maiz")).toBe(LEVEL_STYLES.bajo);
    expect(levelFor(props, "soja")).toBeNull();
    expect(mapLabel(props, null)).toBe("Semiárida");
    expect(mapLabel(props, "maiz", "Maíz")).toBe("Semiárida: Maíz baja");
  });
  it("clima en texto y aptitud agrupada de alta a baja", () => {
    const rows = climateRows({ precip_mm: 548, et0_mm: 1360, deficit_mm: 812, aridity_index: 0.403, hot_days: 25.2, frost_days: 33, precip_cv_pct: null, years_other_class_pct: 27.3 });
    expect(rows.find(([k]) => k.startsWith("Índice"))?.[1]).toBe("0,40");
    expect(rows.find(([k]) => k.startsWith("Variabilidad"))?.[1]).toBe("sin dato");
    const item = (id: string, level: CropSuitability["level"]) => ({ crop_id: id, crop_name: id, level, reasons: [], risks: [], depends_on: [], confidence: "baja", note: "" }) as CropSuitability;
    expect(groupByLevel([item("a", "bajo"), item("b", "alto"), item("c", "bajo")]).map((g) => [g.level, g.items.length])).toEqual([["alto", 1], ["bajo", 2]]);
  });
});

describe("zonas y perfil (datos de ejemplo)", () => {
  it("provincias de Argentina, solo San Luis con zonas", async () => {
    const p = (await demoProvinces()).data;
    expect(p.features).toHaveLength(24);
    const withZones = p.features.filter((f) => (f.properties as { has_zones: boolean }).has_zones).map((f) => (f.properties as { id: string }).id);
    expect(withZones).toEqual(["san-luis"]);
    expect(p.source).toMatch(/IGN/);
    expect(p.license).toMatch(/27\.275/);
  });
  it("zonas de San Luis calculadas con NASA POWER (o la muestra rotulada) y el resto 'próximamente'", async () => {
    const z = (await demoZones("san-luis")).data;
    expect(z.available).toBe(true);
    if (z.origin === "sample") expect(z.warning).toMatch(/DATO DE MUESTRA/);
    else expect(z.origin === "cached" && z.period === "2015-2025" && Boolean(z.generated_at)).toBe(true);
    expect(z.zones.every((f) => Array.isArray((f.properties as { suitability: unknown[] }).suitability))).toBe(true);
    const c = (await demoZones("cordoba")).data;
    expect(c.available).toBe(false);
    expect(c.warning).toMatch(/próximamente/);
  });
  it("aptitud con validación agronómica y sin cultivos de alta demanda en 'alta' en la zona semiárida", async () => {
    const s = (await demoSuitability("san-luis-semiarido")).data;
    expect(s.crops.every((c) => c.note === "Requiere validación agronómica local.")).toBe(true);
    expect(s.crops.find((c) => c.crop_id === "maiz")?.level).toBe("bajo");
  });
  it("zona del campo con transición, opciones y aptitud en la otra zona", async () => {
    const z = (await demoZoneAt("campo-este")).data;
    expect(z.zone?.zone_class).toBeTruthy();
    expect(z.transition?.is_transition).toBe(true);
    expect(z.transition?.message).toMatch(/zona de transición entre/);
    expect(z.transition?.options).toHaveLength(4);
    expect(z.transition?.suitability_other.length).toBeGreaterThan(0);
    expect(z.top_crops.length).toBeGreaterThanOrEqual(3);
    const centro = (await demoZoneAt("campo-centro")).data.transition!;
    expect(centro.is_transition ? centro.reasons.length > 0 : centro.message === null).toBe(true);
  });
  it("humedad satelital: L3 observado y L4 modelado, con última observación y sin 'tiempo real'", async () => {
    const m = (await demoFieldSoilMoisture("campo-este")).data;
    expect(m.title).toBe("Humedad del suelo satelital (contexto regional)");
    expect(Object.fromEntries(m.products.map((p) => [p.product, p.label]))).toEqual({ SPL3SMP_E: "observado", SPL4SMGP_rootzone: "modelado" });
    expect(m.products.every((p) => p.last_observation && p.recent.length > 0)).toBe(true);
    expect(m.context).toMatch(/no es tiempo real/);
  });
});
