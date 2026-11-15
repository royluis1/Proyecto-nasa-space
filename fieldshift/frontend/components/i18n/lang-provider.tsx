"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, locale, makeT, setCurrentLang, type Lang, type T } from "@/lib/i18n";

interface LangValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
}

const LangContext = React.createContext<LangValue | null>(null);

export function LangProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>(initialLang);
  const router = useRouter();
  // Las funciones de lib/ y los pedidos al backend (Accept-Language) usan este idioma.
  setCurrentLang(lang);

  const setLang = React.useCallback(
    (next: Lang) => {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = locale(next);
      setCurrentLang(next);
      setLangState(next);
      // Las páginas que se arman en el servidor también cambian de idioma.
      router.refresh();
    },
    [router],
  );

  const value = React.useMemo(() => ({ lang, setLang, t: makeT(lang) }), [lang, setLang]);
  // key={lang}: al cambiar de idioma se vuelve a montar la app, así ningún texto calculado
  // (useMemo, estados, datos del backend) queda en el idioma anterior.
  return (
    <LangContext.Provider value={value}>
      <React.Fragment key={lang}>{children}</React.Fragment>
    </LangContext.Provider>
  );
}

export function useLang(): LangValue {
  const ctx = React.useContext(LangContext);
  if (!ctx) throw new Error("useLang debe usarse dentro de <LangProvider>");
  return ctx;
}

/** Atajo: const t = useT(); t("Guardar", "Save"). */
export function useT(): T {
  return useLang().t;
}
