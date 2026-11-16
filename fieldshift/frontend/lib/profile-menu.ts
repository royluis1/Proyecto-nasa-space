/** Persistencia y lógica del menú lateral del perfil agricultor. */
export const PROFILE_MENU_KEY = "fieldshift:profile-menu";
export const PROFILE_MENU_EVENT = "fieldshift:profile-menu";

export type ProfileMenuState = {
  /** Submenú abierto: "profile" | "tools" | null */
  openSubmenu: "profile" | "tools" | null;
  /** Slug de la sección activa (según ruta/sección). */
  activeSection: string | null;
};

const DEFAULT_STATE: ProfileMenuState = { openSubmenu: null, activeSection: null };

export function readProfileMenuState(): ProfileMenuState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(PROFILE_MENU_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<ProfileMenuState>;
    const openSubmenu =
      parsed.openSubmenu === "profile" || parsed.openSubmenu === "tools" ? parsed.openSubmenu : null;
    const activeSection = typeof parsed.activeSection === "string" ? parsed.activeSection : null;
    return { openSubmenu, activeSection };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveProfileMenuState(state: ProfileMenuState): void {
  try {
    window.localStorage.setItem(PROFILE_MENU_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PROFILE_MENU_EVENT));
}

export function updateProfileMenuState(patch: Partial<ProfileMenuState>): ProfileMenuState {
  const next = { ...readProfileMenuState(), ...patch };
  saveProfileMenuState(next);
  return next;
}

export type ProfileMenuSubmenu = "profile" | "tools";

export const PROFILE_MENU_CHILDREN: Record<ProfileMenuSubmenu, string[]> = {
  profile: ["priority-editor", "view-rotation-plan"],
  tools: ["compare", "alerts", "calendar", "history", "scenarios", "comparative-dashboard", "campaigns"],
};

/** Resuelve la sección activa según la ruta actual (y hash en perfil). */
export function resolveActiveProfileMenuId(pathname: string, fieldId: string, hash = ""): string | null {
  const base = `/campo/${fieldId}`;
  if (pathname === `${base}/perfil`) {
    if (hash === "#prioridades") return "priority-editor";
    return "priority-editor";
  }
  if (pathname.startsWith(`${base}/comparador`) || pathname.includes("/rotacion/")) return "compare";
  if (pathname.startsWith(`${base}/alertas`)) return "alerts";
  if (pathname.startsWith(`${base}/calendario`)) return "calendar";
  if (pathname.startsWith(`${base}/historial`)) return "history";
  if (pathname.startsWith(`${base}/escenarios`)) return "scenarios";
  if (pathname.startsWith(`${base}/dashboard`)) return "comparative-dashboard";
  if (pathname.startsWith("/metodologia")) return "information";
  return null;
}

export function submenuForActiveProfileMenuId(activeId: string | null): ProfileMenuSubmenu | null {
  if (!activeId) return null;
  if (PROFILE_MENU_CHILDREN.profile.includes(activeId)) return "profile";
  if (PROFILE_MENU_CHILDREN.tools.includes(activeId)) return "tools";
  return null;
}
