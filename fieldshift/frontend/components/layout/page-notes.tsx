"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/lang-provider";

/**
 * Pie de página de una pantalla: junta las advertencias y la info secundaria abajo de todo,
 * para que la parte de arriba quede limpia. No es el pie del sitio (ese es SiteFooter).
 */
export function PageNotes({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  title ??= t("Notas y advertencias de esta página", "Notes and warnings for this page");
  return (
    <section aria-label={title} className={cn("mt-10 border-t pt-5 print:border-0", className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Info aria-hidden className="size-4" />
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}
