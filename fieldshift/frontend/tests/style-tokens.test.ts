import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Los tokens de color guardan componentes oklch ("L C H"). Envolverlos en hsl() da un color inválido
 * que el navegador descarta sin avisar (ni axe lo detecta): pasó una vez y dejó sin dibujar los tooltips,
 * el mapa de calor y las tramas del calendario. Este test lo impide.
 */
const ROOTS = ["app", "components", "lib", "hooks"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

describe("uso de los tokens de color", () => {
  const all = ROOTS.flatMap(files);

  it("nadie envuelve un token en hsl() (son componentes oklch)", () => {
    const bad = all.filter((f) => /hsl\(\s*var\(--/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("los tokens del tema se definen como componentes oklch sueltos, sin hsl()", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const defs = [...css.matchAll(/^\s*--(background|foreground|primary|card|border|success|warning|critical|sky):\s*([^;]+);/gm)];
    expect(defs.length).toBeGreaterThan(0);
    for (const [, name, value] of defs) {
      expect(value, `--${name}`).toMatch(/^[\d.]+ [\d.]+ [\d.]+$/);
    }
  });
});
