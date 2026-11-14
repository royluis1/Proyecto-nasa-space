"use client";

import { AsyncBlock } from "@/components/async-block";
import { AlertList } from "@/components/alerts/alert-list";
import { ForecastTable } from "@/components/alerts/forecast-table";
import { useCampo } from "@/components/campo/campo-provider";
import { PageHeader } from "@/components/page-header";
import { SourceLine } from "@/components/provenance/source-line";
import { WarningsList } from "@/components/provenance/warnings";
import { Stat } from "@/components/stat";
import { SourceMap } from "@/components/sources/source-map";
import { Alert as Notice } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { num } from "@/lib/format";
import { friendlyWarnings } from "@/lib/plain";
import { useProfile } from "@/hooks/use-profile";
import type { AlertsResult, ApiResult } from "@/types/api";

function Content({ r }: { r: ApiResult<AlertsResult> }) {
  const a = r.data;
  const p = a.past_rain;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Alertas activas" value={a.alerts.length} hint={a.alerts.filter((x) => x.severity === "alta").length ? `${a.alerts.filter((x) => x.severity === "alta").length} importantes` : "Ninguna grave"} />
        <Stat label={`Lluvia de los últimos ${p?.days ?? 30} días`} value={p?.total_mm != null ? `${num(p.total_mm)} mm` : "Sin dato"} hint={p?.pct_of_normal != null ? `${num(p.pct_of_normal)} % de lo normal (${num(p.normal_mm)} mm)` : "NASA POWER"} />
        <Stat label="Lluvia pronosticada" value={a.future_rain_mm != null ? `${num(a.future_rain_mm)} mm` : "Sin pronóstico"} hint={a.forecast ? `Próximos ${a.forecast.days.length} días (Open-Meteo)` : undefined} />
      </div>
      <Card>
        <CardHeader><CardTitle as="h2">Alertas</CardTitle><CardDescription>Ordenadas por gravedad. Cada una dice qué hacer y de dónde sale.</CardDescription></CardHeader>
        <CardContent><AlertList alerts={a.alerts} empty="No hay alertas para los próximos días." /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle as="h2">Pronóstico</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {a.forecast ? <><ForecastTable forecast={a.forecast} /><SourceLine source={a.forecast.source} /></> : (
            <Notice tone="info" title="Pronóstico no disponible"><p>Las alertas de esta pantalla salen solo de la lluvia reciente y de la humedad del suelo.</p></Notice>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle as="h2">De dónde salen los datos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {a.sources.map((s) => <SourceLine key={s.name} source={s} demo={r.demo && s.is_nasa} />)}
          {p && <p className="text-sm text-muted-foreground">{p.source.detail}</p>}
          <SourceMap profile={a.profile} />
        </CardContent>
      </Card>
      <WarningsList warnings={friendlyWarnings(r.meta.warnings)} />
    </div>
  );
}

export default function AlertasPage() {
  const { fieldId } = useCampo();
  const profile = useProfile() ?? "agricultor";
  const state = useAsync<ApiResult<AlertsResult>>((signal) => api.alerts(fieldId, profile, { signal }), [fieldId, profile]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Diagnóstico y alerta temprana"
        description="Heladas, calor fuerte, lluvias intensas, viento y falta de agua de los próximos días, con la lluvia reciente y la humedad del suelo."
      />
      <AsyncBlock state={state} what="las alertas">{(r) => <Content r={r} />}</AsyncBlock>
    </div>
  );
}
