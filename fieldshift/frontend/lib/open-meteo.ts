/**
 * Pronóstico de Open-Meteo consultado directamente desde el navegador (no es un dato de la NASA).
 * Se usa cuando el servidor de FieldShift no responde, para que el pronóstico y las alertas sigan funcionando.
 * Pide las mismas variables que el backend (app/services/forecast/open_meteo.py).
 */
import type { Forecast } from "@/types/api";

export const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const DAILY = ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "precipitation_probability_max", "et0_fao_evapotranspiration", "wind_speed_10m_max"];
export const OPEN_METEO_NAME = "Open-Meteo (pronóstico; no es un dato de la NASA)";

export function forecastUrl(lat: number, lon: number, days = 10): string {
  const q = new URLSearchParams({ latitude: lat.toFixed(4), longitude: lon.toFixed(4), daily: DAILY.join(","), timezone: "auto", forecast_days: String(days) });
  return `${OPEN_METEO_URL}?${q.toString()}`;
}

type Daily = Record<string, (number | null)[] | string[]>;

/** Convierte `data.daily` de Open-Meteo al formato de FieldShift. */
export function parseOpenMeteo(data: { latitude?: number; longitude?: number; timezone?: string; daily?: Daily }, retrievedAt = new Date()): Forecast {
  const daily = data.daily ?? {};
  const time = (daily.time as string[] | undefined) ?? [];
  if (!time.length) throw new Error("Open-Meteo devolvió una respuesta sin datos diarios.");
  const col = (k: string) => (daily[k] as (number | null)[] | undefined) ?? [];
  return {
    latitude: data.latitude ?? 0,
    longitude: data.longitude ?? 0,
    timezone: data.timezone ?? null,
    days: time.map((date, i) => ({
      date,
      tmax_c: col("temperature_2m_max")[i] ?? null,
      tmin_c: col("temperature_2m_min")[i] ?? null,
      precip_mm: col("precipitation_sum")[i] ?? null,
      precip_probability_pct: col("precipitation_probability_max")[i] ?? null,
      et0_mm: col("et0_fao_evapotranspiration")[i] ?? null,
      wind_max_kmh: col("wind_speed_10m_max")[i] ?? null,
    })),
    source: {
      name: OPEN_METEO_NAME, is_nasa: false, kind: "pronóstico", retrieved_at: retrievedAt.toISOString(),
      origin: null, origin_label: null, detail: "Consultado directamente desde tu navegador.",
    },
  };
}

/** getForecast(lat, lon): fechas, lluvia y temperaturas de los próximos días. */
export async function getForecast(lat: number, lon: number, days = 10, signal?: AbortSignal): Promise<Forecast> {
  const res = await fetch(forecastUrl(lat, lon, days), { signal });
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}.`);
  return parseOpenMeteo(await res.json());
}
