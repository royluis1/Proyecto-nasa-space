/**
 * Imagen satelital del día de NASA GIBS (Global Imagery Browse Services): MODIS Terra en color real.
 * Pública, sin cuenta. Píxel de ~250 m (nivel 9): sirve para ver nubes, humo, verdor o anegamientos de la zona, no el detalle del lote.
 */

export const GIBS_LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
export const GIBS_FIRST_DATE = "2000-02-24"; // inicio de MODIS Terra en GIBS
export const GIBS_ATTRIBUTION = "NASA GIBS / MODIS Terra";
export const GIBS_MAX_NATIVE_ZOOM = 9;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** URL de las teselas para una fecha AAAA-MM-DD (formato de Leaflet: {z}/{y}/{x}). */
export function gibsUrl(fecha: string): string {
  if (!ISO.test(fecha)) throw new Error(`Fecha inválida para GIBS: "${fecha}" (usar AAAA-MM-DD).`);
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${fecha}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Por defecto, ayer (UTC): la imagen de hoy suele estar incompleta hasta que el satélite termina de pasar. */
export function defaultGibsDate(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return toIso(d);
}

/** Lleva la fecha al rango con imágenes (de 2000-02-24 a ayer). */
export function clampGibsDate(fecha: string, now = new Date()): string {
  const max = defaultGibsDate(now);
  if (!ISO.test(fecha)) return max;
  if (fecha < GIBS_FIRST_DATE) return GIBS_FIRST_DATE;
  return fecha > max ? max : fecha;
}

/** Suma días a una fecha AAAA-MM-DD, sin salir del rango con imágenes. */
export function shiftGibsDate(fecha: string, days: number, now = new Date()): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return clampGibsDate(toIso(new Date(Date.UTC(y, m - 1, d + days))), now);
}
