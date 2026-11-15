"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { disclaimer } from "@/lib/content";
import { useT } from "@/components/i18n/lang-provider";

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="mt-12 border-t border-border/60 print:border-0">
      <div className="container space-y-4 py-8 text-sm text-muted-foreground">
        <p className="flex items-start gap-2 text-foreground/85">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            {disclaimer()}{" "}
            <Link href="/metodologia" className="font-semibold text-primary underline-offset-4 hover:underline">{t("Cómo se calcula", "How it is calculated")}</Link>
          </span>
        </p>
        <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 AgroOrbit · San Luis, Argentina</span>
          <span>{t("Datos de la NASA: POWER, SMAP, MODIS, Landsat/HLS, ECOSTRESS, SRTM, GPM y GIBS", "NASA data: POWER, SMAP, MODIS, Landsat/HLS, ECOSTRESS, SRTM, GPM and GIBS")}</span>
        </div>
      </div>
    </footer>
  );
}
