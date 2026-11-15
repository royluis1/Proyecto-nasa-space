"use client";

import { AsyncBlock } from "@/components/async-block";
import { AlertList } from "@/components/alerts/alert-list";
import { ForecastTable } from "@/components/alerts/forecast-table";
import { useCampo } from "@/components/campo/campo-provider";
import { TodaySatellite } from "@/components/map/today-satellite";
import { HeatStressCard } from "@/components/satellite/heat-stress-card";
import { PageHeader } from "@/components/page-header";
import { PageNotes } from "@/components/layout/page-notes";
import { WeatherAnimation } from "@/components/map/weather-animation-loader";
import { LocalityLine } from "@/components/field/locality-line";
import { Disclosure } from "@/components/ui/disclosure";
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
import { tr } from "@/lib/i18n";

function Big({ icon, title, value, children }: { icon: string; title: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <article className="rounded-[1.25rem] border bg-card p-5">
      <p className="flex items-center gap-2 text-lg font-semibold"><span aria-hidden className="text-3xl">{icon}</span> {title}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
      <div className="mt-2 space-y-1 text-muted-foreground">{children}</div>
    </article>
  );
}

const monthList = (ms: number[]) => (ms.length ? ms.map((m) => MONTHS_LONG[m - 1]).join(", ") : tr("ninguno", "none"));

