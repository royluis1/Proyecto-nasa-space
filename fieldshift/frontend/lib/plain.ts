/**
 * Traduce a lenguaje claro los avisos y textos técnicos que llegan del servidor
 * (códigos de error, nombres de productos, siglas), sin cambiar lo que dicen.
 */

const RULES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/^NASA POWER no respondió.*$/s, "No pudimos consultar el clima de la NASA en este momento: se usan datos guardados o de muestra simulada."],
  [/^AppEEARS no disponible.*$/s, "No pudimos consultar a la NASA (AppEEARS) en este momento: se usan datos de muestra simulados."],
  [/^SMAP: Sin credenciales de AppEEARS.*$/s, "Humedad del suelo (SMAP): no se consultaron datos en vivo porque falta la conexión con la NASA."],
  [/^NDVI: Sin credenciales de AppEEARS.*$/s, "Vegetación (NDVI): no se consultaron datos en vivo porque falta la conexión con la NASA."],
  [/^Sin credenciales de AppEEARS.*$/s, "No se consultaron datos satelitales en vivo porque falta la conexión con la NASA."],
  [/^SRTM: SRTM no disponible \(sin credenciales.*$/s, "Relieve (SRTM): no se descargó en vivo porque el servidor no tiene cuenta de Earthdata."],
  [/^SRTM: SRTM no disponible.*$/s, "Relieve (SRTM): no se pudo descargar en vivo; se usa un dato de respaldo."],
  [/^SRTM: Se usa un relieve de MUESTRA SIMULADA.*$/s, "Relieve (SRTM): se usa una pendiente de muestra SIMULADA; no es una medición de tu campo."],
  [/^SMAP: Se usan DATOS DE MUESTRA SIMULADOS.*$/s, "Humedad del suelo (SMAP): se usan datos de muestra SIMULADOS; no son mediciones de tu campo."],
  [/^NDVI: Se usan DATOS DE MUESTRA SIMULADOS.*$/s, "Vegetación (NDVI): se usan datos de muestra SIMULADOS; no son mediciones de tu campo."],
  [/^Se usan DATOS DE MUESTRA SIMULADOS.*$/s, "Clima: se usan datos de muestra SIMULADOS; no son mediciones de tu campo."],
  [/^SMAP: Se pidió la extracción.*$/s, "Humedad del suelo (SMAP): ya pedimos los datos a la NASA, pero todavía no están listos. Mientras tanto se usa una muestra simulada."],
  [/^NDVI: Se pidió la extracción.*$/s, "Vegetación (NDVI): ya pedimos los datos a la NASA, pero todavía no están listos. Mientras tanto se usa una muestra simulada."],
];

/** Aviso del servidor en palabras de productor. Lo que no conoce lo deja como está. */
export function friendlyWarning(text: string): string {
  for (const [re, out] of RULES) {
    const m = text.match(re);
    if (m) return typeof out === "string" ? out : out(m);
  }
  return text;
}

export const friendlyWarnings = (list: string[]): string[] => [...new Set(list.map(friendlyWarning))];

const TERMS: [RegExp, string][] = [
  [/\bET0\b/g, "evapotranspiración (ET₀)"],
  [/\bKc\b/g, "coeficiente de cultivo (Kc)"],
  [/\bSMAP L3\b/g, "humedad del suelo SMAP (superficie)"],
  [/\bSMAP L4\b/g, "humedad del suelo SMAP (zona de raíces)"],
  [/\bNDVI MODIS\b/g, "verdor (NDVI de MODIS)"],
];

/** Reemplaza siglas técnicas por su explicación. */
export function plain(text: string): string {
  return TERMS.reduce((acc, [re, to]) => acc.replace(re, to), text);
}
