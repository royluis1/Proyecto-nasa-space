"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BellRing, ChevronRight, CloudSun, FileText, PanelRightOpen, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

interface Tool {
  slug: string;
  label: string;
  text: string;
  icon: LucideIcon;
  tone: string;
}

const AGRICULTOR: Tool[] = [
  { slug: "diagnostico", label: "Diagnóstico", text: "Clima, humedad del suelo, verdor y relieve con datos de la NASA.", icon: CloudSun, tone: "bg-sky-soft text-sky" },
  { slug: "alertas", label: "Alertas", text: "Heladas, calor, tormentas y falta de agua de los próximos días.", icon: BellRing, tone: "bg-warning-soft text-warning" },
  { slug: "reporte", label: "Reporte", text: "El plan en PDF o CSV para llevarle a tu ingeniero agrónomo.", icon: FileText, tone: "bg-secondary text-primary" },
];

const HUERTA: Tool[] = [
  { slug: "diagnostico", label: "Clima y satélites", text: "Clima, humedad del suelo y verdor de tu zona con datos de la NASA.", icon: CloudSun, tone: "bg-sky-soft text-sky" },
  { slug: "alertas", label: "Alertas", text: "Heladas, calor, tormentas y falta de agua de los próximos días.", icon: BellRing, tone: "bg-warning-soft text-warning" },
];

/** Menú que se abre desde la derecha con Diagnóstico, Alertas y Reporte. Es el único lugar desde donde se llega a esas pantallas. */
export function FieldToolsMenu({ fieldId, fieldName }: { fieldId: string; fieldName: string }) {
  const pathname = usePathname();
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const tools = profile === "huerta" ? HUERTA : AGRICULTOR;
  const inside = tools.some((t) => pathname === `/campo/${fieldId}/${t.slug}`);
  const short = profile === "huerta" ? "Clima y alertas" : "Diagnóstico, alertas y reporte";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant={inside ? "default" : "outline"} className="ml-auto">
          <PanelRightOpen aria-hidden />
          <span className="hidden sm:inline">{short}</span>
          <span className="sm:hidden">Más</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[22rem] max-w-[90vw] flex-col gap-6">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-display text-xl">Herramientas del campo</SheetTitle>
          <SheetDescription>{fieldName}</SheetDescription>
        </SheetHeader>
        <nav aria-label="Herramientas del campo">
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
