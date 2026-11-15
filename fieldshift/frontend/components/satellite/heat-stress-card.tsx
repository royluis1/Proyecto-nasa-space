"use client";

import { AsyncBlock } from "@/components/async-block";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { ApiResult, FieldHeatStress } from "@/types/api";
import { appLocale, tr } from "@/lib/i18n";
import { LABEL_INFO, LEVEL_LABELS } from "@/lib/format";
import type { DataLabel } from "@/types/api";

const c = (x: number | null) => (x == null ? "—" : `${x.toLocaleString(appLocale(), { maximumFractionDigits: 0 })} °C`);
const LEVEL = LEVEL_LABELS;

/** Calor y estrés de la zona con ECOSTRESS (temperatura de la superficie y estrés evaporativo, 70 m). */
export function HeatStressCard({ fieldId, compact = false }: { fieldId: string; compact?: boolean }) {
  const s = useAsync<ApiResult<FieldHeatStress>>((signal) => api.fieldHeatStress(fieldId, { signal }), [fieldId]);
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{tr("Calor y estrés de la zona (ECOSTRESS)", "Heat and stress in the area (ECOSTRESS)")}</CardTitle>
        <CardDescription>{tr("Temperatura de la superficie (no del aire) y estrés hídrico de la vegetación, medidos desde la Estación Espacial con píxeles de 70 m.", "Land surface temperature (not air) and vegetation water stress, measured from the Space Station with 70 m pixels.")}</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncBlock state={s} what={tr("los datos de ECOSTRESS", "the ECOSTRESS data")}>
          {(r) => {
            const d = r.data;
            return (
              <div className="space-y-4">
                <p className="text-lg">{d.reading}</p>
                <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
                  <Stat label={tr("Superficie en verano (media)", "Surface in summer (mean)")} value={c(d.lst_summer_mean_c)} hint={tr("Diciembre a febrero, en las pasadas del satélite", "December to February, on satellite passes")} />
                  <Stat label={tr("Superficie más caliente", "Hottest surface")} value={c(d.lst_max_c)} hint={d.hot_surface_obs != null ? tr(`${d.hot_surface_obs} pasadas con más de 45 °C`, `${d.hot_surface_obs} passes above 45 °C`) : undefined} />
                  {!compact && <Stat label={tr("Estrés evaporativo (ESI)", "Evaporative stress (ESI)")} value={d.esi_recent == null ? "—" : d.esi_recent.toLocaleString(appLocale())} hint={d.esi_normal != null ? tr(`Lo normal: ${d.esi_normal.toLocaleString(appLocale())} · 1 = sin estrés`, `Normal: ${d.esi_normal.toLocaleString(appLocale())} · 1 = no stress`) : tr("1 = sin estrés, 0 = mucho estrés", "1 = no stress, 0 = severe stress")} />}
                  <Stat label={tr("Estrés de la vegetación", "Vegetation stress")} value={d.stress_level ? LEVEL[d.stress_level] : "—"} hint={tr("Últimos 3 meses", "Last 3 months")} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {d.lst && <span>{tr("Temperatura", "Temperature")}: <Badge variant="cultivo">{LABEL_INFO[d.lst.label as DataLabel]?.text ?? d.lst.label}</Badge> {d.lst.observations} {tr("pasadas", "passes")}</span>}
                  {d.esi && <span>{tr("Estrés", "Stress")}: <Badge variant="agua">{LABEL_INFO[d.esi.label as DataLabel]?.text ?? d.esi.label}</Badge> {d.esi.observations} {tr("pasadas", "passes")}</span>}
                  <Badge variant={r.demo || d.lst?.origin === "sample" ? "alerta" : "outline"}>{r.demo ? tr("DATOS DE EJEMPLO", "SAMPLE DATA") : (d.lst ?? d.esi)?.origin_label}</Badge>
                  <span>{tr("Fuente", "Source")}: NASA ECOSTRESS · {d.period}</span>
                </div>
                {!compact && (
                  <details className="text-sm"><summary className="cursor-pointer font-medium">{tr("Limitaciones", "Limitations")}</summary>
                    <ul className="mt-1 list-disc pl-5">{[...(d.lst?.limitations ?? []), ...(d.esi?.limitations ?? []).slice(0, 1)].map((l) => <li key={l}>{l}</li>)}</ul>
                  </details>
                )}
              </div>
            );
          }}
        </AsyncBlock>
      </CardContent>
    </Card>
  );
}
