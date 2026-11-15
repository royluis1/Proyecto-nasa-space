import { afterEach, describe, expect, it } from "vitest";
import { L, localize, makeT, parseLang, setCurrentLang, tr } from "@/lib/i18n";
import { COMPONENTS, LEVEL_LABELS, ORIGIN_LABELS, num } from "@/lib/format";
import { PRESET_SCENARIOS } from "@/lib/scenarios";
import { friendlyWarning } from "@/lib/plain";
import { initialSoilAuto } from "@/lib/field-sync";

afterEach(() => setCurrentLang("es"));

describe("idioma", () => {
  it("por defecto es inglés y solo acepta es o en", () => {
    expect(parseLang(undefined)).toBe("en");
    expect(parseLang("fr")).toBe("en");
    expect(parseLang("es")).toBe("es");
  });

  it("t elige el texto según el idioma", () => {
    expect(makeT("en")("Hola", "Hello")).toBe("Hello");
    expect(makeT("es")("Hola", "Hello")).toBe("Hola");
  });

  it("las constantes cambian de idioma al leerlas", () => {
    const labels = localize({ a: L("Bajo", "Low"), nested: { b: L("Alto", "High") }, list: [L("uno", "one")] });
    expect(labels.a).toBe("Bajo");
    setCurrentLang("en");
    expect(labels.a).toBe("Low");
    expect(labels.nested.b).toBe("High");
    expect(labels.list[0]).toBe("one");
    expect(Object.keys(labels)).toEqual(["a", "nested", "list"]);
  });

  it("las etiquetas de origen del dato se traducen y mantienen el rótulo de muestra", () => {
    expect(ORIGIN_LABELS.sample).toBe("DATO DE MUESTRA");
    setCurrentLang("en");
    expect(ORIGIN_LABELS.sample).toBe("SAMPLE DATA");
    expect(LEVEL_LABELS.alto).toBe("High");
    expect(COMPONENTS.A.name).toBe("Water resilience");
    expect(tr("a", "b")).toBe("b");
  });

  it("los números usan el separador del idioma", () => {
    expect(num(1234.5, 1)).toBe("1.234,5");
    setCurrentLang("en");
    expect(num(1234.5, 1)).toBe("1,234.5");
  });

  it("los escenarios predefinidos siguen el idioma y conservan los ids", () => {
    const idsEs = PRESET_SCENARIOS.map((p) => p.id);
    setCurrentLang("en");
    expect(PRESET_SCENARIOS.map((p) => p.id)).toEqual(idsEs);
    expect(PRESET_SCENARIOS.length).toBe(idsEs.length);
  });

  it("los avisos del servidor se reconocen en los dos idiomas", () => {
    setCurrentLang("en");
    expect(friendlyWarning("NASA POWER did not respond (timeout).")).toMatch(/couldn't query NASA weather/);
    expect(friendlyWarning("NASA POWER no respondió (timeout).")).toMatch(/couldn't query NASA weather/);
  });

  it("el suelo completado por el backend se reconoce en los dos idiomas", () => {
    expect(initialSoilAuto(["texture", "organic matter"])).toEqual({ texture: true, organic_matter: true });
    expect(initialSoilAuto(["textura"])).toEqual({ texture: true, organic_matter: false });
  });
});
