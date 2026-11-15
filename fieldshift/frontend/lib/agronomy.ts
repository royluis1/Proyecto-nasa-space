import type { Crop } from "@/types/api";
import { L, localize } from "./i18n";

/** Roles de un cultivo en la salud del suelo a largo plazo (lo pide el desafío textual). */
export type SoilRole = "fija_nitrogeno" | "cobertura" | "raiz_profunda" | "tolera_sequia";

export const ROLE_ORDER: SoilRole[] = ["fija_nitrogeno", "cobertura", "raiz_profunda", "tolera_sequia"];

export interface RoleInfo {
  label: string;
  /** Una línea: qué aporta. */
  short: string;
  /** Explicación breve, para el desplegable. */
  why: string[];
  /** Cuidado o límite, para no exagerar el beneficio. */
  caveat: string;
  source: string;
}

export const ROLE_INFO: Record<SoilRole, RoleInfo> = localize({
  fija_nitrogeno: {
    label: L("Fija nitrógeno", "Fixes nitrogen"),
    short: L("Toma nitrógeno del aire y deja parte para el cultivo siguiente.", "Takes nitrogen from the air and leaves part for the next crop."),
    why: [
      L("Las leguminosas forman nódulos en la raíz con bacterias (rizobios) que convierten el nitrógeno del aire en nitrógeno que la planta usa.", "Legumes form root nodules with bacteria (rhizobia) that turn nitrogen from the air into nitrogen the plant can use."),
      L("Los restos de raíces y rastrojo liberan parte de ese nitrógeno al descomponerse: el cultivo que sigue necesita menos fertilizante.", "Root and residue remains release part of that nitrogen as they decompose: the next crop needs less fertilizer."),
    ],
    caveat: L("La soja se lleva mucho nitrógeno con el grano: su balance puede ser neutro o negativo. Vicia y alfalfa dejan más.", "Soybean removes a lot of nitrogen with the grain: its balance can be neutral or negative. Vetch and alfalfa leave more."),
    source: L("FAO; INTA (fijación biológica de nitrógeno)", "FAO; INTA (biological nitrogen fixation)"),
  },
  cobertura: {
    label: L("Cultivo de cobertura", "Cover crop"),
    short: L("Protege el suelo entre cosechas y suma materia orgánica.", "Protects the soil between harvests and adds organic matter."),
    why: [
      L("Evita que el suelo quede desnudo: frena la erosión por lluvia y viento.", "Keeps the soil from being bare: it slows rain and wind erosion."),
      L("Sus raíces y restos aportan carbono (materia orgánica), mejoran la estructura y ayudan a que el agua entre en vez de escurrir.", "Its roots and residue add carbon (organic matter), improve structure and help water soak in instead of running off."),
      L("Compite con las malezas y corta el ciclo de algunas plagas.", "It competes with weeds and breaks the cycle of some pests."),
    ],
    caveat: L("En zonas secas consume agua: hay que secarlo a tiempo para no quitarle humedad al cultivo de verano.", "In dry areas it uses water: it must be terminated in time so it doesn't take moisture from the summer crop."),
    source: L("FAO (agricultura de conservación); INTA (cultivos de servicio)", "FAO (conservation agriculture); INTA (service crops)"),
  },
  raiz_profunda: {
    label: L("Raíz profunda", "Deep roots"),
    short: L("Explora el suelo en profundidad y deja canales para el agua.", "Explores the soil at depth and leaves channels for water."),
    why: [
      L("Llega a agua y nutrientes que los cultivos de raíz corta no alcanzan, y los recicla hacia la superficie.", "Reaches water and nutrients that shallow-rooted crops cannot, and recycles them toward the surface."),
      L("Al morir, sus raíces dejan canales (bioporos) que mejoran la infiltración y la aireación.", "When its roots die they leave channels (biopores) that improve infiltration and aeration."),
      L("Aporta carbono en capas profundas, donde se conserva más tiempo.", "Adds carbon in deep layers, where it lasts longer."),
    ],
    caveat: L("Con capas compactadas o tosca cerca de la superficie, la raíz no llega tan hondo.", "With compacted layers or hardpan near the surface, roots don't go as deep."),
    source: L("FAO; literatura de manejo de suelos", "FAO; soil management literature"),
  },
  tolera_sequia: {
    label: L("Tolera la sequía", "Tolerates drought"),
    short: L("Rinde más parejo en años secos y mantiene el suelo cubierto.", "Yields more evenly in dry years and keeps the soil covered."),
    why: [
      L("Sigue creciendo con menos agua, así el lote no queda desnudo cuando un cultivo sensible fracasa.", "Keeps growing with less water, so the plot isn't left bare when a sensitive crop fails."),
      L("Da más estabilidad entre años: baja el riesgo de una campaña perdida.", "Gives more stability between years: lowers the risk of a lost season."),
    ],
    caveat: L("Tolerar no es no necesitar agua: en sequías extremas también pierde rendimiento.", "Tolerating isn't the same as not needing water: in extreme droughts it also loses yield."),
    source: L("FAO (requerimientos hídricos de cultivos)", "FAO (crop water requirements)"),
  },
});

/** Roles que cumple un cultivo, según el catálogo. */
export function cropRoles(c: Pick<Crop, "fixes_nitrogen" | "is_cover_crop" | "group" | "root_depth" | "drought_tolerance">): SoilRole[] {
  const roles: SoilRole[] = [];
  if (c.fixes_nitrogen) roles.push("fija_nitrogeno");
  if (c.is_cover_crop || c.group === "cobertura") roles.push("cobertura");
  if (c.root_depth === "alto") roles.push("raiz_profunda");
  if (c.drought_tolerance === "alto") roles.push("tolera_sequia");
  return roles;
}

/** Para cada rol, qué cultivos de la lista lo cumplen (en orden fijo, sin repetir). */
export function rolesInRotation(crops: Crop[]): { role: SoilRole; crops: string[] }[] {
  return ROLE_ORDER.map((role) => ({
    role,
    crops: [...new Set(crops.filter((c) => cropRoles(c).includes(role)).map((c) => c.name))],
  })).filter((r) => r.crops.length > 0);
}

/** Roles que faltan en la rotación (para sugerir qué sumar). */
export function missingRoles(crops: Crop[]): SoilRole[] {
  const present = new Set(rolesInRotation(crops).map((r) => r.role));
  return ROLE_ORDER.filter((r) => !present.has(r));
}
