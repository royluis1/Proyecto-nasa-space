import { describe, expect, it } from "vitest";
import { demoCompare } from "@/lib/demo";
import { buildCsv, buildJson, safeFilename } from "@/lib/export";

describe("exportación del reporte", async () => {
  const { data } = await demoCompare("campo-este");

  it("el CSV lleva BOM, advertencia, origen y una fila por rotación", () => {
    const csv = buildCsv("Campo Este", "DATOS DE EJEMPLO", data, data.evaluations);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("# AgroOrbit es una herramienta de apoyo a decisiones");
    expect(csv).toContain("# Origen de los datos: DATOS DE EJEMPLO");
    const rows = csv.trim().split("\n").filter((l) => l.trim() && !/^\uFEFF?"?#/.test(l));
    expect(rows[0]).toContain("puesto,rotacion_id");
    expect(rows.length).toBe(1 + data.evaluations.length);
  });

  it("escapa comas, comillas y saltos de línea", () => {
    const ev = structuredClone(data.evaluations);
    ev[0].recommendation.why = 'dijo "hola", y\nsiguió';
    expect(buildCsv("x", "y", data, ev)).toContain('"dijo ""hola"", y\nsiguió"');
  });

  it("el JSON es válido e incluye la advertencia", () => {
    const parsed = JSON.parse(buildJson("Campo Este", "x", data, data.evaluations));
    expect(parsed.advertencia).toMatch(/No reemplaza/);
    expect(parsed.evaluations).toHaveLength(data.evaluations.length);
  });

  it("nombres de archivo seguros", () => {
    expect(safeFilename("Campo Este (zona Justo Daract)")).toBe("campo_este_zona_justo_daract");
    expect(safeFilename("¡¡¡")).toBe("campo");
  });
});
