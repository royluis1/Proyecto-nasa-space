"use client";

import { cn } from "@/lib/utils";
import { LANGS } from "@/lib/i18n";
import { useLang } from "./lang-provider";

/** Botones ES / EN. El idioma elegido queda guardado en el navegador. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <div role="group" aria-label={t("Idioma", "Language")} className={cn("inline-flex rounded-full border p-0.5", className)}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => l !== lang && setLang(l)}
          aria-pressed={l === lang}
          aria-label={l === "es" ? "Español" : "English"}
          className={cn(
            "min-h-9 min-w-9 rounded-full px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            l === lang ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
