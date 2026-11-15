/** Glosario en lenguaje de productor. Lo usan el componente <Term>, la metodología y los textos del dashboard. */
import { L, localize } from "./i18n";

export interface GlossaryEntry {
  term: string;
  short: string;
  long: string;
}

const ENTRIES = {
  et0: {
    term: L("Evapotranspiración (ET₀)", "Evapotranspiration (ET₀)"),
    short: L("El agua que la atmósfera “pide” por día.", "The water the atmosphere “demands” per day."),
    long: L(
      "Los milímetros de agua que se evaporan del suelo y transpiran las plantas en un pasto bien regado. Si pide más de lo que llueve, hay déficit de agua.",
      "The millimeters of water that evaporate from the soil and transpire from plants in a well-watered grass. If it demands more than it rains, there is a water deficit.",
    ),
  },
  estres: {
    term: L("Estrés hídrico", "Water stress"),
    short: L("Cuando al cultivo le falta agua.", "When the crop lacks water."),
    long: L(
      "Cuando un cultivo no recibe toda el agua que necesita. En AgroOrbit es el porcentaje de la demanda que la lluvia y el agua guardada en el suelo no llegan a cubrir.",
      "When a crop does not get all the water it needs. In AgroOrbit it is the share of demand that rain and water stored in the soil fail to cover.",
    ),
  },
  smap: {
    term: L("Humedad del suelo (SMAP)", "Soil moisture (SMAP)"),
    short: L("Cuánta agua hay en el suelo, medida desde un satélite de la NASA.", "How much water is in the soil, measured from a NASA satellite."),
    long: L(
      "Un satélite de la NASA estima el agua del suelo en píxeles de 9 km. Se compara con lo normal para la misma época: si está 20 % por debajo, el suelo está más seco que casi siempre. Es contexto de la zona, no de tu lote.",
      "A NASA satellite estimates soil water in 9 km pixels. It is compared with the normal for the same time of year: if it is 20 % below, the soil is drier than almost always. It is context for the area, not your plot.",
    ),
  },
  ndvi: {
    term: L("NDVI (verdor)", "NDVI (greenness)"),
    short: L("Cuánto verde hay, visto desde el espacio.", "How much green there is, seen from space."),
    long: L(
      "Un número de 0 a 1 que indica cuánta vegetación verde hay: cerca de 0 es suelo desnudo, 0,3 o menos es barbecho o rastrojo y más de 0,7 es un cultivo en pleno desarrollo. No mide la materia orgánica del suelo.",
      "A number from 0 to 1 showing how much green vegetation there is: near 0 is bare soil, 0.3 or less is fallow or residue, and above 0.7 is a crop in full growth. It does not measure soil organic matter.",
    ),
  },
  barbecho: {
    term: L("Barbecho", "Fallow"),
    short: L("El lote sin cultivo.", "The plot without a crop."),
    long: L(
      "Período en que el lote queda sin cultivo. Sirve para juntar agua, pero deja el suelo expuesto al viento y a la erosión.",
      "A period when the plot has no crop. It helps store water, but leaves the soil exposed to wind and erosion.",
    ),
  },
  reanalisis: {
    term: L("Reanálisis", "Reanalysis"),
    short: L("Clima modelado y corregido con observaciones.", "Modeled weather corrected with observations."),
    long: L(
      "Un modelo del clima que se corrige con datos de estaciones y satélites. Rellena los lugares donde no hay estación, pero describe una zona de unos 50 km, no tu lote.",
      "A weather model corrected with station and satellite data. It fills in places without a station, but describes an area about 50 km wide, not your plot.",
    ),
  },
  aridez: {
    term: L("Índice de aridez", "Aridity index"),
    short: L("Lluvia dividida por la demanda de agua.", "Rainfall divided by water demand."),
    long: L(
      "Lluvia anual dividida por la demanda de agua de la atmósfera. Menos de 0,5 es zona semiárida; menos de 0,2, árida.",
      "Annual rainfall divided by the atmosphere's water demand. Below 0.5 is semi-arid; below 0.2, arid.",
    ),
  },
  variacion: {
    term: L("Variación de la lluvia", "Rainfall variability"),
    short: L("Qué tanto cambia la lluvia de un año a otro.", "How much rainfall changes from one year to the next."),
    long: L("Coeficiente de variación de la lluvia anual. Si es alto, un año seco es más probable.", "Coefficient of variation of annual rainfall. If it is high, a dry year is more likely."),
  },
  kc: {
    term: L("Coeficiente de cultivo (Kc)", "Crop coefficient (Kc)"),
    short: L("Cuánta agua necesita cada cultivo según su etapa.", "How much water each crop needs at each stage."),
    long: L(
      "Un número que multiplica la demanda de agua de la atmósfera para saber cuánta agua necesita cada cultivo en cada etapa. Son valores estándar de la FAO: no consideran tu variedad ni tu manejo.",
      "A number that multiplies the atmosphere's water demand to find how much water each crop needs at each stage. These are standard FAO values: they do not account for your variety or management.",
    ),
  },
  rango: {
    term: L("Rango probable", "Likely range"),
    short: L("Entre qué valores podría estar el puntaje.", "The values the score could fall between."),
    long: L(
      "Cuánto podría variar el puntaje si llueve 15 % más o menos, más un margen según la confianza en los datos.",
      "How much the score could change if it rains 15 % more or less, plus a margin based on confidence in the data.",
    ),
  },
  contribucion: {
    term: L("Contribución al puntaje", "Contribution to the score"),
    short: L("Cuántos puntos aporta cada componente al total.", "How many points each component adds to the total."),
    long: L(
      "Es el puntaje del componente (de 0 a 100) multiplicado por el peso que le diste. La suma de las cinco contribuciones es el puntaje total.",
      "It is the component's score (0 to 100) multiplied by the weight you gave it. The sum of the five contributions is the total score.",
    ),
  },
} satisfies Record<string, GlossaryEntry>;

export const GLOSSARY: Record<keyof typeof ENTRIES, GlossaryEntry> = localize(ENTRIES);

export type GlossaryKey = keyof typeof ENTRIES;
export const GLOSSARY_KEYS = Object.keys(ENTRIES) as GlossaryKey[];
