import { getSupabase } from "@/lib/supabase/client";
import { tr } from "@/lib/i18n";

/** Un lote guardado por el usuario en Supabase (tabla public.lotes). */
export interface LoteRow {
  id: string;
  user_id: string;
  nombre: string;
  establecimiento: string | null;
  lat: number;
  lon: number;
  area_ha: number | null;
  con_riego: boolean;
  datos: Record<string, unknown> | null;
  creado_en: string;
  actualizado_en: string;
}

/** Un registro del historial de un lote (tabla public.lote_historial). */
export interface HistorialRow {
  id: string;
  lote_id: string;
  user_id: string;
  fecha: string;
  tipo: string | null;
  cultivo: string | null;
  nota: string | null;
  datos: Record<string, unknown> | null;
  creado_en: string;
}

export type NuevoLote = Pick<LoteRow, "nombre" | "lat" | "lon"> &
  Partial<Pick<LoteRow, "establecimiento" | "area_ha" | "con_riego" | "datos">>;

export type NuevoHistorial = Pick<HistorialRow, "lote_id"> &
  Partial<Pick<HistorialRow, "fecha" | "tipo" | "cultivo" | "nota" | "datos">>;

class SupabaseNotReady extends Error {
  constructor() {
    super(tr("Supabase no está configurado.", "Supabase is not configured."));
  }
}

function db() {
  const supabase = getSupabase();
  if (!supabase) throw new SupabaseNotReady();
  return supabase;
}

/** Lotes del usuario logueado, del más nuevo al más viejo. */
export async function listLotes(): Promise<LoteRow[]> {
  const { data, error } = await db().from("lotes").select("*").order("creado_en", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as LoteRow[]) ?? [];
}

/** Crea un lote para el usuario logueado. user_id lo pone RLS con auth.uid(). */
export async function createLote(lote: NuevoLote): Promise<LoteRow> {
  const supabase = db();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error(tr("Tenés que iniciar sesión para guardar un lote.", "You need to sign in to save a field."));
  const { data, error } = await supabase
    .from("lotes")
    .insert({ ...lote, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LoteRow;
}

/** Actualiza campos de un lote propio. */
export async function updateLote(id: string, cambios: Partial<NuevoLote>): Promise<LoteRow> {
  const { data, error } = await db()
    .from("lotes")
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LoteRow;
}

/** Borra un lote propio (y su historial, por la FK en cascada). */
export async function deleteLote(id: string): Promise<void> {
  const { error } = await db().from("lotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Historial de un lote, del más reciente al más viejo. */
export async function listHistorial(loteId: string): Promise<HistorialRow[]> {
  const { data, error } = await db()
    .from("lote_historial")
    .select("*")
    .eq("lote_id", loteId)
    .order("fecha", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as HistorialRow[]) ?? [];
}

/** Agrega un registro al historial de un lote (siembra, cosecha, riego, observación, nota). */
export async function addHistorial(registro: NuevoHistorial): Promise<HistorialRow> {
  const supabase = db();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error(tr("Tenés que iniciar sesión para guardar en el historial.", "You need to sign in to save to the history."));
  const { data, error } = await supabase
    .from("lote_historial")
    .insert({ ...registro, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HistorialRow;
}

/**
 * El lote de la cuenta que corresponde a un campo de AgroOrbit (se guarda su id en datos.field_id).
 * Devuelve null si todavía no se guardó.
 */
export async function findLoteByFieldId(fieldId: string): Promise<LoteRow | null> {
  const { data, error } = await db().from("lotes").select("*").eq("datos->>field_id", fieldId).limit(1);
  if (error) throw new Error(error.message);
  return ((data as LoteRow[]) ?? [])[0] ?? null;
}

/** Borra un registro propio del historial. */
export async function deleteHistorial(id: string): Promise<void> {
  const { error } = await db().from("lote_historial").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
