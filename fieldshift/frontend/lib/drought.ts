import type { ClimateSummary } from "@/types/api";

/**
 * Historial de sequía de la zona, año por año, con datos de NASA POWER.
 * El déficit de un año es la suma de los meses en que la atmósfera pidió más agua (ET₀) de la que llovió.
 * Solo se usan años completos: un año a medias tendría un déficit artificialmente bajo.
 */
export interface DroughtYear {
  year: number;
  deficit: number;
  rain: number | null;
  et0: number | null;
}

export interface DroughtHistory {
  years: DroughtYear[];
  mean: number | null;
  /** Cambio por década según una recta de mínimos cuadrados. Orientativo: con ~10 años no alcanza para afirmar una tendencia. */
  slopePerDecade: number | null;
  /** Los dos años con más déficit (los más secos para los cultivos). */
  driest: number[];
  /** Valor de la recta de tendencia en cada año, para dibujarla. */
  trend: Record<number, number>;
}

export function droughtHistory(annual: ClimateSummary["annual"]): DroughtHistory {
  const years: DroughtYear[] = annual
    .filter((a) => a.complete && a.deficit_mm != null)
    .map((a) => ({ year: a.year, deficit: a.deficit_mm as number, rain: a.precip_mm ?? null, et0: a.et0_mm ?? null }))
    .sort((a, b) => a.year - b.year);

  const n = years.length;
  if (n === 0) return { years, mean: null, slopePerDecade: null, driest: [], trend: {} };

  const mean = years.reduce((s, y) => s + y.deficit, 0) / n;
  const driest = [...years].sort((a, b) => b.deficit - a.deficit).slice(0, Math.min(2, n)).map((y) => y.year);

  // Con menos de 5 años una recta no dice nada: no la mostramos.
  if (n < 5) return { years, mean, slopePerDecade: null, driest, trend: {} };

  const mx = years.reduce((s, y) => s + y.year, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const y of years) {
    sxy += (y.year - mx) * (y.deficit - mean);
    sxx += (y.year - mx) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const trend = Object.fromEntries(years.map((y) => [y.year, mean + slope * (y.year - mx)]));
  return { years, mean, slopePerDecade: slope * 10, driest, trend };
}

/** Frase corta para mostrar arriba del gráfico. */
export function droughtSentence(h: DroughtHistory, fmt: (v: number) => string): string {
  if (h.mean == null) return "No hay años completos para armar el historial.";
  const parts: string[] = [];
  if (h.driest.length) parts.push(`Los años más secos fueron ${h.driest.join(" y ")}, con ${fmt(Math.max(...h.years.map((y) => y.deficit)))} mm de déficit en el peor.`);
  else parts.push(`En promedio faltan ${fmt(h.mean)} mm de agua por año.`);
  if (h.slopePerDecade != null && Math.abs(h.slopePerDecade) >= 25) {
    parts.push(`La línea de tendencia ${h.slopePerDecade > 0 ? "sube" : "baja"}, pero con ${h.years.length} años es solo orientativa.`);
  }
  return parts.join(" ");
}
