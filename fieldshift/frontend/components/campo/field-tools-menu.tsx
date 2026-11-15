"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BellRing, ChevronRight, CloudSun, FileText, PanelRightOpen, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { L, localize } from "@/lib/i18n";
import { useT } from "@/components/i18n/lang-provider";

interface Tool {
  slug: string;
  label: string;
  text: string;
  icon: LucideIcon;
  tone: string;
}

const AGRICULTOR: Tool[] = localize([
  { slug: "diagnostico", label: L("Diagnóstico", "Diagnosis"), text: L("Clima, humedad del suelo, verdor y relieve con datos de la NASA.", "Weather, soil moisture, greenness and terrain from NASA data."), icon: CloudSun, tone: "bg-sky-soft text-sky" },
  { slug: "alertas", label: L("Alertas", "Alerts"), text: L("Heladas, calor, tormentas y falta de agua de los próximos días.", "Frost, heat, storms and water shortage in the coming days."), icon: BellRing, tone: "bg-warning-soft text-warning" },
  { slug: "reporte", label: L("Reporte", "Report"), text: L("El plan en PDF o CSV para llevarle a tu ingeniero agrónomo.", "The plan as PDF or CSV to take to your agronomist."), icon: FileText, tone: "bg-secondary text-primary" },
]);

const HUERTA: Tool[] = localize([
  { slug: "diagnostico", label: L("Clima y satélites", "Weather and satellites"), text: L("Clima, humedad del suelo y verdor de tu zona con datos de la NASA.", "Weather, soil moisture and greenness in your area from NASA data."), icon: CloudSun, tone: "bg-sky-soft text-sky" },
  { slug: "alertas", label: L("Alertas", "Alerts"), text: L("Heladas, calor, tormentas y falta de agua de los próximos días.", "Frost, heat, storms and water shortage in the coming days."), icon: BellRing, tone: "bg-warning-soft text-warning" },
]);

/** Menú que se abre desde la derecha con Diagnóstico, Alertas y Reporte. Es el único lugar desde donde se llega a esas pantallas. */
export function FieldToolsMenu({ fieldId, fieldName }: { fieldId: string; fieldName: string }) {
  const t = useT();
  const pathname = usePathname();
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const tools = profile === "huerta" ? HUERTA : AGRICULTOR;
  const inside = tools.some((tool) => pathname === `/campo/${fieldId}/${tool.slug}`);
  const short = profile === "huerta" ? t("Clima y alertas", "Weather and alerts") : t("Diagnóstico, alertas y reporte", "Diagnosis, alerts and report");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant={inside ? "default" : "outline"} className="ml-auto">
          <PanelRightOpen aria-hidden />
          <span className="hidden sm:inline">{short}</span>
          <span className="sm:hidden">{t("Más", "More")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[22rem] max-w-[90vw] flex-col gap-6">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-display text-xl">{t("Herramientas del campo", "Field tools")}</SheetTitle>
          <SheetDescription>{fieldName}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t("Herramientas del campo", "Field tools")}>
          <ul className="space-y-2">
            {tools.map(({ slug, label, text, icon: Icon, tone }) => {
              const href = `/campo/${fieldId}/${slug}`;
              const current = pathname === href;
              return (
                <li key={slug}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:bg-secondary",
                      current && "border-primary bg-secondary",
                    )}
                  >
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{label}</span>
                      <span className="block text-sm text-muted-foreground">{text}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
