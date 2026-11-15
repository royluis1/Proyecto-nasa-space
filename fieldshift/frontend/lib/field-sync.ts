import type { Level, SoilEstimate, SoilTexture } from "@/types/api";

/**
 * Sincronización del formulario del campo: lo que se completa solo (suelo estimado, nombre desde la ciudad)
 * y lo que carga el productor. Regla: lo que carga el productor nunca se pisa, y con análisis de laboratorio
 * la estimación no se usa.
 */

/** Qué casillas de suelo están completadas automáticamente (y por lo tanto no son del productor). */
export interface SoilAutoFlags {
  texture: boolean;
  organic_matter: boolean;
}

export const NO_AUTO: SoilAutoFlags = { texture: false, organic_matter: false };

interface SoilFields {
  texture: SoilTexture | "";
  organic_matter: Level | "";
  lab_analysis: boolean;
}

/** Solo datos reales completan el formulario: en vivo o en caché. Nunca la muestra simulada. */
export const usableEstimate = (e: SoilEstimate | null | undefined): e is SoilEstimate =>
  Boolean(e && (e.origin === "live" || e.origin === "cached"));

/**
 * Completa textura y materia orgánica con la estimación del punto.
 * - Solo toca casillas vacías o que ya eran automáticas (lo del productor queda igual).
 * - Si la estimación nueva no sirve (muestra, sin datos o hay análisis de laboratorio), borra lo automático
 *   que había: era de otro punto y ya no corresponde.
 */
export function applySoilEstimate<T extends SoilFields>(s: T, auto: SoilAutoFlags, e: SoilEstimate | null | undefined): { state: T; auto: SoilAutoFlags } {
  const use = usableEstimate(e) && !s.lab_analysis;
  const next: T = { ...s };
  const flags: SoilAutoFlags = { ...auto };

  const texture = use ? (e as SoilEstimate).texture : null;
  if (s.texture === "" || auto.texture) {
    if (texture) {
      next.texture = texture;
      flags.texture = true;
    } else if (auto.texture) {
      next.texture = "";
      flags.texture = false;
    }
  }

  const om = use ? (e as SoilEstimate).organic_matter : null;
  if (s.organic_matter === "" || auto.organic_matter) {
    if (om) {
      next.organic_matter = om;
      flags.organic_matter = true;
    } else if (auto.organic_matter) {
      next.organic_matter = "";
      flags.organic_matter = false;
    }
  }
  return { state: next, auto: flags };
}

/**
 * Para guardar: lo autocompletado que nadie tocó se manda vacío. Así el backend lo completa con la misma estimación
 * pero rotulada como "estimado (SoilGrids)", y no como si lo hubiera declarado el productor.
 */
export function soilForSave<T extends SoilFields>(s: T, auto: SoilAutoFlags): T {
  return { ...s, texture: auto.texture ? "" : s.texture, organic_matter: auto.organic_matter ? "" : s.organic_matter };
}

/** Al editar un campo guardado: lo que el backend completó solo sigue marcado como automático. */
export function initialSoilAuto(applied: readonly string[] | null | undefined): SoilAutoFlags {
  const a = applied ?? [];
  // El backend lo escribe en el idioma del pedido: se aceptan los dos.
  return { texture: a.includes("textura") || a.includes("texture"), organic_matter: a.includes("materia orgánica") || a.includes("organic matter") };
}

/** El nombre del campo acompaña a la ciudad elegida mientras el productor no haya escrito uno propio. */
export function nameAfterLocality(current: string, lastAuto: string | null, locality: string): { name: string; auto: string | null } {
  if (!current.trim() || current === lastAuto) return { name: locality, auto: locality };
  return { name: current, auto: lastAuto };
}
