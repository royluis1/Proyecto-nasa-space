/** Perfil de uso (Huerta o Agricultor). Sin contraseñas: se guarda en este navegador. */

export type Profile = "huerta" | "agricultor";
export const PROFILE_KEY = "fieldshift:perfil";
export const PROFILE_EVENT = "fieldshift:perfil";

export const PROFILES: Record<Profile, { label: string; icon: string; who: string; home: (fieldId: string) => string }> = {
  huerta: {
    label: "Huerta",
    icon: "🥬",
    who: "Tengo una huerta en casa, comunitaria o produzco verduras en poca superficie.",
    home: (id) => `/campo/${id}/huerta`,
  },
  agricultor: {
    label: "Agricultor",
    icon: "🚜",
    who: "Manejo lotes de cultivos extensivos y quiero comparar rotaciones.",
    home: (id) => `/campo/${id}/perfil`,
  },
};

export const isProfile = (v: unknown): v is Profile => v === "huerta" || v === "agricultor";

export function readProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PROFILE_KEY);
    return isProfile(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile | null): void {
  try {
    if (p) window.localStorage.setItem(PROFILE_KEY, p);
    else window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* navegador sin almacenamiento: el perfil dura hasta recargar */
  }
  window.dispatchEvent(new Event(PROFILE_EVENT));
}
