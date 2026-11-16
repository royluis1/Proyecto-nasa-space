import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startHref } from "@/lib/profile";
import { PUBLIC_NAV_HREFS } from "@/lib/nav";

describe("portada y header público", () => {
  it("el botón Empezar lleva al flujo de ingreso sin perfil", () => {
    expect(startHref(null)).toBe("/ingresar");
  });

  it("con un perfil elegido, Empezar va directo a los campos", () => {
    expect(startHref("huerta")).toBe("/campos");
    expect(startHref("agricultor")).toBe("/campos");
  });

  it("el header público no supera 3 ítems (logo + 1 enlace + acceso)", () => {
    // logo (1) + enlaces de navegación + un único acceso (1) <= 3
    expect(PUBLIC_NAV_HREFS.length).toBeLessThanOrEqual(1);
    expect(PUBLIC_NAV_HREFS).toContain("/como-funciona");
    // Regiones, Mis campos y Metodología ya no están en el header público.
    for (const href of ["/zonas", "/campos", "/metodologia"]) {
      expect(PUBLIC_NAV_HREFS).not.toContain(href);
    }
  });

  it("el acceso del header es un único botón 'Sign in' cuando no hay sesión", () => {
    // AccountChip is the only access control in the logged-out header; MainAction/"Sign up" was removed.
    const header = readFileSync(join(process.cwd(), "components/layout/site-header.tsx"), "utf8");
    expect(header).toContain("<AccountChip />");
    expect(header).not.toContain("MainAction");
    expect(header).not.toContain("Sign up");
  });
});
