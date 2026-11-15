import { cookies } from "next/headers";
import { LANG_COOKIE, makeT, parseLang, type Lang, type T } from "./i18n";

/** Idioma elegido (cookie) para los componentes de servidor. */
export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getT(): Promise<T> {
  return makeT(await getLang());
}
