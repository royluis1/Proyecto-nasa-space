"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, History, Layers, LayoutDashboard, Sprout, UserRound } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { L, localize } from "@/lib/i18n";
import { useT } from "@/components/i18n/lang-provider";

const huertaSteps = localize([
  { slug: "huerta", label: L("Mi huerta", "My garden"), icon: Sprout },
  { slug: "historial", label: L("Mi historial", "My history"), icon: History },
]);

const steps = localize([
  { slug: "perfil", label: L("Perfil y prioridades", "Profile and priorities"), icon: UserRound },
  { slug: "comparador", label: L("Comparador", "Comparison"), icon: BarChart3 },
  { slug: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { slug: "calendario", label: L("Calendario", "Calendar"), icon: CalendarDays },
  { slug: "escenarios", label: L("Escenarios", "Scenarios"), icon: Layers },
  { slug: "historial", label: L("Historial", "History"), icon: History },
]);

export function FieldNav({ fieldId }: { fieldId: string }) {
  const t = useT();
  const pathname = usePathname();
  const profile = useProfile();
  const items = profile === "huerta" ? huertaSteps : steps;
  return (
    <nav aria-label={t("Pasos del campo", "Field steps")} className="-mx-1 overflow-x-auto pb-1 print:hidden">
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
