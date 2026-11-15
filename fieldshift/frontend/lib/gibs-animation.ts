import { appLocale } from "./i18n";
import { L, localize } from "./i18n";
/**
 * Capas animadas de NASA GIBS: lluvia de GPM/IMERG y nubes de MODIS.
 *
 * GIBS es público y no necesita cuenta. La lluvia de IMERG viene del satélite GPM (NASA y JAXA):
 * es una estimación satelital, no un radar meteorológico ni un pluviómetro.
 */

export type AnimatedLayerId = "lluvia" | "nubes";

export interface AnimatedLayer {
  id: AnimatedLayerId;
  /** Capa de GIBS. */
  layer: string;
  label: string;
  /** Una línea sobre qué muestra. */
  help: string;
  /** Cada cuánto hay una imagen, en minutos. */
  stepMinutes: number;
  /** Cuántos pasos tiene la animación. */
  steps: number;
  format: "png" | "jpg";
  tileMatrixSet: string;
  maxNativeZoom: number;
  /** Cuánto esperamos a que GIBS publique la imagen más reciente, en minutos. */
  latencyMinutes: number;
  attribution: string;
  /** Qué significan los colores. */
  legend: { color: string; label: string }[];
  source: string;
  limits: string;
}

export const ANIMATED_LAYERS: Record<AnimatedLayerId, AnimatedLayer> = localize({
  lluvia: {
    id: "lluvia",
    layer: "IMERG_Precipitation_Rate_30min",
    label: L("Lluvia (satélite GPM)", "Rain (GPM satellite)"),
    help: L("Cuánta lluvia estima el satélite en cada momento, cada media hora.", "How much rain the satellite estimates at each moment, every half hour."),
    stepMinutes: 30,
    steps: 24, // 12 horas
    format: "png",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    maxNativeZoom: 6,
    latencyMinutes: 240, // IMERG "Early" tarda unas horas en publicarse
    attribution: "NASA GIBS / GPM IMERG",
    // Colores de la paleta de IMERG en GIBS, de menos a más lluvia.
    legend: [
      { color: "#3cb44b", label: L("Poca lluvia", "Light rain") },
      { color: "#d7e02a", label: L("Moderada", "Moderate") },
      { color: "#f49a1e", label: L("Fuerte", "Heavy") },
      { color: "#e3271c", label: L("Muy fuerte", "Very heavy") },
    ],
    source: L("NASA GIBS, capa IMERG_Precipitation_Rate_30min (misión GPM, NASA y JAXA)", "NASA GIBS, layer IMERG_Precipitation_Rate_30min (GPM mission, NASA and JAXA)"),
    limits:
      L("Es una estimación desde el satélite, con píxeles de unos 10 km y varias horas de demora. No es un radar ni reemplaza a tu pluviómetro.", "It is a satellite estimate, with pixels about 10 km wide and several hours of delay. It is not radar and does not replace your rain gauge."),
  },
  nubes: {
    id: "nubes",
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    label: L("Nubes (MODIS, color real)", "Clouds (MODIS, true color)"),
    help: L("Cómo se vio la zona desde el espacio cada día.", "How the area looked from space each day."),
    stepMinutes: 60 * 24,
    steps: 10,
    format: "jpg",
    tileMatrixSet: "GoogleMapsCompatible_Level9",
    maxNativeZoom: 9,
    latencyMinutes: 60 * 24,
    attribution: "NASA GIBS / MODIS Terra",
    legend: [],
    source: L("NASA GIBS, capa MODIS_Terra_CorrectedReflectance_TrueColor (satélite Terra)", "NASA GIBS, layer MODIS_Terra_CorrectedReflectance_TrueColor (Terra satellite)"),
    limits: L("Una imagen por día, cuando el satélite pasa. Si hay nubes, tapan lo que hay abajo.", "One image per day, when the satellite passes. Clouds hide what is below."),
  },
});

/** Momento más reciente con imagen, redondeado hacia abajo al paso de la capa. */
export function latestFrame(l: AnimatedLayer, now: Date = new Date()): Date {
  const ms = l.stepMinutes * 60_000;
  return new Date(Math.floor((now.getTime() - l.latencyMinutes * 60_000) / ms) * ms);
}

/** Los momentos de la animación, del más viejo al más nuevo. */
export function frames(l: AnimatedLayer, now: Date = new Date()): Date[] {
  const last = latestFrame(l, now);
  const ms = l.stepMinutes * 60_000;
  return Array.from({ length: l.steps }, (_, i) => new Date(last.getTime() - (l.steps - 1 - i) * ms));
}

/** Valor de tiempo que entiende GIBS: fecha sola si el paso es diario, con hora si es más corto. */
export function frameTime(l: AnimatedLayer, frame: Date): string {
  const iso = frame.toISOString();
  return l.stepMinutes >= 60 * 24 ? iso.slice(0, 10) : `${iso.slice(0, 16)}:00Z`;
}

/** URL de las teselas de un momento (plantilla de Leaflet: {z}/{y}/{x}). */
export function frameUrl(l: AnimatedLayer, frame: Date): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.layer}/default/${frameTime(l, frame)}/${l.tileMatrixSet}/{z}/{y}/{x}.${l.format}`;
}

/** Cómo se muestra el momento en pantalla, en hora de Argentina. */
export function frameLabel(l: AnimatedLayer, frame: Date): string {
  const opts: Intl.DateTimeFormatOptions =
    l.stepMinutes >= 60 * 24
      ? { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }
      : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" };
  return new Intl.DateTimeFormat(appLocale(), opts).format(frame);
}
