import { L, currentLang, locale, localize, tr } from "./i18n";
import type { Confidence, DataLabel, Level, OriginStatus, RotationStrategy, ScoreComponentKey, Severity } from "@/types/api";

const nf = (min: number, max: number) => new Intl.NumberFormat(locale(currentLang()), { minimumFractionDigits: min, maximumFractionDigits: max });

/** Número con el separador del idioma (coma en español, punto en inglés). `—` si no hay dato. */
export function num(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return nf(decimals, decimals).format(value);
}

export const pct = (value: number | null | undefined, decimals = 0): string =>
  value === null || value === undefined || Number.isNaN(value) ? "—" : `${num(value, decimals)} %`;

export const signed = (value: number | null | undefined, decimals = 0): string =>
  value === null || value === undefined || Number.isNaN(value) ? "—" : `${value > 0 ? "+" : ""}${num(value, decimals)}`;

export const MONTHS: readonly string[] = localize([
  L("ene", "Jan"), L("feb", "Feb"), L("mar", "Mar"), L("abr", "Apr"), L("may", "May"), L("jun", "Jun"),
  L("jul", "Jul"), L("ago", "Aug"), L("sep", "Sep"), L("oct", "Oct"), L("nov", "Nov"), L("dic", "Dec"),
]);
export const MONTHS_LONG: readonly string[] = localize([
  L("enero", "January"), L("febrero", "February"), L("marzo", "March"), L("abril", "April"), L("mayo", "May"), L("junio", "June"),
  L("julio", "July"), L("agosto", "August"), L("septiembre", "September"), L("octubre", "October"), L("noviembre", "November"), L("diciembre", "December"),
]);

export const STRATEGY_LABELS: Record<RotationStrategy, string> = localize({
  actual: L("Rotación actual", "Current rotation"),
  conservadora: L("Conservadora", "Conservative"),
  diversificada: L("Diversificada", "Diversified"),
  agua: L("Ahorro de agua", "Water saving"),
  suelo: L("Salud del suelo", "Soil health"),
  rentabilidad: L("Rentabilidad", "Profitability"),
  mixta: L("Mixta recomendada", "Recommended mix"),
});

/** Nombre de la rotación sin el prefijo de estrategia ("Mixta recomendada: ..."), para mostrarlo junto a la etiqueta de estrategia. */
export function rotationTitle(r: { name: string; strategy: RotationStrategy }): string {
  const prefix = `${STRATEGY_LABELS[r.strategy]}: `;
  return r.name.startsWith(prefix) ? r.name.slice(prefix.length) : r.name;
}

export const LEVEL_LABELS: Record<Level, string> = localize({ bajo: L("Bajo", "Low"), medio: L("Medio", "Medium"), alto: L("Alto", "High") });
export const CONFIDENCE_LABELS: Record<Confidence, string> = localize({
  alta: L("Confianza alta", "High confidence"),
  media: L("Confianza media", "Medium confidence"),
  baja: L("Confianza baja", "Low confidence"),
});
export const SEVERITY_LABELS: Record<Severity, string> = localize({ info: L("Para tener en cuenta", "Good to know"), media: L("Atención", "Watch"), alta: L("Alerta", "Alert") });

export const LABEL_INFO: Record<DataLabel, { text: string; help: string }> = localize({
  observado: { text: L("Observado", "Observed"), help: L("Medido por un satélite o instrumento.", "Measured by a satellite or instrument.") },
  modelado: { text: L("Modelado", "Modeled"), help: L("Salida de un modelo (por ejemplo, un reanálisis) que asimila observaciones.", "Output of a model (for example, a reanalysis) that assimilates observations.") },
  estimado: { text: L("Estimado", "Estimated"), help: L("Calculado por AgroOrbit a partir de otros datos.", "Calculated by AgroOrbit from other data.") },
  supuesto: { text: L("Supuesto", "Assumed"), help: L("Valor asumido, sin dato medido ni fuente verificada: hay que validarlo.", "Assumed value, with no measured data or verified source: it must be validated.") },
});

