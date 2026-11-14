"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BellRing, CalendarDays, CloudSun, FileText, Layers, LayoutDashboard, Sprout, UserRound } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

const huertaSteps = [
  { slug: "huerta", label: "Mi huerta", icon: Sprout },
  { slug: "alertas", label: "Alertas", icon: BellRing },
  { slug: "diagnostico", label: "Clima y satélites", icon: CloudSun },
];

const steps = [
  { slug: "perfil", label: "Perfil y prioridades", icon: UserRound },
  { slug: "diagnostico", label: "Diagnóstico", icon: CloudSun },
  { slug: "alertas", label: "Alertas", icon: BellRing },
  { slug: "comparador", label: "Comparador", icon: BarChart3 },
  { slug: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { slug: "calendario", label: "Calendario", icon: CalendarDays },
  { slug: "escenarios", label: "Escenarios", icon: Layers },
  { slug: "reporte", label: "Reporte", icon: FileText },
];

export function FieldNav({ fieldId }: { fieldId: string }) {
  const pathname = usePathname();
  const profile = useProfile();
  const items = profile === "huerta" ? huertaSteps : steps;
  return (
    <nav aria-label="Pasos del campo" className="-mx-1 overflow-x-auto pb-1 print:hidden">
      <ol className="flex min-w-max gap-1 px-1">
        {items.map(({ slug, label, icon: Icon }, i) => {
          const href = `/campo/${fieldId}/${slug}`;
          const current = pathname === href || (slug === "comparador" && pathname.startsWith(`${href}`)) || (slug === "comparador" && pathname.includes("/rotacion/"));
          return (
            <li key={slug}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-medium hover:bg-accent",
                  current && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                <span aria-hidden className="text-sm opacity-70">{i + 1}</span>
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
