/**
 * Idioma de la app: inglés (por defecto) o español.
 * Los textos se escriben de a pares en el mismo lugar donde se usan: t("Guardar", "Save").
 * Así cada frase queda junto a su traducción y no hay claves que se desincronicen.
 */
export type Lang = "en" | "es";

export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "agroorbit-lang";
export const LANGS: readonly Lang[] = ["en", "es"];

/** Elige el texto según el idioma. Sirve para textos y para nodos de React. */
export type T = <V>(es: V, en: V) => V;

export function makeT(lang: Lang): T {
  return (es, en) => (lang === "en" ? en : es);
}

export function parseLang(value: string | null | undefined): Lang {
  return value === "es" || value === "en" ? value : DEFAULT_LANG;
}

/** Código para <html lang> y para formatear números y fechas. */
export function locale(lang: Lang): string {
  return lang === "en" ? "en-US" : "es-AR";
}

/* Idioma activo para las funciones de lib/ que arman textos fuera de un componente
   (reporte, alertas, errores de la API). Lo fija el LangProvider antes de dibujar la página. */
let current: Lang = DEFAULT_LANG;
export function setCurrentLang(lang: Lang) {
  current = lang;
}
export const currentLang = (): Lang => current;
/** Código de idioma activo para toLocaleString / Intl ("en-US" o "es-AR"). */
export const appLocale = (): string => locale(current);
/** Igual que t(), con el idioma activo. Para usar en lib/; los componentes usan useT(). */
export const tr: T = (es, en) => (current === "en" ? en : es);

/* ----------------------- constantes traducidas ----------------------- */

const MARK = Symbol("i18n");
type Marked = { [MARK]: [string, string] };

/**
 * Texto de una constante (tablas de etiquetas, listas). Se usa dentro de localize():
 *   export const LEVELS = localize({ bajo: L("Bajo", "Low") });
 * Al leer LEVELS.bajo se obtiene el texto en el idioma activo.
 */
export function L(es: string, en: string): string {
  return { [MARK]: [es, en] } as unknown as string;
}

const isMarked = (v: unknown): v is Marked => typeof v === "object" && v !== null && MARK in v;

/** Convierte los L(...) de un objeto o lista (también anidados) en lecturas según el idioma activo. */
export function localize<O extends object>(obj: O): O {
  for (const key of Object.keys(obj)) {
    const v = (obj as Record<string, unknown>)[key];
    if (isMarked(v)) {
      const [es, en] = v[MARK];
      Object.defineProperty(obj, key, { get: () => tr(es, en), enumerable: true, configurable: true });
    } else if (typeof v === "object" && v !== null) {
      localize(v);
    }
  }
  return obj;
}
