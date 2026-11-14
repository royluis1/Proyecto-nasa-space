/**
 * Si la respuesta no trae pronóstico (servidor sin conexión o Open-Meteo caído del lado del servidor), se consulta
 * Open-Meteo desde el navegador y se recalculan las alertas con las mismas reglas que el backend.
 */
import { buildAlerts, weeklyWithForecast } from "./alerts";
import { getForecast } from "./open-meteo";
import type { AlertsResult, ApiResult, Forecast, HuertaPanel } from "@/types/api";

const NOTE = "Pronóstico consultado desde tu navegador (Open-Meteo, no es NASA): las alertas del pronóstico se calcularon acá.";
const isForecastWarning = (w: string) => /pron[oó]stico/i.test(w) && /(no est[aá] disponible|no disponible)/i.test(w);
const HOT_C = 35;

type Fetch = (lat: number, lon: number) => Promise<Forecast>;

export function enrichHuerta(h: HuertaPanel, fc: Forecast): HuertaPanel {
  const keep = h.alerts.filter((a) => a.kind === "suelo_seco");
  return {
    ...h,
    forecast: fc,
    irrigation: { ...h.irrigation, with_forecast_l_per_m2: weeklyWithForecast(fc) },
    heat: { ...h.heat, next_hot_days: fc.days.filter((d) => d.tmax_c != null && d.tmax_c >= HOT_C).length },
    alerts: mergeSorted(buildAlerts("huerta", fc, h.past_rain, null), keep),
    sources: [...h.sources.filter((s) => s.is_nasa), fc.source],
    warnings: h.warnings.filter((w) => !isForecastWarning(w)),
  };
}

export function enrichAlerts(a: AlertsResult, fc: Forecast): AlertsResult {
  const keep = a.alerts.filter((x) => x.kind === "suelo_seco");
  return {
    ...a,
    forecast: fc,
    future_rain_mm: Math.round(fc.days.reduce((s, d) => s + (d.precip_mm ?? 0), 0) * 10) / 10,
    alerts: mergeSorted(buildAlerts(a.profile, fc, a.past_rain, null), keep),
    sources: [...a.sources.filter((s) => s.is_nasa), fc.source],
    warnings: a.warnings.filter((w) => !isForecastWarning(w)),
  };
}

function mergeSorted<T extends { severity: string; start?: string | null }>(a: T[], b: T[]): T[] {
  const order: Record<string, number> = { alta: 0, media: 1, info: 2 };
  return [...a, ...b].sort((x, y) => order[x.severity] - order[y.severity] || (x.start ?? "9999").localeCompare(y.start ?? "9999"));
}

/** Completa el pronóstico desde el navegador si falta. Si Open-Meteo tampoco responde, devuelve lo que había. */
export async function withBrowserForecast<T extends HuertaPanel | AlertsResult>(
  r: ApiResult<T>,
  enrich: (data: T, fc: Forecast) => T,
  fetchForecast: Fetch = (lat, lon) => getForecast(lat, lon),
): Promise<ApiResult<T>> {
  if (r.data.forecast || typeof fetch === "undefined") return r;
  try {
    const fc = await fetchForecast(r.data.latitude, r.data.longitude);
    return { ...r, data: enrich(r.data, fc), meta: { ...r.meta, warnings: [...r.meta.warnings.filter((w) => !isForecastWarning(w)), NOTE] } };
  } catch {
    return r;
  }
}