export const ORIGIN_LABELS: Record<OriginStatus, string> = localize({
  live: L("DATO NASA EN VIVO", "LIVE NASA DATA"),
  cached: L("DATO CACHEADO", "CACHED DATA"),
  sample: L("DATO DE MUESTRA", "SAMPLE DATA"),
  uploaded: L("DATO NASA CARGADO POR EL USUARIO", "NASA DATA UPLOADED BY THE USER"),
  mock: L("VALOR SIMULADO", "SIMULATED VALUE"),
  demo: L("DATOS DE EJEMPLO (SIN CONEXIÓN)", "SAMPLE DATA (OFFLINE)"),
});

export const ORIGIN_HELP: Record<OriginStatus, string> = localize({
  live: L("Consultado ahora a la fuente.", "Queried from the source just now."),
  cached: L("Guardado en una consulta anterior.", "Saved from an earlier query."),
  sample: L("Datos SIMULADOS incluidos en el sistema para funcionar sin red: no son observaciones.", "SIMULATED data bundled with the system so it works offline: these are not observations."),
  uploaded: L("Archivo cargado por vos.", "File uploaded by you."),
  mock: L("Valor simulado: la lógica todavía no está implementada.", "Simulated value: the logic is not implemented yet."),
  demo: L("El servidor no respondió: son datos de ejemplo simulados, no de tu campo.", "The server did not respond: this is simulated sample data, not your field."),
});

export const COMPONENTS: Record<ScoreComponentKey, { name: string; short: string; help: string }> = localize({
  A: {
    name: L("Resiliencia hídrica", "Water resilience"),
    short: L("Agua", "Water"),
    help: L("Qué parte de lo que necesitan los cultivos cubren la lluvia y el agua almacenada en el perfil.", "How much of the crops' needs are covered by rain and water stored in the soil profile."),
  },
  S: {
    name: L("Salud del suelo", "Soil health"),
    short: L("Suelo", "Soil"),
    help: L("Cobertura durante el año, aporte de materia orgánica, leguminosas y exposición a la erosión.", "Year-round cover, organic matter input, legumes and exposure to erosion."),
  },
  R: {
    name: L("Resiliencia climática", "Climate resilience"),
    short: L("Riesgo", "Risk"),
    help: L("Qué tan expuestos quedan los cultivos a sequía, calor, heladas y problemas sanitarios.", "How exposed the crops are to drought, heat, frost and pests or disease."),
  },
  I: {
    name: L("Ingreso relativo", "Relative income"),
    short: L("Ingreso", "Income"),
    help: L("Índice cualitativo del ingreso esperado. No son precios ni márgenes.", "Qualitative index of expected income. These are not prices or margins."),
  },
  E: {
    name: L("Sostenibilidad", "Sustainability"),
    short: L("Sostenibilidad", "Sustainability"),
    help: L("Diversidad de cultivos y familias, leguminosas, coberturas y repeticiones.", "Diversity of crops and families, legumes, cover crops and repetitions."),
  },
});
export const COMPONENT_ORDER: ScoreComponentKey[] = ["A", "S", "R", "I", "E"];

export const SOIL_TEXTURES: Record<string, string> = localize({
  arenosa: L("Arenosa", "Sandy"),
  franco_arenosa: L("Franco arenosa", "Sandy loam"),
  franca: L("Franca", "Loam"),
  franco_limosa: L("Franco limosa", "Silt loam"),
  franco_arcillosa: L("Franco arcillosa", "Clay loam"),
  arcillosa: L("Arcillosa", "Clay"),
});

export const aggregationNote = () =>
  tr(
    "Los 11 controles se agrupan en los 5 componentes del puntaje (agua, suelo, riesgo, ingreso y sostenibilidad): cada grupo usa el promedio de sus controles.",
    "The 11 checks are grouped into the 5 score components (water, soil, risk, income and sustainability): each group uses the average of its checks.",
  );

/** Palabra para un puntaje de 0 a 100 (acompaña siempre al número y al color). */
export const band = (v: number): "alto" | "medio" | "bajo" => (v >= 70 ? "alto" : v >= 45 ? "medio" : "bajo");
