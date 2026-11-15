/** Estilos y textos del mapa de zonas. Nunca solo color: cada clase tiene también un patrón y un rótulo. */
import type { CropSuitability, Level, ZoneClimate } from "@/types/api";
import { L, appLocale, localize, tr } from "./i18n";

export type ZoneClass = "arido" | "semiarido" | "subhumedo_seco" | "humedo";
export type Pattern = "puntos" | "diagonal" | "cruzado" | "horizontal" | "liso";

export interface MapStyle {
  id: string; // id del <pattern> SVG
  label: string;
  color: string; // relleno base
  ink: string; // color del patrón
  pattern: Pattern;
}

export const ZONE_STYLES: Record<ZoneClass, MapStyle> = localize({
  arido: { id: "fs-z-arido", label: L("Árida", "Arid"), color: "#e8b48a", ink: "#8a4b1c", pattern: "puntos" },
  semiarido: { id: "fs-z-semiarido", label: L("Semiárida", "Semi-arid"), color: "#f0d58c", ink: "#8a6a12", pattern: "diagonal" },
  subhumedo_seco: { id: "fs-z-subhumedo_seco", label: L("Subhúmeda seca", "Dry sub-humid"), color: "#a9d6a0", ink: "#2f6f40", pattern: "cruzado" },
  humedo: { id: "fs-z-humedo", label: L("Subhúmeda húmeda o más húmeda", "Moist sub-humid or wetter"), color: "#a7cbe8", ink: "#1d5279", pattern: "horizontal" },
});

export const LEVEL_STYLES: Record<Level, MapStyle> = localize({
  alto: { id: "fs-l-alto", label: L("Aptitud alta", "High suitability"), color: "#8fd19e", ink: "#1f6b34", pattern: "liso" },
  medio: { id: "fs-l-medio", label: L("Aptitud media", "Medium suitability"), color: "#f3d27a", ink: "#8a6a12", pattern: "diagonal" },
  bajo: { id: "fs-l-bajo", label: L("Aptitud baja", "Low suitability"), color: "#f0a99b", ink: "#9b2c1c", pattern: "cruzado" },
});

export const LEVEL_WORD: Record<Level, string> = localize({ alto: L("alta", "high"), medio: L("media", "medium"), bajo: L("baja", "low") });

export const isZoneClass = (v: unknown): v is ZoneClass => typeof v === "string" && v in ZONE_STYLES;

/** Aptitud de un cultivo en una zona, a partir del resumen que trae cada zona del GeoJSON. */
export function levelFor(props: { suitability?: { crop_id: string; level: Level }[] }, cropId: string): Level | null {
  return props.suitability?.find((s) => s.crop_id === cropId)?.level ?? null;
}

/** Estilo de una zona: por clase climática o, si hay cultivo elegido, por su aptitud. */
export function styleFor(props: { zone_class: string; suitability?: { crop_id: string; level: Level }[] }, cropId: string | null): MapStyle {
  if (cropId) {
    const lvl = levelFor(props, cropId);
    if (lvl) return LEVEL_STYLES[lvl];
  }
  return isZoneClass(props.zone_class) ? ZONE_STYLES[props.zone_class] : ZONE_STYLES.semiarido;
}

/** Rótulo de la zona en el mapa (texto, además del patrón). */
export function mapLabel(props: { zone_label: string; suitability?: { crop_id: string; crop_name?: string; level: Level }[] }, cropId: string | null, cropName?: string): string {
  if (cropId) {
    const lvl = levelFor(props, cropId);
    return lvl ? `${props.zone_label}: ${cropName ?? cropId} ${LEVEL_WORD[lvl]}` : props.zone_label;
  }
  return props.zone_label;
}

/** Clima de una zona o celda en filas de texto. */
export function climateRows(c: ZoneClimate): [string, string][] {
  const n = (x: number, d = 0) => x.toLocaleString(appLocale(), { maximumFractionDigits: d, minimumFractionDigits: d });
  return [
    [tr("Lluvia", "Rain"), `${n(c.precip_mm)} ${tr("mm/año", "mm/yr")}`],
    [tr("Evaporación de referencia (ET0)", "Reference evaporation (ET0)"), `${n(c.et0_mm)} ${tr("mm/año", "mm/yr")}`],
    [tr("Déficit hídrico", "Water deficit"), `${n(c.deficit_mm)} ${tr("mm/año", "mm/yr")}`],
    [tr("Índice de aridez (lluvia / ET0)", "Aridity index (rain / ET0)"), n(c.aridity_index, 2)],
    [tr("Días con más de 35 °C", "Days above 35 °C"), `${n(c.hot_days)} ${tr("por año", "per year")}`],
    [tr("Días con mínima de 2 °C o menos", "Days with a low of 2 °C or less"), `${n(c.frost_days)} ${tr("por año", "per year")}`],
    [tr("Variabilidad de la lluvia", "Rainfall variability"), c.precip_cv_pct == null ? tr("sin dato", "no data") : `${n(c.precip_cv_pct)} % ${tr("entre años", "between years")}`],
    [tr("Años en que se comportó como otra zona", "Years it behaved like another zone"), `${n(c.years_other_class_pct)} %`],
  ];
}

/** Agrupa la aptitud por nivel (alta, media, baja), en ese orden. */
export function groupByLevel(items: CropSuitability[]): { level: Level; items: CropSuitability[] }[] {
  return (["alto", "medio", "bajo"] as Level[]).map((level) => ({ level, items: items.filter((i) => i.level === level) })).filter((g) => g.items.length);
}
