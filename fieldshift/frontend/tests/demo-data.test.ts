import { describe, expect, it } from "vitest";
import { EXAMPLE_IDS, demoClimate, demoCompare, demoCrops, demoFields, demoRotations, demoScenarios, demoSoilMoisture, demoVegetation } from "@/lib/demo";

describe("datos de ejemplo (modo demostración)", () => {
  it("hay 16 cultivos y 3 campos", async () => {
    expect((await demoCrops()).data.length).toBeGreaterThanOrEqual(16);
    expect((await demoFields()).data.map((f) => f.id)).toEqual(expect.arrayContaining([...EXAMPLE_IDS]));
  });

  it.each(EXAMPLE_IDS)("%s: todo está presente y marcado como ejemplo", async (id) => {
    const compare = await demoCompare(id);
    expect(compare.meta.origin_label).toBe("DATOS DE EJEMPLO (SIN CONEXIÓN)");
    const evals = compare.data.evaluations;
    expect(evals.length).toBeGreaterThanOrEqual(3);
    expect(evals.some((e) => e.rotation.strategy === "actual")).toBe(true);
    for (const e of evals) {
      expect(e.recommendation.why.length).toBeGreaterThan(50);
      expect(e.recommendation.validation_note).toMatch(/agrónomo/);
      expect(e.score.components).toHaveLength(5);
    }
    expect((await demoClimate(id)).data.monthly_climatology).toHaveLength(12);
    expect((await demoSoilMoisture(id)).data.trace.label).toBe("modelado");
    expect((await demoVegetation(id)).data.trace.label).toBe("observado");
    expect((await demoRotations(id)).length).toBe(evals.length);
    const sc = await demoScenarios(id, [{ id: "seco-20", name: "", rain_delta_pct: -20, temp_delta_c: 0, dry_year: false, irrigation: false }]);
    expect(sc.data).toHaveLength(1);
    expect(sc.data[0].ranking.length).toBe(evals.length);
  });

  it("un campo guardado solo en el navegador usa el ejemplo más cercano y lo dice", async () => {
    const r = await demoCompare("local-abc");
    expect(r.meta.warnings.join(" ")).toMatch(/ejemplo más cercano|campo de ejemplo/);
    expect(r.data.field_id).toBe("local-abc");
  });
});
