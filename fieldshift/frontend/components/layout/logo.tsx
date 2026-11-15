"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/lang-provider";

/** Logo de AgroOrbit: una órbita con una hoja, en un recuadro con degradado. */
export function Logo() {
  const t = useT();
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label={t("AgroOrbit, inicio", "AgroOrbit, home")}>
      <span className="relative grid size-9 place-items-center rounded-xl bg-gradient-primary shadow-soft">
        <svg viewBox="0 0 24 24" className="size-5 text-primary-foreground" fill="none" aria-hidden>
          <ellipse cx="12" cy="12" rx="10" ry="4.2" stroke="currentColor" strokeWidth="1.6" transform="rotate(-25 12 12)" />
          <path d="M12 17.5c0-4 1.6-7.4 5-9-3.8-.3-6.4 1.9-5 9Z" fill="currentColor" />
          <path d="M12 17.5c0-3-1.2-5.4-3.8-6.6 2.8-.2 4.7 1.4 3.8 6.6Z" fill="currentColor" opacity=".7" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-foreground">
        Agro<span className="text-primary-glow">Orbit</span>
      </span>
    </Link>
  );
}