function Panel({ r }: { r: ApiResult<HuertaPanel> }) {
  const { field } = useCampo();
  const h = r.data;
  const month = new Date().getMonth() + 1;
  const frostNow = h.frost.frost_months.includes(month);
  const future = h.forecast ? h.forecast.days.reduce((a, d) => a + (d.precip_mm ?? 0), 0) : null;
  return (
    <div className="space-y-8">
      <section aria-labelledby="semana" className="space-y-3">
        <h2 id="semana" className="text-2xl font-bold">{tr("Esta época, en tu huerta", "This time of year, in your garden")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Big icon="💧" title={tr("Cuánto regar", "How much to water")} value={<>{num(h.irrigation.weekly_l_per_m2)} L/m² <span className="text-lg font-semibold">{tr("por semana", "per week")}</span></>}>
            <p>{tr(`Unos ${num(h.irrigation.daily_l_per_m2, 1)} litros por m² por día, en 2 o 3 riegos.`, `About ${num(h.irrigation.daily_l_per_m2, 1)} liters per m² per day, in 2 or 3 waterings.`)}</p>
            {h.irrigation.with_forecast_l_per_m2 != null && <p><strong className="text-foreground">{tr("Esta semana, con el pronóstico:", "This week, with the forecast:")} {num(h.irrigation.with_forecast_l_per_m2)} L/m².</strong></p>}
          </Big>
          <Big icon="❄️" title={tr("Heladas", "Frost")} value={frostNow ? tr("Suele helar", "Frost is common") : tr("No suele helar", "Frost is rare")}>
            <p>{tr("Meses con heladas", "Months with frost")}: {monthList(h.frost.frost_months)}.</p>
            {h.frost.last_frost_typical && <p>{tr("Última helada típica", "Typical last frost")}: <strong className="text-foreground">{h.frost.last_frost_typical}</strong>. {tr("Primera", "First")}: {h.frost.first_frost_typical ?? "—"}.</p>}
          </Big>
          <Big icon="🌧️" title={tr("Lluvia", "Rain")} value={h.past_rain?.total_mm != null ? `${num(h.past_rain.total_mm)} mm` : tr("Sin dato", "No data")}>
            <p>{tr(`En los últimos ${h.past_rain?.days ?? 30} días`, `In the last ${h.past_rain?.days ?? 30} days`)}{h.past_rain?.pct_of_normal != null ? tr(`: el ${num(h.past_rain.pct_of_normal)} % de lo normal`, `: ${num(h.past_rain.pct_of_normal)} % of normal`) : ""}.</p>
            <p>{tr(`Próximos ${h.forecast?.days.length ?? 10} días`, `Next ${h.forecast?.days.length ?? 10} days`)}: <strong className="text-foreground">{future == null ? tr("sin pronóstico", "no forecast") : `${num(future)} mm`}</strong>.</p>
          </Big>
          <Big icon="🔥" title={tr("Calor fuerte", "Strong heat")} value={tr(`${num(h.heat.hot_days_per_year)} días/año`, `${num(h.heat.hot_days_per_year)} days/yr`)}>
            <p>{tr("Con más de 35 °C. Meses", "Above 35 °C. Months")}: {monthList(h.heat.hot_months)}.</p>
            {h.forecast && <p>{tr("En el pronóstico", "In the forecast")}: <strong className="text-foreground">{h.heat.next_hot_days} {h.heat.next_hot_days === 1 ? tr("día", "day") : tr("días", "days")}</strong>.</p>}
          </Big>
        </div>
        <p className="text-sm text-muted-foreground">{h.irrigation.basis}</p>
      </section>

      <Card>
        <CardHeader><CardTitle as="h2">{tr("Alertas de los próximos días", "Alerts for the coming days")}</CardTitle><CardDescription>{tr("Qué viene y qué hacer.", "What's coming and what to do.")}</CardDescription></CardHeader>
        <CardContent><AlertList alerts={h.alerts} empty={tr("No hay alertas para los próximos días.", "No alerts for the coming days.")} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">{tr("Consejos para esta época", "Tips for this time of year")}</CardTitle></CardHeader>
        <CardContent><ul className="list-disc space-y-2 pl-5 text-lg">{h.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle as="h2">{tr("El tiempo de los próximos días", "Weather for the coming days")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {h.forecast ? (
            <>
              <ForecastTable forecast={h.forecast} />
              <SourceLine source={h.forecast.source} />
            </>
          ) : (
            <Notice tone="info" title={tr("Pronóstico no disponible", "Forecast not available")}><p>{tr("No pudimos consultar el pronóstico ahora. Probá de nuevo en un rato.", "We couldn't get the forecast right now. Try again in a while.")}</p></Notice>
          )}
        </CardContent>
      </Card>

      <Disclosure variant="card" label={tr("Ver el mapa de lluvia de la NASA (animado)", "See NASA's rain map (animated)")}>
        <WeatherAnimation lat={h.latitude} lon={h.longitude} />
      </Disclosure>

      <Disclosure variant="card" label={tr("Ver más sobre mi zona: verdor, calor e imagen satelital", "More about my area: greenness, heat and satellite image")} contentClassName="space-y-6">
        {h.vegetation && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{tr("Verdor de la zona", "Greenness in the area")}</h3>
            <p>{h.vegetation.text}</p>
            <SourceLine source={h.vegetation.source} demo={r.demo} />
          </div>
        )}
        {field && <HeatStressCard fieldId={field.id} compact />}
        {field && <TodaySatellite field={field} title={tr("Tu zona hoy, vista desde el espacio", "Your area today, seen from space")} />}
      </Disclosure>

      <PageNotes>
        <WarningsList warnings={friendlyWarnings(r.meta.warnings)} />
        <p>{tr("Los datos describen tu zona, no exactamente tu huerta. Son una ayuda para planificar: mirá también tu tierra y tus plantas.", "The data describes your area, not exactly your garden. It helps you plan: also look at your soil and plants.")}</p>
        <Disclosure label={tr("De dónde salen los datos", "Where the data comes from")} contentClassName="space-y-4">
          {h.sources.map((s) => <SourceLine key={s.name} source={s} demo={r.demo && s.is_nasa} />)}
          <SourceMap profile="huerta" />
        </Disclosure>
      </PageNotes>
    </div>
  );
}

export default function HuertaPage() {
  const { fieldId, field } = useCampo();
  const state = useAsync<ApiResult<HuertaPanel>>((signal) => api.huerta(fieldId, { signal }), [fieldId]);
  return (
    <div className="space-y-6">
      <PageHeader title={tr("Mi huerta", "My garden")} description={tr("Cuánto regar, cuándo hiela y qué tiempo viene.", "How much to water, when it freezes and what weather is coming.")}>
        {field && <LocalityLine lat={field.location.lat} lon={field.location.lon} className="text-lg" />}
      </PageHeader>
      <AsyncBlock state={state} what={tr("los datos de tu huerta", "your garden data")}>{(r) => <Panel r={r} />}</AsyncBlock>
    </div>
  );
}
