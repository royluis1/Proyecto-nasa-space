/**
 * Las mismas reglas de alerta que el backend (app/services/early_warning.py: build_alerts), para usarlas cuando el pronóstico
 * se consulta desde el navegador. Un test compara los resultados con los del backend.
 */
import type { Alert, Forecast, ForecastDay, RainSummary } from "@/types/api";
import { tr } from "./i18n";

export type Profile = "huerta" | "agricultor";

const FROST_C = 0, FROST_RISK_C = 2, HOT_C = 35, VERY_HOT_C = 38, HEAVY = 30, VERY_HEAVY = 50;
const DRY_WINDOW = 10, DRY_RAIN = 5, DRY_ET0 = 30, DRY_PAST_PCT = 50, SMAP_DRY = -20, WIND = 60, KC = 1, EFFECTIVE = 0.8;
const src = () => tr("Open-Meteo (pronóstico, no es NASA)", "Open-Meteo (forecast, not NASA)");

const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const r0 = (x: number) => Math.round(x).toFixed(0); // como el "{x:.0f}" de Python (salvo empates exactos)

function spans(days: ForecastDay[], pred: (d: ForecastDay) => boolean): ForecastDay[][] {
  const out: ForecastDay[][] = [];
  let cur: ForecastDay[] = [];
  for (const d of days) {
    if (pred(d)) cur.push(d);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

export function buildAlerts(profile: Profile, forecast: Forecast | null, past: RainSummary | null, smapAnomaly: number | null): Alert[] {
  const out: Alert[] = [];
  const huerta = profile === "huerta";
  const days = forecast?.days ?? [];

  for (const g of spans(days, (d) => d.tmin_c != null && d.tmin_c <= FROST_RISK_C)) {
    const low = Math.min(...g.map((d) => d.tmin_c!));
    const hard = low <= FROST_C;
    const when = fmt(g[0].date) + (g.length > 1 ? tr(` al ${fmt(g[g.length - 1].date)}`, ` to ${fmt(g[g.length - 1].date)}`) : "");
    out.push({
      id: `helada-${g[0].date}`, kind: "helada", severity: hard ? "alta" : "media",
      title: tr(`${hard ? "Helada" : "Posible helada"} el ${when} (mínima ${r0(low)} °C)`, `${hard ? "Frost" : "Possible frost"} on ${when} (low ${r0(low)} °C)`),
      message: huerta
        ? tr("Cubrí las plantas sensibles (tomate, pimiento, zapallo, albahaca) con manta antihelada o nylon esa noche y regá a la tarde: el suelo húmedo guarda calor. No trasplantes hasta que pase.", "Cover sensitive plants (tomato, pepper, squash, basil) with frost cloth or plastic that night and water in the afternoon: moist soil holds heat. Don't transplant until it passes.")
        : tr("Puede dañar cultivos recién emergidos o en floración. Postergá siembras sensibles al frío y revisá el lote después de la helada.", "It can damage newly emerged or flowering crops. Delay cold-sensitive plantings and check the plot after the frost."),
      start: g[0].date, end: g[g.length - 1].date, source: src(),
    });
  }

  for (const g of spans(days, (d) => d.tmax_c != null && d.tmax_c >= HOT_C)) {
    const top = Math.max(...g.map((d) => d.tmax_c!));
    out.push({
      id: `calor-${g[0].date}`, kind: "calor", severity: top >= VERY_HOT_C || g.length >= 3 ? "alta" : "media",
      title: tr(`Calor fuerte: ${g.length} ${g.length === 1 ? "día" : "días"} con más de ${HOT_C} °C desde el ${fmt(g[0].date)} (máxima ${r0(top)} °C)`, `Strong heat: ${g.length} ${g.length === 1 ? "day" : "days"} above ${HOT_C} °C from ${fmt(g[0].date)} (high ${r0(top)} °C)`),
      message: huerta
        ? tr("Regá temprano a la mañana o al atardecer, poné media sombra a las hojas tiernas y cubrí el suelo con paja para que no se seque.", "Water early in the morning or at dusk, shade tender leaves and mulch the soil with straw so it doesn't dry out.")
        : tr("Golpe de calor: si coincide con la floración de maíz o soja puede bajar el rendimiento. Revisá el agua del perfil y evitá pulverizar en las horas de más calor.", "Heat stress: if it coincides with corn or soybean flowering it can lower yield. Check soil-profile water and avoid spraying in the hottest hours."),
      start: g[0].date, end: g[g.length - 1].date, source: src(),
    });
  }

  for (const d of days) {
    if (d.precip_mm != null && d.precip_mm >= HEAVY) {
      out.push({
        id: `lluvia-${d.date}`, kind: "lluvia_intensa", severity: d.precip_mm >= VERY_HEAVY ? "alta" : "media",
        title: tr(`Lluvia intensa el ${fmt(d.date)} (~${r0(d.precip_mm)} mm)`, `Heavy rain on ${fmt(d.date)} (~${r0(d.precip_mm)} mm)`),
        message: huerta
          ? tr("No riegues esos días, revisá que el agua escurra y no se encharquen los canteros; protegé los almácigos.", "Don't water those days, make sure water drains and beds don't flood; protect seedlings.")
          : tr("Riesgo de erosión y encharcamiento en lotes con suelo desnudo. Evitá pulverizar antes de la lluvia y revisá caminos y bajos.", "Risk of erosion and waterlogging on plots with bare soil. Avoid spraying before the rain and check roads and low spots."),
        start: d.date, end: d.date, source: src(),
      });
    }
  }

  const windy = days.find((d) => d.wind_max_kmh != null && d.wind_max_kmh >= WIND);
  if (windy) {
    out.push({
      id: `viento-${windy.date}`, kind: "viento", severity: "media",
      title: tr(`Viento fuerte el ${fmt(windy.date)} (ráfagas de ~${r0(windy.wind_max_kmh!)} km/h)`, `Strong wind on ${fmt(windy.date)} (gusts of ~${r0(windy.wind_max_kmh!)} km/h)`),
      message: huerta ? tr("Atá tutores y cubrí almácigos.", "Tie up stakes and cover seedlings.") : tr("Más erosión eólica en lotes sin cobertura; no pulverices.", "More wind erosion on plots without cover; don't spray."),
      start: windy.date, end: windy.date, source: src(),
    });
  }

  const pastDry = past?.pct_of_normal != null && past.pct_of_normal < DRY_PAST_PCT;
  const window = days.slice(0, DRY_WINDOW);
  if (window.length >= 7) {
    const rain = window.reduce((a, d) => a + (d.precip_mm ?? 0), 0);
    const et0 = window.reduce((a, d) => a + (d.et0_mm ?? 0), 0);
    if (rain < DRY_RAIN && et0 > DRY_ET0) {
      const need = (Math.max(0, et0 * KC - EFFECTIVE * rain) / window.length) * 7;
      out.push({
        id: "falta-de-agua", kind: "falta_de_agua", severity: pastDry ? "alta" : "media",
        title: tr(`Sin lluvia los próximos ${window.length} días${pastDry ? " y el último mes llovió poco" : ""}`, `No rain in the next ${window.length} days${pastDry ? " and last month was dry" : ""}`),
        message: huerta
          ? tr(`Vas a tener que regar: unos ${r0(need)} litros por m² por semana, repartidos en 2 o 3 riegos.`, `You will need to water: about ${r0(need)} liters per m² per week, split into 2 or 3 waterings.`)
          : tr(`Se pronostican ${r0(rain)} mm contra ${r0(et0)} mm de evaporación: el perfil se va a secar. Medí la humedad antes de sembrar y ajustá la densidad.`, `${r0(rain)} mm of rain is forecast against ${r0(et0)} mm of evaporation: the soil profile will dry out. Measure moisture before planting and adjust seeding density.`),
        start: window[0].date, end: window[window.length - 1].date,
        source: src() + (pastDry ? tr(" y NASA POWER (lluvia del último mes)", " and NASA POWER (last month's rain)") : ""),
      });
    }
  } else if (pastDry && past) {
    out.push({
      id: "falta-de-agua", kind: "falta_de_agua", severity: "media",
      title: tr(`El último mes llovió el ${r0(past.pct_of_normal!)} % de lo normal`, `Last month's rain was ${r0(past.pct_of_normal!)} % of normal`),
      message: huerta ? tr("Revisá la humedad de la tierra antes de cada riego.", "Check soil moisture before each watering.") : tr("El perfil puede estar más seco que lo habitual: medilo antes de sembrar.", "The soil profile may be drier than usual: measure it before planting."),
      start: past.start, end: past.end, source: "NASA POWER",
    });
  }

  if (smapAnomaly != null && smapAnomaly <= SMAP_DRY) {
    out.push({
      id: "suelo-seco", kind: "suelo_seco", severity: "media",
      title: tr(`Suelo más seco que lo normal (${r0(smapAnomaly)} %)`, `Soil drier than normal (${r0(smapAnomaly)} %)`),
      message: huerta
        ? tr("La tierra de la zona está más seca que otros años: regá más seguido y cubrí el suelo.", "The soil in the area is drier than in other years: water more often and cover the soil.")
        : tr("SMAP muestra la zona de raíces más seca que lo habitual para la época. Es un dato regional (9 km): confirmalo en el lote.", "SMAP shows the root zone drier than usual for the season. This is regional data (9 km): confirm it in the plot."),
      start: null, end: null, source: "NASA SMAP",
    });
  }

  const order = { alta: 0, media: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity] || (a.start ?? "9999").localeCompare(b.start ?? "9999"));
}

/** Litros por m² para los próximos 7 días con el pronóstico (misma fórmula que el backend). */
export function weeklyWithForecast(forecast: Forecast | null): number | null {
  const next = forecast?.days.slice(0, 7) ?? [];
  if (next.length < 7 || next.some((d) => d.et0_mm == null)) return null;
  const et0 = next.reduce((a, d) => a + d.et0_mm!, 0);
  const rain = next.reduce((a, d) => a + (d.precip_mm ?? 0), 0);
  return Math.round(Math.max(0, et0 * KC - EFFECTIVE * rain));
}
