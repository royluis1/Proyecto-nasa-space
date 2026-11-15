/** Perfil de uso (Huerta o Agricultor). Sin contraseñas: se guarda en este navegador. */
import { tr } from "./i18n";

export type Profile = "huerta" | "agricultor";
export const PROFILE_KEY = "fieldshift:perfil";
export const PROFILE_EVENT = "fieldshift:perfil";

export const PROFILES: Record<Profile, { label: string; icon: string; who: string; home: (fieldId: string) => string }> = {
  huerta: {
    get label() {
      return tr("Huerta", "Garden");
    },
    icon: "🥬",
    get who() {
      return tr("Tengo una huerta en casa, comunitaria o produzco verduras en poca superficie.", "I have a home or community vegetable garden, or grow vegetables on a small area.");
    },
    home: (id) => `/campo/${id}/huerta`,
  },
  agricultor: {
    get label() {
      return tr("Agricultor", "Farmer");
    },
    icon: "🚜",
    get who() {
      return tr("Manejo lotes de cultivos extensivos y quiero comparar rotaciones.", "I manage field-crop plots and want to compare rotations.");
    },
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
