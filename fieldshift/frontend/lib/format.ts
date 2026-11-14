import type { Confidence, DataLabel, Level, OriginStatus, RotationStrategy, ScoreComponentKey, Severity } from "@/types/api";

const nf = (min: number, max: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: min, maximumFractionDigits: max });

/** Número con coma decimal (es-AR). `—` si no hay dato. */
export function num(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return nf(decimals, decimals).format(value);
}

export const pct = (value: number | null | undefined, decimals = 0): string =>
  value === null || value === undefined || Number.isNaN(value) ? "—" : `${num(value, decimals)} %`;

export const signed = (value: number | null | undefined, decimals = 0): string =>
  value === null || value === undefined || Number.isNaN(value) ? "—" : `${value > 0 ? "+" : ""}${num(value, decimals)}`;

export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;
export const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export const STRATEGY_LABELS: Record<RotationStrategy, string> = {
  actual: "Rotación actual",
  conservadora: "Conservadora",
  diversificada: "Diversificada",
  agua: "Ahorro de agua",
  suelo: "Salud del suelo",
  rentabilidad: "Rentabilidad",
  mixta: "Mixta recomendada",
};

/** Nombre de la rotación sin el prefijo de estrategia ("Mixta recomendada: ..."), para mostrarlo junto a la etiqueta de estrategia. */
export function rotationTitle(r: { name: string; strategy: RotationStrategy }): string {
  const prefix = `${STRATEGY_LABELS[r.strategy]}: `;
  return r.name.startsWith(prefix) ? r.name.slice(prefix.length) : r.name;
}

export const LEVEL_LABELS: Record<Level, string> = { bajo: "Bajo", medio: "Medio", alto: "Alto" };
export const CONFIDENCE_LABELS: Record<Confidence, string> = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" };
export const SEVERITY_LABELS: Record<Severity, string> = { info: "Para tener en cuenta", media: "Atención", alta: "Alerta" };

export const LABEL_INFO: Record<DataLabel, { text: string; help: string }> = {
  observado: { text: "Observado", help: "Medido por un satélite o instrumento." },
  modelado: { text: "Modelado", help: "Salida de un modelo (por ejemplo, un reanálisis) que asimila observaciones." },
  estimado: { text: "Estimado", help: "Calculado por FieldShift a partir de otros datos." },
  supuesto: { text: "Supuesto", help: "Valor asumido, sin dato medido ni fuente verificada: hay que validarlo." },
};

export const ORIGIN_LABELS: Record<OriginStatus, string> = {
  live: "DATO NASA EN VIVO",
  cached: "DATO CACHEADO",
  sample: "DATO DE MUESTRA",
  uploaded: "DATO NASA CARGADO POR EL USUARIO",
  mock: "VALOR SIMULADO",
  demo: "DATOS DE EJEMPLO (SIN CONEXIÓN)",
};

export const ORIGIN_HELP: Record<OriginStatus, string> = {
  live: "Consultado ahora a la fuente.",
  cached: "Guardado en una consulta anterior.",
  sample: "Datos SIMULADOS incluidos en el sistema para funcionar sin red: no son observaciones.",
  uploaded: "Archivo cargado por vos.",
  mock: "Valor simulado: la lógica todavía no está implementada.",
  demo: "El servidor no respondió: son datos de ejemplo simulados, no de tu campo.",
};

export const COMPONENTS: Record<ScoreComponentKey, { name: string; short: string; help: string }> = {
  A: { name: "Resiliencia hídrica", short: "Agua", help: "Qué parte de lo que necesitan los cultivos cubren la lluvia y el agua almacenada en el perfil." },
  S: { name: "Salud del suelo", short: "Suelo", help: "Cobertura durante el año, aporte de materia orgánica, leguminosas y exposición a la erosión." },
  R: { name: "Resiliencia climática", short: "Riesgo", help: "Qué tan expuestos quedan los cultivos a sequía, calor, heladas y problemas sanitarios." },
  I: { name: "Ingreso relativo", short: "Ingreso", help: "Índice cualitativo del ingreso esperado. No son precios ni márgenes." },
  E: { name: "Sostenibilidad", short: "Sostenibilidad", help: "Diversidad de cultivos y familias, leguminosas, coberturas y repeticiones." },
};
export const COMPONENT_ORDER: ScoreComponentKey[] = ["A", "S", "R", "I", "E"];

export const SOIL_TEXTURES: Record<string, string> = {
  arenosa: "Arenosa",
  franco_arenosa: "Franco arenosa",
  franca: "Franca",
  franco_limosa: "Franco limosa",
  franco_arcillosa: "Franco arcillosa",
  arcillosa: "Arcillosa",
};

export const AGGREGATION_NOTE =
  "Los 11 controles se agrupan en los 5 componentes del puntaje (agua, suelo, riesgo, ingreso y sostenibilidad): cada grupo usa el promedio de sus controles.";

/** Palabra para un puntaje de 0 a 100 (acompaña siempre al número y al color). */
export const band = (v: number): "alto" | "medio" | "bajo" => (v >= 70 ? "alto" : v >= 45 ? "medio" : "bajo");
