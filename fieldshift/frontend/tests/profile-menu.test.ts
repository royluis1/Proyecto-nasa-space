import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROFILE_MENU_KEY,
  readProfileMenuState,
  resolveActiveProfileMenuId,
  saveProfileMenuState,
  submenuForActiveProfileMenuId,
} from "@/lib/profile-menu";

describe("profile menu", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("marks the correct section as active based on the route", () => {
    const fieldId = "campo-este";
    expect(resolveActiveProfileMenuId(`/campo/${fieldId}/perfil`, fieldId)).toBe("priority-editor");
    expect(resolveActiveProfileMenuId(`/campo/${fieldId}/perfil`, fieldId, "#prioridades")).toBe("priority-editor");
    expect(resolveActiveProfileMenuId(`/campo/${fieldId}/comparador`, fieldId)).toBe("compare");
    expect(resolveActiveProfileMenuId(`/campo/${fieldId}/alertas`, fieldId)).toBe("alerts");
    expect(resolveActiveProfileMenuId(`/campo/${fieldId}/calendario`, fieldId)).toBe("calendar");
    expect(resolveActiveProfileMenuId(`/campo/${fieldId}/historial`, fieldId)).toBe("history");
    expect(resolveActiveProfileMenuId(`/campo/${fieldId}/escenarios`, fieldId)).toBe("scenarios");
    expect(resolveActiveProfileMenuId(`/campo/${fieldId}/dashboard`, fieldId)).toBe("comparative-dashboard");
    expect(resolveActiveProfileMenuId(`/metodologia`, fieldId)).toBe("information");
  });

  it("persists open/closed submenu state across reload via localStorage", () => {
    saveProfileMenuState({ openSubmenu: "tools", activeSection: "calendar" });
    // simulate reload by reading fresh from storage
    expect(localStorage.getItem(PROFILE_MENU_KEY)).toContain("tools");
    expect(readProfileMenuState()).toEqual({ openSubmenu: "tools", activeSection: "calendar" });

    saveProfileMenuState({ openSubmenu: null, activeSection: "calendar" });
    expect(readProfileMenuState().openSubmenu).toBeNull();
  });

  it("resolves which submenu contains an active section", () => {
    expect(submenuForActiveProfileMenuId("priority-editor")).toBe("profile");
    expect(submenuForActiveProfileMenuId("alerts")).toBe("tools");
    expect(submenuForActiveProfileMenuId("information")).toBeNull();
  });
});
