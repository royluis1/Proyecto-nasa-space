"use client";

import { AsyncBlock } from "@/components/async-block";
import { AlertList } from "@/components/alerts/alert-list";
import { ForecastTable } from "@/components/alerts/forecast-table";
import { useCampo } from "@/components/campo/campo-provider";
import { PageHeader } from "@/components/page-header";
import { PageNotes } from "@/components/layout/page-notes";
import { WeatherAnimation } from "@/components/map/weather-animation-loader";
import { Disclosure } from "@/components/ui/disclosure";
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
import { tr } from "@/lib/i18n";

function Content({ r }: { r: ApiResult<AlertsResult> }) {
  const a = r.data;
  const p = a.past_rain;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={tr("Alertas activas", "Active alerts")} value={a.alerts.length} hint={a.alerts.filter((x) => x.severity === "alta").length ? tr(`${a.alerts.filter((x) => x.severity === "alta").length} importantes`, `${a.alerts.filter((x) => x.severity === "alta").length} important`) : tr("Ninguna grave", "None serious")} />
        <Stat label={tr(`Lluvia de los últimos ${p?.days ?? 30} días`, `Rain in the last ${p?.days ?? 30} days`)} value={p?.total_mm != null ? `${num(p.total_mm)} mm` : tr("Sin dato", "No data")} hint={p?.pct_of_normal != null ? tr(`${num(p.pct_of_normal)} % de lo normal (${num(p.normal_mm)} mm)`, `${num(p.pct_of_normal)} % of normal (${num(p.normal_mm)} mm)`) : "NASA POWER"} />
        <Stat label={tr("Lluvia pronosticada", "Forecast rain")} value={a.future_rain_mm != null ? `${num(a.future_rain_mm)} mm` : tr("Sin pronóstico", "No forecast")} hint={a.forecast ? tr(`Próximos ${a.forecast.days.length} días (Open-Meteo)`, `Next ${a.forecast.days.length} days (Open-Meteo)`) : undefined} />
      </div>
      <Card>
        <CardHeader><CardTitle as="h2">{tr("Alertas", "Alerts")}</CardTitle><CardDescription>{tr("De la más grave a la más leve.", "From most to least serious.")}</CardDescription></CardHeader>
        <CardContent><AlertList alerts={a.alerts} empty={tr("No hay alertas para los próximos días.", "No alerts for the coming days.")} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle as="h2">{tr("Pronóstico", "Forecast")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {a.forecast ? <><ForecastTable forecast={a.forecast} /><SourceLine source={a.forecast.source} /></> : (
            <Notice tone="info" title={tr("Pronóstico no disponible", "Forecast not available")}><p>{tr("Las alertas de esta pantalla salen solo de la lluvia reciente y de la humedad del suelo.", "The alerts on this screen come only from recent rain and soil moisture.")}</p></Notice>
          )}
        </CardContent>
      </Card>
      <Disclosure variant="card" label={tr("Ver el mapa de lluvia de la NASA (animado)", "See NASA's rain map (animated)")}>
        <WeatherAnimation lat={a.latitude} lon={a.longitude} />
      </Disclosure>

      <PageNotes>
        <WarningsList warnings={friendlyWarnings(r.meta.warnings)} />
        <Disclosure label={tr("De dónde salen los datos", "Where the data comes from")} contentClassName="space-y-4">
          {a.sources.map((s) => <SourceLine key={s.name} source={s} demo={r.demo && s.is_nasa} />)}
          {p && <p className="text-sm text-muted-foreground">{p.source.detail}</p>}
          <SourceMap profile={a.profile} />
        </Disclosure>
        <p>{tr("Las alertas orientan; ante un evento extremo seguí los avisos oficiales del Servicio Meteorológico Nacional.", "Alerts are guidance; in an extreme event follow the official warnings from Argentina's National Weather Service (SMN).")}</p>
      </PageNotes>
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
        title={tr("Alertas", "Alerts")}
        description={tr("Heladas, calor, tormentas, viento y falta de agua de los próximos días.", "Frost, heat, storms, wind and water shortage in the coming days.")}
      />
      <AsyncBlock state={state} what={tr("las alertas", "the alerts")}>{(r) => <Content r={r} />}</AsyncBlock>
    </div>
  );
}
