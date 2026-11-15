import { describe, expect, it } from "vitest";
import crops from "../lib/demo/data/crops.json";
import { cropRoles, missingRoles, rolesInRotation } from "@/lib/agronomy";
import type { Crop } from "@/types/api";

const all = crops as unknown as Crop[];
const byId = (id: string) => all.find((c) => c.id === id)!;

describe("roles agronómicos de los cultivos", () => {
  it("las leguminosas fijan nitrógeno y la vicia además es cobertura", () => {
    expect(cropRoles(byId("soja"))).toContain("fija_nitrogeno");
    expect(cropRoles(byId("vicia"))).toEqual(expect.arrayContaining(["fija_nitrogeno", "cobertura"]));
  });
  it("el sorgo tiene raíz profunda y tolera la sequía", () => {
    expect(cropRoles(byId("sorgo"))).toEqual(expect.arrayContaining(["raiz_profunda", "tolera_sequia"]));
  });
  it("una rotación soja-maíz no tiene cobertura y lo dice", () => {
    const r = [byId("soja"), byId("maiz")];
    expect(rolesInRotation(r).map((x) => x.role)).toEqual(["fija_nitrogeno", "raiz_profunda"]);
    expect(missingRoles(r)).toEqual(["cobertura", "tolera_sequia"]);
  });
});
