import type { Crop } from "@/types/api";

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

export const ROLE_INFO: Record<SoilRole, RoleInfo> = {
  fija_nitrogeno: {
    label: "Fija nitrógeno",
    short: "Toma nitrógeno del aire y deja parte para el cultivo siguiente.",
    why: [
      "Las leguminosas forman nódulos en la raíz con bacterias (rizobios) que convierten el nitrógeno del aire en nitrógeno que la planta usa.",
      "Los restos de raíces y rastrojo liberan parte de ese nitrógeno al descomponerse: el cultivo que sigue necesita menos fertilizante.",
    ],
    caveat: "La soja se lleva mucho nitrógeno con el grano: su balance puede ser neutro o negativo. Vicia y alfalfa dejan más.",
    source: "FAO; INTA (fijación biológica de nitrógeno)",
  },
  cobertura: {
    label: "Cultivo de cobertura",
    short: "Protege el suelo entre cosechas y suma materia orgánica.",
    why: [
      "Evita que el suelo quede desnudo: frena la erosión por lluvia y viento.",
      "Sus raíces y restos aportan carbono (materia orgánica), mejoran la estructura y ayudan a que el agua entre en vez de escurrir.",
      "Compite con las malezas y corta el ciclo de algunas plagas.",
    ],
    caveat: "En zonas secas consume agua: hay que secarlo a tiempo para no quitarle humedad al cultivo de verano.",
    source: "FAO (agricultura de conservación); INTA (cultivos de servicio)",
  },
  raiz_profunda: {
    label: "Raíz profunda",
    short: "Explora el suelo en profundidad y deja canales para el agua.",
    why: [
      "Llega a agua y nutrientes que los cultivos de raíz corta no alcanzan, y los recicla hacia la superficie.",
      "Al morir, sus raíces dejan canales (bioporos) que mejoran la infiltración y la aireación.",
      "Aporta carbono en capas profundas, donde se conserva más tiempo.",
    ],
    caveat: "Con capas compactadas o tosca cerca de la superficie, la raíz no llega tan hondo.",
    source: "FAO; literatura de manejo de suelos",
  },
  tolera_sequia: {
    label: "Tolera la sequía",
    short: "Rinde más parejo en años secos y mantiene el suelo cubierto.",
    why: [
      "Sigue creciendo con menos agua, así el lote no queda desnudo cuando un cultivo sensible fracasa.",
      "Da más estabilidad entre años: baja el riesgo de una campaña perdida.",
    ],
    caveat: "Tolerar no es no necesitar agua: en sequías extremas también pierde rendimiento.",
    source: "FAO (requerimientos hídricos de cultivos)",
  },
};

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
