"use client";

import { AsyncBlock } from "@/components/async-block";
import { AlertList } from "@/components/alerts/alert-list";
import { ForecastTable } from "@/components/alerts/forecast-table";
import { useCampo } from "@/components/campo/campo-provider";
import { TodaySatellite } from "@/components/map/today-satellite";
import { HeatStressCard } from "@/components/satellite/heat-stress-card";
import { PageHeader } from "@/components/page-header";
import { SourceLine } from "@/components/provenance/source-line";
import { WarningsList } from "@/components/provenance/warnings";
import { SourceMap } from "@/components/sources/source-map";
import { Alert as Notice } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { MONTHS_LONG, num } from "@/lib/format";
import { friendlyWarnings } from "@/lib/plain";
import type { ApiResult, HuertaPanel } from "@/types/api";

function Big({ icon, title, value, children }: { icon: string; title: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <article className="rounded-[1.25rem] border bg-card p-5">
      <p className="flex items-center gap-2 text-lg font-semibold"><span aria-hidden className="text-3xl">{icon}</span> {title}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
      <div className="mt-2 space-y-1 text-muted-foreground">{children}</div>
    </article>
  );
}

const monthList = (ms: number[]) => (ms.length ? ms.map((m) => MONTHS_LONG[m - 1]).join(", ") : "ninguno");

function Panel({ r }: { r: ApiResult<HuertaPanel> }) {
  const { field } = useCampo();
  const h = r.data;
  const month = new Date().getMonth() + 1;
  const frostNow = h.frost.frost_months.includes(month);
  const future = h.forecast ? h.forecast.days.reduce((a, d) => a + (d.precip_mm ?? 0), 0) : null;
  return (
    <div className="space-y-8">
      <section aria-labelledby="semana" className="space-y-3">
        <h2 id="semana" className="text-2xl font-bold">Esta época, en tu huerta</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Big icon="💧" title="Cuánto regar" value={<>{num(h.irrigation.weekly_l_per_m2)} L/m² <span className="text-lg font-semibold">por semana</span></>}>
            <p>Unos {num(h.irrigation.daily_l_per_m2, 1)} litros por m² por día, en 2 o 3 riegos.</p>
            {h.irrigation.with_forecast_l_per_m2 != null && <p><strong className="text-foreground">Esta semana, con el pronóstico: {num(h.irrigation.with_forecast_l_per_m2)} L/m².</strong></p>}
          </Big>
          <Big icon="❄️" title="Heladas" value={frostNow ? "Suele helar" : "No suele helar"}>
            <p>Meses con heladas: {monthList(h.frost.frost_months)}.</p>
            {h.frost.last_frost_typical && <p>Última helada típica: <strong className="text-foreground">{h.frost.last_frost_typical}</strong>. Primera: {h.frost.first_frost_typical ?? "—"}.</p>}
          </Big>
          <Big icon="🌧️" title="Lluvia" value={h.past_rain?.total_mm != null ? `${num(h.past_rain.total_mm)} mm` : "Sin dato"}>
            <p>En los últimos {h.past_rain?.days ?? 30} días{h.past_rain?.pct_of_normal != null ? `: el ${num(h.past_rain.pct_of_normal)} % de lo normal` : ""}.</p>
            <p>Próximos {h.forecast?.days.length ?? 10} días: <strong className="text-foreground">{future == null ? "sin pronóstico" : `${num(future)} mm`}</strong>.</p>
          </Big>
          <Big icon="🔥" title="Calor fuerte" value={`${num(h.heat.hot_days_per_year)} días/año`}>
            <p>Con más de 35 °C. Meses: {monthList(h.heat.hot_months)}.</p>
            {h.forecast && <p>En el pronóstico: <strong className="text-foreground">{h.heat.next_hot_days} {h.heat.next_hot_days === 1 ? "día" : "días"}</strong>.</p>}
          </Big>
        </div>
        <p className="text-sm text-muted-foreground">{h.irrigation.basis}</p>
      </section>

      <Card>
        <CardHeader><CardTitle as="h2">Alertas de los próximos días</CardTitle><CardDescription>Qué viene y qué hacer.</CardDescription></CardHeader>
        <CardContent><AlertList alerts={h.alerts} empty="No hay alertas para los próximos días." /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">Pronóstico</CardTitle><CardDescription>Lluvia y temperaturas de los próximos días.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {h.forecast ? (
            <>
              <ForecastTable forecast={h.forecast} />
              <SourceLine source={h.forecast.source} />
            </>
          ) : (
            <Notice tone="info" title="Pronóstico no disponible"><p>No pudimos consultar el pronóstico ahora. Probá de nuevo en un rato.</p></Notice>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle as="h2">Consejos para esta época</CardTitle></CardHeader>
          <CardContent><ul className="list-disc space-y-2 pl-5">{h.tips.map((t) => <li key={t}>{t}</li>)}</ul></CardContent>
        </Card>
        {h.vegetation && (
          <Card>
            <CardHeader><CardTitle as="h2">Verdor de la zona</CardTitle></CardHeader>
            <CardContent className="space-y-3"><p>{h.vegetation.text}</p><SourceLine source={h.vegetation.source} demo={r.demo} /></CardContent>
          </Card>
        )}
      </div>

      {field && <HeatStressCard fieldId={field.id} compact />}
      {field && <TodaySatellite field={field} title="Tu zona hoy, vista desde el espacio" />}

      <Card>
        <CardHeader><CardTitle as="h2">De dónde salen los datos</CardTitle><CardDescription>Fuente, fecha de consulta y tipo de cada dato.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {h.sources.map((s) => <SourceLine key={s.name} source={s} demo={r.demo && s.is_nasa} />)}
          <SourceMap profile="huerta" />
        </CardContent>
      </Card>
      <WarningsList warnings={friendlyWarnings(r.meta.warnings)} />
    </div>
  );
}

export default function HuertaPage() {
  const { fieldId, field } = useCampo();
  const state = useAsync<ApiResult<HuertaPanel>>((signal) => api.huerta(fieldId, { signal }), [fieldId]);
  return (
    <div className="space-y-6">
      <PageHeader title={`Mi huerta${field ? `: ${field.name}` : ""}`} description="Cuánto regar, cuándo hiela, cuánto llovió y qué viene, con datos de la NASA y el pronóstico." />
      <AsyncBlock state={state} what="los datos de tu huerta">{(r) => <Panel r={r} />}</AsyncBlock>
    </div>
  );
}
