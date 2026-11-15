"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SourceMap } from "@/components/sources/source-map";
import { PROFILES, saveProfile, type Profile } from "@/lib/profile";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/lang-provider";
import type { T } from "@/lib/i18n";

const GETS = (t: T): Record<Profile, string[]> => ({
  huerta: [
    t("Cuánto regar cada semana", "How much to water each week"),
    t("Cuándo hiela y cuándo es seguro trasplantar", "When it freezes and when it is safe to transplant"),
    t("Lluvia que cayó y la que viene", "Rain that fell and rain on the way"),
    t("Alertas de heladas, calor y tormentas", "Frost, heat and storm alerts"),
  ],
  agricultor: [
    t("Comparar rotaciones con puntaje explicable", "Compare rotations with an explainable score"),
    t("Escenarios de sequía, calor y riego", "Drought, heat and irrigation scenarios"),
    t("Calendario por campañas y reporte para el técnico", "Season calendar and report for your agronomist"),
    t("Alertas tempranas para el lote", "Early warnings for the plot"),
  ],
});

export default function IngresarPage() {
  const t = useT();
  const router = useRouter();
  const current = useProfile();
  const choose = (p: Profile) => {
    saveProfile(p);
    router.push("/campos");
  };
  return (
    <div className="space-y-8">
      <PageHeader
        title={t("¿Cómo vas a usar AgroOrbit?", "How will you use AgroOrbit?")}
        description={t(
          "Elegí tu perfil. Lo podés cambiar cuando quieras desde el encabezado. No hace falta contraseña: se guarda en este navegador.",
          "Choose your profile. You can change it any time from the header. No password needed: it is saved in this browser.",
        )}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {(Object.keys(PROFILES) as Profile[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => choose(p)}
            aria-pressed={current === p}
            className={cn(
              "flex flex-col items-start gap-3 rounded-[1.25rem] border-2 bg-card p-6 text-left transition-colors hover:border-primary focus-visible:border-primary",
              current === p && "border-primary bg-secondary",
            )}
          >
            <span aria-hidden className="text-6xl leading-none">{PROFILES[p].icon}</span>
            <span className="text-2xl font-extrabold">{PROFILES[p].label}</span>
            <span className="text-muted-foreground">{PROFILES[p].who}</span>
            <ul className="list-disc space-y-1 pl-5">{GETS(t)[p].map((g) => <li key={g}>{g}</li>)}</ul>
            <span className="mt-2 inline-flex min-h-12 items-center rounded-[0.9rem] bg-primary px-5 text-lg font-extrabold text-primary-foreground">
              {current === p ? t("Seguir como ", "Continue as ") : t("Entrar como ", "Enter as ")}{PROFILES[p].label}
            </span>
          </button>
        ))}
      </div>
      <section aria-labelledby="fuentes" className="space-y-4">
        <h2 id="fuentes" className="text-2xl font-bold">{t("Qué datos usa cada perfil", "What data each profile uses")}</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {(Object.keys(PROFILES) as Profile[]).map((p) => (
            <div key={p} className="min-w-0 space-y-2">
              <h3 className="text-lg font-semibold"><span aria-hidden>{PROFILES[p].icon} </span>{PROFILES[p].label}</h3>
              <SourceMap profile={p} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
