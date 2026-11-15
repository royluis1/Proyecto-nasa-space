/**
 * Traduce a lenguaje claro los avisos y textos técnicos que llegan del servidor
 * (códigos de error, nombres de productos, siglas), sin cambiar lo que dicen.
 * El servidor responde en el idioma elegido: cada regla reconoce el aviso en español y en inglés.
 */
import { tr } from "./i18n";

type Rule = [es: RegExp, en: RegExp, out: () => string];

const RULES: Rule[] = [
  [/^NASA POWER no respondió.*$/s, /^NASA POWER did not respond.*$/s, () => tr("No pudimos consultar el clima de la NASA en este momento: se usan datos guardados o de muestra simulada.", "We couldn't query NASA weather right now: saved data or simulated sample data is used.")],
  [/^AppEEARS no disponible.*$/s, /^AppEEARS unavailable.*$/s, () => tr("No pudimos consultar a la NASA (AppEEARS) en este momento: se usan datos de muestra simulados.", "We couldn't query NASA (AppEEARS) right now: simulated sample data is used.")],
  [/^SMAP: Sin credenciales de AppEEARS.*$/s, /^SMAP: No AppEEARS credentials.*$/s, () => tr("Humedad del suelo (SMAP): no se consultaron datos en vivo porque falta la conexión con la NASA.", "Soil moisture (SMAP): no live data was queried because the NASA connection is missing.")],
  [/^NDVI: Sin credenciales de AppEEARS.*$/s, /^NDVI: No AppEEARS credentials.*$/s, () => tr("Vegetación (NDVI): no se consultaron datos en vivo porque falta la conexión con la NASA.", "Vegetation (NDVI): no live data was queried because the NASA connection is missing.")],
  [/^Sin credenciales de AppEEARS.*$/s, /^No AppEEARS credentials.*$/s, () => tr("No se consultaron datos satelitales en vivo porque falta la conexión con la NASA.", "No live satellite data was queried because the NASA connection is missing.")],
  [/^SRTM: SRTM no disponible \(sin credenciales.*$/s, /^SRTM: SRTM unavailable \(no credentials.*$/s, () => tr("Relieve (SRTM): no se descargó en vivo porque el servidor no tiene cuenta de Earthdata.", "Terrain (SRTM): not downloaded live because the server has no Earthdata account.")],
  [/^SRTM: SRTM no disponible.*$/s, /^SRTM: SRTM unavailable.*$/s, () => tr("Relieve (SRTM): no se pudo descargar en vivo; se usa un dato de respaldo.", "Terrain (SRTM): could not be downloaded live; a fallback value is used.")],
  [/^SRTM: Se usa un relieve de MUESTRA SIMULADA.*$/s, /^SRTM: Using SIMULATED SAMPLE terrain.*$/s, () => tr("Relieve (SRTM): se usa una pendiente de muestra SIMULADA; no es una medición de tu campo.", "Terrain (SRTM): a SIMULATED sample slope is used; it is not a measurement of your field.")],
  [/^SMAP: Se usan DATOS DE MUESTRA SIMULADOS.*$/s, /^SMAP: Using SIMULATED SAMPLE DATA.*$/s, () => tr("Humedad del suelo (SMAP): se usan datos de muestra SIMULADOS; no son mediciones de tu campo.", "Soil moisture (SMAP): SIMULATED sample data is used; these are not measurements of your field.")],
  [/^NDVI: Se usan DATOS DE MUESTRA SIMULADOS.*$/s, /^NDVI: Using SIMULATED SAMPLE DATA.*$/s, () => tr("Vegetación (NDVI): se usan datos de muestra SIMULADOS; no son mediciones de tu campo.", "Vegetation (NDVI): SIMULATED sample data is used; these are not measurements of your field.")],
  [/^Se usan DATOS DE MUESTRA SIMULADOS.*$/s, /^Using SIMULATED SAMPLE DATA.*$/s, () => tr("Clima: se usan datos de muestra SIMULADOS; no son mediciones de tu campo.", "Weather: SIMULATED sample data is used; these are not measurements of your field.")],
  [/^SMAP: Se pidió la extracción.*$/s, /^SMAP: Extraction was requested.*$/s, () => tr("Humedad del suelo (SMAP): ya pedimos los datos a la NASA, pero todavía no están listos. Mientras tanto se usa una muestra simulada.", "Soil moisture (SMAP): we already requested the data from NASA, but it is not ready yet. Meanwhile a simulated sample is used.")],
  [/^NDVI: Se pidió la extracción.*$/s, /^NDVI: Extraction was requested.*$/s, () => tr("Vegetación (NDVI): ya pedimos los datos a la NASA, pero todavía no están listos. Mientras tanto se usa una muestra simulada.", "Vegetation (NDVI): we already requested the data from NASA, but it is not ready yet. Meanwhile a simulated sample is used.")],
];

/** Aviso del servidor en palabras de productor. Lo que no conoce lo deja como está. */
export function friendlyWarning(text: string): string {
  for (const [es, en, out] of RULES) {
    if (es.test(text) || en.test(text)) return out();
  }
  return text;
}

export const friendlyWarnings = (list: string[]): string[] => [...new Set(list.map(friendlyWarning))];

const TERMS: [RegExp, () => string][] = [
  [/\bET0\b/g, () => tr("evapotranspiración (ET₀)", "evapotranspiration (ET₀)")],
  [/\bKc\b/g, () => tr("coeficiente de cultivo (Kc)", "crop coefficient (Kc)")],
  [/\bSMAP L3\b/g, () => tr("humedad del suelo SMAP (superficie)", "SMAP soil moisture (surface)")],
  [/\bSMAP L4\b/g, () => tr("humedad del suelo SMAP (zona de raíces)", "SMAP soil moisture (root zone)")],
  [/\bNDVI MODIS\b/g, () => tr("verdor (NDVI de MODIS)", "greenness (MODIS NDVI)")],
];

/** Reemplaza siglas técnicas por su explicación. */
export function plain(text: string): string {
  return TERMS.reduce((acc, [re, to]) => acc.replace(re, to()), text);
}
