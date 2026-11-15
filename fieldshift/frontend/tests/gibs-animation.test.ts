import { describe, expect, it } from "vitest";
import { ANIMATED_LAYERS, frameLabel, frameTime, frameUrl, frames, latestFrame } from "@/lib/gibs-animation";

const lluvia = ANIMATED_LAYERS.lluvia;
const nubes = ANIMATED_LAYERS.nubes;
const NOW = new Date("2026-11-15T12:10:00Z");

describe("animación de capas de GIBS", () => {
  it("el último momento respeta la demora y cae en un paso de 30 min", () => {
    // 12:10 menos 4 h de demora = 08:10, redondeado hacia abajo = 08:00
    expect(latestFrame(lluvia, NOW).toISOString()).toBe("2026-11-15T08:00:00.000Z");
  });

  it("arma la cantidad de momentos pedida, del más viejo al más nuevo", () => {
    const f = frames(lluvia, NOW);
    expect(f).toHaveLength(lluvia.steps);
    expect(f[0].getTime()).toBeLessThan(f[f.length - 1].getTime());
    // 24 pasos de 30 minutos = 11,5 h entre el primero y el último
    expect(f[f.length - 1].getTime() - f[0].getTime()).toBe(23 * 30 * 60_000);
  });

  it("la lluvia usa fecha con hora y las nubes solo la fecha", () => {
    expect(frameTime(lluvia, new Date("2026-11-15T08:00:00Z"))).toBe("2026-11-15T08:00:00Z");
    expect(frameTime(nubes, new Date("2026-11-15T00:00:00Z"))).toBe("2026-11-15");
  });

  it("la URL de las teselas tiene la capa, el momento y los marcadores de Leaflet", () => {
    const url = frameUrl(lluvia, new Date("2026-11-15T08:00:00Z"));
    expect(url).toContain("IMERG_Precipitation_Rate_30min");
    expect(url).toContain("/2026-11-15T08:00:00Z/");
    expect(url).toMatch(/\{z\}\/\{y\}\/\{x\}\.png$/);
  });

  it("las nubes se piden en jpg y con su nivel de zoom", () => {
    expect(frameUrl(nubes, new Date("2026-11-15T00:00:00Z"))).toContain("GoogleMapsCompatible_Level9");
    expect(frameUrl(nubes, new Date("2026-11-15T00:00:00Z")).endsWith(".jpg")).toBe(true);
  });

  it("la etiqueta se muestra en hora de Argentina", () => {
    // 08:00 UTC son las 05:00 en Argentina (UTC-3)
    expect(frameLabel(lluvia, new Date("2026-11-15T08:00:00Z"))).toContain("05:00");
  });
});
