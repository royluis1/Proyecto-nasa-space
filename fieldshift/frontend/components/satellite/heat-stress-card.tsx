"use client";

import { AsyncBlock } from "@/components/async-block";
import { Stat } from "@/components/stat";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { ApiResult, FieldHeatStress } from "@/types/api";

const c = (x: number | null) => (x == null ? "—" : `${x.toLocaleString("es-AR", { maximumFractionDigits: 0 })} °C`);
const LEVEL = { bajo: "Bajo", medio: "Medio", alto: "Alto" } as const;

/** Calor y estrés de la zona con ECOSTRESS (temperatura de la superficie y estrés evaporativo, 70 m). */
export function HeatStressCard({ fieldId, compact = false }: { fieldId: string; compact?: boolean }) {
  const s = useAsync<ApiResult<FieldHeatStress>>((signal) => api.fieldHeatStress(fieldId, { signal }), [fieldId]);
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Calor y estrés de la zona (ECOSTRESS)</CardTitle>
        <CardDescription>Temperatura de la superficie (no del aire) y estrés hídrico de la vegetación, medidos desde la Estación Espacial con píxeles de 70 m.</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncBlock state={s} what="los datos de ECOSTRESS">
          {(r) => {
            const d = r.data;
            return (
              <div className="space-y-4">
                <p className="text-lg">{d.reading}</p>
                <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>
                  <Stat label="Superficie en verano (media)" value={c(d.lst_summer_mean_c)} hint="Diciembre a febrero, en las pasadas del satélite" />
                  <Stat label="Superficie más caliente" value={c(d.lst_max_c)} hint={d.hot_surface_obs != null ? `${d.hot_surface_obs} pasadas con más de 45 °C` : undefined} />
                  {!compact && <Stat label="Estrés evaporativo (ESI)" value={d.esi_recent == null ? "—" : d.esi_recent.toLocaleString("es-AR")} hint={d.esi_normal != null ? `Lo normal: ${d.esi_normal.toLocaleString("es-AR")} · 1 = sin estrés` : "1 = sin estrés, 0 = mucho estrés"} />}
                  <Stat label="Estrés de la vegetación" value={d.stress_level ? LEVEL[d.stress_level] : "—"} hint="Últimos 3 meses" />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {d.lst && <span>Temperatura: <Badge variant="cultivo">{d.lst.label}</Badge> {d.lst.observations} pasadas</span>}
                  {d.esi && <span>Estrés: <Badge variant="agua">{d.esi.label}</Badge> {d.esi.observations} pasadas</span>}
                  <Badge variant={r.demo || d.lst?.origin === "sample" ? "alerta" : "outline"}>{r.demo ? "DATOS DE EJEMPLO" : (d.lst ?? d.esi)?.origin_label}</Badge>
                  <span>Fuente: NASA ECOSTRESS · {d.period}</span>
                </div>
                {!compact && (
                  <details className="text-sm"><summary className="cursor-pointer font-medium">Limitaciones</summary>
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
