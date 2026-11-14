import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDateTime } from "@/components/provenance/source-line";
import { demoAlerts, demoCompare, demoHuerta } from "@/lib/demo";
import { PROFILES, PROFILE_KEY, isProfile, readProfile, saveProfile } from "@/lib/profile";
import { APPROACHES, SOURCE_MAP } from "@/lib/sources";

describe("perfil Huerta / Agricultor", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => void (store[k] = v),
        removeItem: (k: string) => void delete store[k],
      },
      dispatchEvent: vi.fn(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("se guarda en el navegador y se puede cambiar o borrar", () => {
    expect(readProfile()).toBeNull();
    saveProfile("huerta");
    expect(store[PROFILE_KEY]).toBe("huerta");
    expect(readProfile()).toBe("huerta");
    saveProfile("agricultor");
    expect(readProfile()).toBe("agricultor");
    saveProfile(null);
    expect(readProfile()).toBeNull();
  });
  it("ignora valores inválidos", () => {
    store[PROFILE_KEY] = "admin";
    expect(readProfile()).toBeNull();
    expect(isProfile("huerta") && isProfile("agricultor") && !isProfile("otro")).toBe(true);
  });
  it("cada perfil abre su pantalla", () => {
    expect(PROFILES.huerta.home("c1")).toBe("/campo/c1/huerta");
    expect(PROFILES.agricultor.home("c1")).toBe("/campo/c1/perfil");
  });
});

describe("mapa de fuentes por perfil", () => {
  const src = (p: "huerta" | "agricultor", need: RegExp) => SOURCE_MAP[p].find((s) => need.test(s.need))!;
  it("huerta: POWER para clima, heladas y riego; Open-Meteo para la lluvia futura", () => {
    expect(src("huerta", /heladas/).source).toBe("NASA POWER");
    expect(src("huerta", /Riego/).source).toBe("NASA POWER");
    expect(src("huerta", /Lluvia futura/)).toMatchObject({ source: "Open-Meteo", nasa: false });
    expect(src("huerta", /Calor/).source).toBe("ECOSTRESS");
  });
  it("agricultor: incluye GPM/IMERG, Landsat, MODIS, ECOSTRESS y SRTM, y marca lo pendiente", () => {
    const names = SOURCE_MAP.agricultor.map((s) => s.source).join(" ");
    for (const n of ["NASA POWER", "GPM/IMERG", "Open-Meteo", "Landsat", "MODIS", "ECOSTRESS", "SRTM"]) expect(names).toContain(n);
    expect(src("agricultor", /extremos/).status).toBe("proximamente");
    expect(src("agricultor", /Relieve/).status).toBe("integrado");
    expect(SOURCE_MAP.agricultor.filter((s) => !s.nasa).map((s) => s.source)).toEqual(["Open-Meteo"]);
  });
  it("los tres enfoques apuntan a pantallas que existen", () => {
    expect(APPROACHES.map((a) => a.title)).toEqual(["Simulador de riesgo", "Sostenibilidad y salud del suelo", "Diagnóstico y alerta temprana"]);
    const pages = new Set(["escenarios", "comparador", "dashboard", "diagnostico", "calendario", "alertas"]);
    expect(APPROACHES.flatMap((a) => a.pages.map((p) => p.slug)).every((s) => pages.has(s))).toBe(true);
  });
});

describe("huerta y alertas (datos de ejemplo)", () => {
  it("el panel de huerta trae riego, heladas, calor y fuentes con fecha y tipo", async () => {
    const r = await demoHuerta("campo-este");
    const h = r.data;
    expect(h.irrigation.weekly_l_per_m2).toBeGreaterThanOrEqual(0);
    expect(h.irrigation.basis).toMatch(/1 mm = 1 litro/);
    expect(h.frost.frost_months.length).toBeGreaterThan(0);
    const power = h.sources.find((s) => s.name === "NASA POWER")!;
    expect(power).toMatchObject({ is_nasa: true, kind: "modelado" });
    expect(power.retrieved_at).toBeTruthy();
    expect(r.meta.warnings.join(" ")).toMatch(/pronóstico \(Open-Meteo\) no está disponible/);
  });
  it("campo Este usa el archivo real de NASA POWER (campo1.csv) cuando no hay conexión", async () => {
    const h = (await demoHuerta("campo-este")).data;
    expect(h.sources[0].origin).toBe("uploaded");
    expect(h.warnings.join(" ")).toMatch(/campo1\.csv/);
    const c = (await demoCompare("campo-este")).data;
    expect(c.inputs.climate.origin).toBe("uploaded");
  });
  it("alertas por perfil", async () => {
    const h = (await demoAlerts("campo-centro", "huerta")).data;
    const a = (await demoAlerts("campo-centro", "agricultor")).data;
    expect(h.profile).toBe("huerta");
    expect(a.profile).toBe("agricultor");
    expect(a.sources[0].name).toBe("NASA POWER");
  });
  it("muestra la fecha de consulta en formato local", () => {
    expect(formatDateTime("2026-11-14T15:30:00Z")).toMatch(/14\/11\/2026/);
    expect(formatDateTime(null)).toBe("sin fecha");
  });
});
