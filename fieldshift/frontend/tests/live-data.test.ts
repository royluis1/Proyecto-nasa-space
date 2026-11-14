import { describe, expect, it } from "vitest";
import { buildAlerts, weeklyWithForecast } from "@/lib/alerts";
import { demoAlerts, demoHuerta } from "@/lib/demo";
import { GIBS_FIRST_DATE, clampGibsDate, defaultGibsDate, gibsUrl, shiftGibsDate } from "@/lib/gibs";
import { enrichAlerts, enrichHuerta, withBrowserForecast } from "@/lib/live-forecast";
import { forecastUrl, parseOpenMeteo } from "@/lib/open-meteo";
import type { Alert, Forecast, RainSummary } from "@/types/api";
import parity from "./fixtures/alerts-parity.json";

const NOW = new Date("2026-11-14T15:00:00Z");

describe("NASA GIBS (MODIS Terra, color real)", () => {
  it("arma la URL de teselas de la fecha", () => {
    expect(gibsUrl("2026-11-13")).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-11-13/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    );
    expect(() => gibsUrl("13/11/2026")).toThrow(/AAAA-MM-DD/);
  });
  it("por defecto muestra ayer y no sale del rango con imágenes", () => {
    expect(defaultGibsDate(NOW)).toBe("2026-11-13");
    expect(clampGibsDate("2030-01-01", NOW)).toBe("2026-11-13");
    expect(clampGibsDate("1999-01-01", NOW)).toBe(GIBS_FIRST_DATE);
    expect(clampGibsDate("basura", NOW)).toBe("2026-11-13");
    expect(shiftGibsDate("2026-03-01", -1, NOW)).toBe("2026-02-28");
    expect(shiftGibsDate("2026-11-13", 1, NOW)).toBe("2026-11-13");
  });
});

describe("Open-Meteo desde el navegador", () => {
  it("pide las mismas variables que el servidor", () => {
    const u = new URL(forecastUrl(-33.9265, -65.0721, 10));
    expect(u.origin + u.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(u.searchParams.get("daily")).toContain("precipitation_sum");
    expect(u.searchParams.get("daily")).toContain("et0_fao_evapotranspiration");
    expect(u.searchParams.get("timezone")).toBe("auto");
  });
  it("lee `data.daily` (también con solo lluvia y temperaturas) y aclara que no es NASA", () => {
    const fc = parseOpenMeteo({ latitude: -33.9, longitude: -65.07, daily: { time: ["2026-11-14", "2026-11-15"], precipitation_sum: [0, 12.5], temperature_2m_max: [31, 27], temperature_2m_min: [14, null] } }, NOW);
    expect(fc.days[1]).toMatchObject({ date: "2026-11-15", precip_mm: 12.5, tmax_c: 27, tmin_c: null, et0_mm: null });
    expect(fc.source).toMatchObject({ is_nasa: false, kind: "pronóstico", retrieved_at: NOW.toISOString() });
    expect(() => parseOpenMeteo({ daily: {} })).toThrow(/sin datos/);
  });
});

describe("alertas: mismas reglas que el backend", () => {
  type Case = { name: string; profile: "huerta" | "agricultor"; forecast: Forecast | null; past: RainSummary | null; smap: number | null; expected: Alert[] };
  for (const c of parity as Case[]) {
    it(c.name, () => {
      expect(buildAlerts(c.profile, c.forecast, c.past, c.smap)).toEqual(c.expected);
    });
  }
  it("riego de la semana con el pronóstico", () => {
    const fc = (parity as Case[]).find((c) => c.name === "seco-con-pasado-huerta")!.forecast!;
    expect(weeklyWithForecast(fc)).toBe(Math.round(6.1 * 7));
    expect(weeklyWithForecast(null)).toBeNull();
  });
});

describe("completar el pronóstico desde el navegador", () => {
  const fc = (parity as { name: string; forecast: Forecast | null }[]).find((c) => c.name === "heladas-huerta")!.forecast!;

  it("la huerta sin servidor recibe pronóstico, alertas de helada y el riego de la semana", async () => {
    const base = { ...(await demoHuerta("campo-este")), demo: true };
    expect(base.data.forecast).toBeNull();
    const r = await withBrowserForecast(base, enrichHuerta, async () => fc);
    expect(r.data.forecast?.days).toHaveLength(10);
    expect(r.data.alerts.find((a) => a.kind === "helada")).toMatchObject({ severity: "alta" });
    expect(r.data.alerts[0]).toMatchObject({ kind: "falta_de_agua", severity: "alta" }); // sin lluvia y el último mes seco
    expect(r.data.irrigation.with_forecast_l_per_m2).not.toBeNull();
    expect(r.data.sources.at(-1)?.is_nasa).toBe(false);
    expect(r.meta.warnings.join(" ")).toMatch(/desde tu navegador/);
    expect(r.meta.warnings.join(" ")).not.toMatch(/no está disponible/);
  });
  it("alertas del agricultor y lluvia futura", async () => {
    const base = { ...(await demoAlerts("campo-centro", "agricultor")), demo: true };
    const r = await withBrowserForecast(base, enrichAlerts, async () => fc);
    expect(r.data.future_rain_mm).toBe(0);
    expect(r.data.alerts.some((a) => a.kind === "helada" && /floración/.test(a.message))).toBe(true);
  });
  it("si Open-Meteo tampoco responde, deja todo como estaba", async () => {
    const base = { ...(await demoHuerta("campo-este")), demo: true };
    const r = await withBrowserForecast(base, enrichHuerta, async () => { throw new Error("sin red"); });
    expect(r).toBe(base);
  });
  it("si ya hay pronóstico, no consulta de nuevo", async () => {
    const base = { ...(await demoHuerta("campo-este")), demo: true };
    const withFc = { ...base, data: { ...base.data, forecast: fc } };
    let calls = 0;
    await withBrowserForecast(withFc, enrichHuerta, async () => { calls++; return fc; });
    expect(calls).toBe(0);
  });
});
