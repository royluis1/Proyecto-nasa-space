/** Estilos y textos del mapa de zonas. Nunca solo color: cada clase tiene también un patrón y un rótulo. */
import type { CropSuitability, Level, ZoneClimate } from "@/types/api";

export type ZoneClass = "arido" | "semiarido" | "subhumedo_seco" | "humedo";
export type Pattern = "puntos" | "diagonal" | "cruzado" | "horizontal" | "liso";

export interface MapStyle {
  id: string; // id del <pattern> SVG
  label: string;
  color: string; // relleno base
  ink: string; // color del patrón
  pattern: Pattern;
}

export const ZONE_STYLES: Record<ZoneClass, MapStyle> = {
  arido: { id: "fs-z-arido", label: "Árida", color: "#e8b48a", ink: "#8a4b1c", pattern: "puntos" },
  semiarido: { id: "fs-z-semiarido", label: "Semiárida", color: "#f0d58c", ink: "#8a6a12", pattern: "diagonal" },
  subhumedo_seco: { id: "fs-z-subhumedo_seco", label: "Subhúmeda seca", color: "#a9d6a0", ink: "#2f6f40", pattern: "cruzado" },
  humedo: { id: "fs-z-humedo", label: "Subhúmeda húmeda o más húmeda", color: "#a7cbe8", ink: "#1d5279", pattern: "horizontal" },
};

export const LEVEL_STYLES: Record<Level, MapStyle> = {
  alto: { id: "fs-l-alto", label: "Aptitud alta", color: "#8fd19e", ink: "#1f6b34", pattern: "liso" },
  medio: { id: "fs-l-medio", label: "Aptitud media", color: "#f3d27a", ink: "#8a6a12", pattern: "diagonal" },
  bajo: { id: "fs-l-bajo", label: "Aptitud baja", color: "#f0a99b", ink: "#9b2c1c", pattern: "cruzado" },
};

export const LEVEL_WORD: Record<Level, string> = { alto: "alta", medio: "media", bajo: "baja" };

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
  const n = (x: number, d = 0) => x.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
  return [
    ["Lluvia", `${n(c.precip_mm)} mm/año`],
    ["Evaporación de referencia (ET0)", `${n(c.et0_mm)} mm/año`],
    ["Déficit hídrico", `${n(c.deficit_mm)} mm/año`],
    ["Índice de aridez (lluvia / ET0)", n(c.aridity_index, 2)],
    ["Días con más de 35 °C", `${n(c.hot_days)} por año`],
    ["Días con mínima de 2 °C o menos", `${n(c.frost_days)} por año`],
    ["Variabilidad de la lluvia", c.precip_cv_pct == null ? "sin dato" : `${n(c.precip_cv_pct)} % entre años`],
    ["Años en que se comportó como otra zona", `${n(c.years_other_class_pct)} %`],
  ];
}

/** Agrupa la aptitud por nivel (alta, media, baja), en ese orden. */
export function groupByLevel(items: CropSuitability[]): { level: Level; items: CropSuitability[] }[] {
  return (["alto", "medio", "bajo"] as Level[]).map((level) => ({ level, items: items.filter((i) => i.level === level) })).filter((g) => g.items.length);
}
