import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el navegador (login e historial de lotes).
 * Lee la URL y la clave anon/publishable de variables de entorno. Son públicas: viajan al navegador.
 * Si no están configuradas, la app sigue funcionando con los datos de la NASA y de ejemplo, sin login.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true solo si están cargadas las dos variables. Sirve para mostrar u ocultar el login. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Devuelve el cliente (singleton) o null si Supabase no está configurado todavía. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
