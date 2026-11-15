import type { HistorialRow } from "@/lib/supabase/lotes";

/** Tipos de registro del historial de un lote. Lo pidió la agrónoma: llevar la historia para después decidir. */
export const TIPOS = ["siembra", "cosecha", "riego", "observacion", "nota"] as const;
export type TipoRegistro = (typeof TIPOS)[number];

export const TIPO_LABEL: Record<TipoRegistro, string> = {
  siembra: "Siembra",
  cosecha: "Cosecha",
  riego: "Riego",
  observacion: "Observación",
  nota: "Nota",
};

/** Los que necesitan decir qué cultivo. */
export const NEEDS_CROP: ReadonlySet<TipoRegistro> = new Set(["siembra", "cosecha"]);

export const isTipo = (v: unknown): v is TipoRegistro => typeof v === "string" && (TIPOS as readonly string[]).includes(v);

export interface NuevoRegistroForm {
  fecha: string;
  tipo: string;
  cultivo: string;
  nota: string;
}

/** Revisa el formulario antes de mandarlo. Devuelve un error por campo (vacío si está todo bien). */
export function validateRegistro(f: NuevoRegistroForm, today: Date = new Date()): Partial<Record<keyof NuevoRegistroForm, string>> {
  const errors: Partial<Record<keyof NuevoRegistroForm, string>> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) errors.fecha = "Elegí una fecha.";
  else {
    const d = new Date(`${f.fecha}T00:00:00`);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 1);
    if (Number.isNaN(d.getTime())) errors.fecha = "La fecha no es válida.";
    else if (d > limit) errors.fecha = "El historial es de lo que ya pasó: la fecha no puede ser futura.";
    else if (d.getFullYear() < 1950) errors.fecha = "Revisá el año.";
  }
  if (!isTipo(f.tipo)) errors.tipo = "Elegí qué pasó.";
  else if (NEEDS_CROP.has(f.tipo) && !f.cultivo.trim()) errors.cultivo = `Para una ${TIPO_LABEL[f.tipo].toLowerCase()} decí qué cultivo.`;
  if (f.nota.length > 1000) errors.nota = "La nota es muy larga (máximo 1000 caracteres).";
  if (f.tipo === "nota" && !f.nota.trim()) errors.nota = "Escribí la nota.";
  return errors;
}

/** Agrupa los registros por año, del más reciente al más viejo, y dentro de cada año del más nuevo al más viejo. */
export function groupByYear(rows: Pick<HistorialRow, "id" | "fecha">[]): { year: number; rows: typeof rows }[] {
  const sorted = [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const map = new Map<number, typeof rows>();
  for (const r of sorted) {
    const y = Number(r.fecha.slice(0, 4));
    map.set(y, [...(map.get(y) ?? []), r]);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([year, rs]) => ({ year, rows: rs }));
}

/**
 * Lo que de verdad se sembró en el lote, en orden: la rotación real según el historial.
 * Sirve para comparar con la rotación que el productor dice que hace.
 */
export function sownSequence(rows: Pick<HistorialRow, "fecha" | "tipo" | "cultivo">[]): string[] {
  return rows
    .filter((r) => r.tipo === "siembra" && r.cultivo)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((r) => r.cultivo as string);
}

/** Fecha en formato argentino, sin correrse de día por la zona horaria. */
export function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
}
