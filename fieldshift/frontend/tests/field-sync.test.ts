import { describe, expect, it } from "vitest";
import { NO_AUTO, applySoilEstimate, initialSoilAuto, nameAfterLocality, soilForSave, usableEstimate } from "@/lib/field-sync";
import type { SoilEstimate } from "@/types/api";

const est = (over: Partial<SoilEstimate> = {}): SoilEstimate =>
  ({ source: "SoilGrids 2.0 (ISRIC)", resolution: "250 m", depth: "0-30 cm", label: "estimado", origin: "live", origin_label: "DATO NASA EN VIVO",
     retrieved_at: null, clay_pct: 12, sand_pct: 63, silt_pct: 25, texture_usda: "franco arenoso", texture: "franco_arenosa",
     organic_matter_pct: 1.6, organic_matter: "medio", note: "", ...over }) as SoilEstimate;

const empty = { texture: "" as const, organic_matter: "" as const, lab_analysis: false };

describe("estimación de suelo en el formulario", () => {
  it("solo usa datos reales: nunca la muestra simulada", () => {
    expect(usableEstimate(est())).toBe(true);
    expect(usableEstimate(est({ origin: "cached" }))).toBe(true);
    expect(usableEstimate(est({ origin: "sample" }))).toBe(false);
    expect(usableEstimate(null)).toBe(false);
  });

  it("completa las casillas vacías y las marca como automáticas", () => {
    const r = applySoilEstimate(empty, NO_AUTO, est());
    expect(r.state.texture).toBe("franco_arenosa");
    expect(r.state.organic_matter).toBe("medio");
    expect(r.auto).toEqual({ texture: true, organic_matter: true });
  });

  it("no pisa lo que cargó el productor", () => {
    const mine = { ...empty, texture: "arcillosa" as const };
    const r = applySoilEstimate(mine, NO_AUTO, est());
    expect(r.state.texture).toBe("arcillosa");
    expect(r.auto.texture).toBe(false);
    expect(r.state.organic_matter).toBe("medio"); // la que estaba vacía sí se completa
  });

  it("con análisis de laboratorio no usa la estimación", () => {
    const lab = { ...empty, lab_analysis: true };
    const r = applySoilEstimate(lab, NO_AUTO, est());
    expect(r.state).toEqual(lab);
  });

  it("con la muestra simulada no completa nada", () => {
    expect(applySoilEstimate(empty, NO_AUTO, est({ origin: "sample" })).state).toEqual(empty);
  });

  it("si el punto cambia, lo automático se actualiza con la estimación nueva", () => {
    const first = applySoilEstimate(empty, NO_AUTO, est());
    const second = applySoilEstimate(first.state, first.auto, est({ texture: "franca", organic_matter: "alto" }));
    expect(second.state.texture).toBe("franca");
    expect(second.state.organic_matter).toBe("alto");
  });

  it("si en el punto nuevo no hay dato real, borra lo automático del punto anterior", () => {
    const first = applySoilEstimate(empty, NO_AUTO, est());
    const second = applySoilEstimate(first.state, first.auto, null);
    expect(second.state.texture).toBe("");
    expect(second.auto).toEqual(NO_AUTO);
  });

  it("al guardar, lo automático va vacío para que el backend lo rotule como estimado", () => {
    const filled = applySoilEstimate({ ...empty, texture: "arcillosa" as const }, NO_AUTO, est());
    const out = soilForSave(filled.state, filled.auto);
    expect(out.texture).toBe("arcillosa"); // del productor: se manda
    expect(out.organic_matter).toBe(""); // automático: lo completa el backend
  });

  it("al editar, lo que completó el backend sigue siendo automático", () => {
    expect(initialSoilAuto(["textura"])).toEqual({ texture: true, organic_matter: false });
    expect(initialSoilAuto(undefined)).toEqual(NO_AUTO);
  });
});

describe("nombre del campo según la ciudad", () => {
  it("si no hay nombre, toma el de la ciudad", () => {
    expect(nameAfterLocality("", null, "Justo Daract")).toEqual({ name: "Justo Daract", auto: "Justo Daract" });
  });
  it("si se elige otra ciudad, el nombre automático la acompaña", () => {
    expect(nameAfterLocality("Justo Daract", "Justo Daract", "Villa Mercedes").name).toBe("Villa Mercedes");
  });
  it("si el productor escribió un nombre, no se toca", () => {
    expect(nameAfterLocality("Lote Norte", "Justo Daract", "Villa Mercedes").name).toBe("Lote Norte");
  });
});
