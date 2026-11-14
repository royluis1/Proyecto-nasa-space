/** Glosario en lenguaje de productor. Lo usan el componente <Term>, la metodología y los textos del dashboard. */
export interface GlossaryEntry {
  term: string;
  short: string;
  long: string;
}

export const GLOSSARY = {
  et0: {
    term: "Evapotranspiración (ET₀)",
    short: "El agua que la atmósfera “pide” por día.",
    long: "Los milímetros de agua que se evaporan del suelo y transpiran las plantas en un pasto bien regado. Si pide más de lo que llueve, hay déficit de agua.",
  },
  estres: {
    term: "Estrés hídrico",
    short: "Cuando al cultivo le falta agua.",
    long: "Cuando un cultivo no recibe toda el agua que necesita. En FieldShift es el porcentaje de la demanda que la lluvia y el agua guardada en el suelo no llegan a cubrir.",
  },
  smap: {
    term: "Humedad del suelo (SMAP)",
    short: "Cuánta agua hay en el suelo, medida desde un satélite de la NASA.",
    long: "Un satélite de la NASA estima el agua del suelo en píxeles de 9 km. Se compara con lo normal para la misma época: si está 20 % por debajo, el suelo está más seco que casi siempre. Es contexto de la zona, no de tu lote.",
  },
  ndvi: {
    term: "NDVI (verdor)",
    short: "Cuánto verde hay, visto desde el espacio.",
    long: "Un número de 0 a 1 que indica cuánta vegetación verde hay: cerca de 0 es suelo desnudo, 0,3 o menos es barbecho o rastrojo y más de 0,7 es un cultivo en pleno desarrollo. No mide la materia orgánica del suelo.",
  },
  barbecho: {
    term: "Barbecho",
    short: "El lote sin cultivo.",
    long: "Período en que el lote queda sin cultivo. Sirve para juntar agua, pero deja el suelo expuesto al viento y a la erosión.",
  },
  reanalisis: {
    term: "Reanálisis",
    short: "Clima modelado y corregido con observaciones.",
    long: "Un modelo del clima que se corrige con datos de estaciones y satélites. Rellena los lugares donde no hay estación, pero describe una zona de unos 50 km, no tu lote.",
  },
  aridez: {
    term: "Índice de aridez",
    short: "Lluvia dividida por la demanda de agua.",
    long: "Lluvia anual dividida por la demanda de agua de la atmósfera. Menos de 0,5 es zona semiárida; menos de 0,2, árida.",
  },
  variacion: {
    term: "Variación de la lluvia",
    short: "Qué tanto cambia la lluvia de un año a otro.",
    long: "Coeficiente de variación de la lluvia anual. Si es alto, un año seco es más probable.",
  },
  kc: {
    term: "Coeficiente de cultivo (Kc)",
    short: "Cuánta agua necesita cada cultivo según su etapa.",
    long: "Un número que multiplica la demanda de agua de la atmósfera para saber cuánta agua necesita cada cultivo en cada etapa. Son valores estándar de la FAO: no consideran tu variedad ni tu manejo.",
  },
  rango: {
    term: "Rango probable",
    short: "Entre qué valores podría estar el puntaje.",
    long: "Cuánto podría variar el puntaje si llueve 15 % más o menos, más un margen según la confianza en los datos.",
  },
  contribucion: {
    term: "Contribución al puntaje",
    short: "Cuántos puntos aporta cada componente al total.",
    long: "Es el puntaje del componente (de 0 a 100) multiplicado por el peso que le diste. La suma de las cinco contribuciones es el puntaje total.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
export const GLOSSARY_KEYS = Object.keys(GLOSSARY) as GlossaryKey[];
