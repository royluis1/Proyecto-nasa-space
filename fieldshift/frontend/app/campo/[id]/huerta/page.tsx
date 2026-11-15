"use client";

import { AsyncBlock } from "@/components/async-block";
import { AlertList } from "@/components/alerts/alert-list";
import { ForecastTable } from "@/components/alerts/forecast-table";
import { useCampo } from "@/components/campo/campo-provider";
import { TodaySatellite } from "@/components/map/today-satellite";
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
import type { ApiResult, HuertaPanel, HuertaRotationGuide } from "@/types/api";
import { tr } from "@/lib/i18n";

function RotationCard() {
  const r = useAsync<HuertaRotationGuide>(async (signal) => (await api.huertaRotation({ signal })).data, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{tr("Rotar los canteros por familia", "Rotate beds by family")}</CardTitle>
        <CardDescription>{tr("Para cuidar el suelo y cortar plagas: no repitas la misma familia en el mismo cantero.", "To care for the soil and break pest cycles: do not repeat the same family in the same bed.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AsyncBlock state={r} what={tr("la guía de rotación", "the rotation guide")}>
          {(g) => (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {g.groups.map((grp) => (
                  <div key={grp.group_id} className="rounded-lg border border-border p-3">
                    <p className="font-semibold">{grp.label}</p>
                    <p className="text-sm text-muted-foreground">{grp.crops.join(", ")}</p>
                    <p className="mt-1 text-sm">{grp.note}</p>
                    {grp.return_interval_years != null && (
                      <p className="mt-1 text-xs text-muted-foreground">{tr(`No repetir antes de ${grp.return_interval_years} temporadas.`, `Do not repeat before ${grp.return_interval_years} seasons.`)}</p>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <p className="font-medium">{tr("Reglas simples", "Simple rules")}</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{g.rules.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <p className="text-xs text-muted-foreground">{tr("Fuente", "Source")}: {g.source}</p>
            </div>
          )}
        </AsyncBlock>
      </CardContent>
    </Card>
  );
}

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

const tol = (level: string) =>
  level === "alto" ? tr("alta", "high") : level === "medio" ? tr("media", "medium") : tr("baja", "low");

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
        <CardHeader>
          <CardTitle as="h2">{tr("Qué se puede sembrar este mes", "What can be sown this month")}</CardTitle>
          <CardDescription>{tr("Del catálogo de huerta, cruzando el mes con las heladas y el calor de NASA POWER. No es una recomendación: la decisión es tuya.", "From the garden catalog, crossing the month with NASA POWER frost and heat. It is not a recommendation: the decision is yours.")}</CardDescription>
        </CardHeader>
        <CardContent>
          {h.sowing_now.length === 0 ? (
            <p className="text-muted-foreground">{tr("Ninguna hortaliza del catálogo tiene su época de siembra este mes.", "No vegetable in the catalog has its sowing season this month.")}</p>
          ) : (
            <ul className="space-y-4">
              {h.sowing_now.map((o) => (
                <li key={o.crop_id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">{o.crop_name}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{tr("Heladas", "Frost")}: {tol(o.frost_tolerance)}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{tr("Calor", "Heat")}: {tol(o.heat_tolerance)}</span>
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {o.evidence.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                  {o.cautions.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-0 text-sm font-medium text-amber-700 dark:text-amber-400">
                      {o.cautions.map((c) => <li key={c}>⚠️ {c}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <RotationCard />

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

      {/* Escala huerta: solo imagen de contexto (GIBS). Sin NDVI (MODIS, 250 m) ni calor (ECOSTRESS, 70 m): su resolución no habla de una huerta. */}
      {field && (
        <Disclosure variant="card" label={tr("Ver una imagen satelital de mi zona (contexto)", "See a satellite image of my area (context)")} contentClassName="space-y-6">
          <TodaySatellite field={field} title={tr("Tu zona hoy, vista desde el espacio", "Your area today, seen from space")} />
          <p className="text-sm text-muted-foreground">{tr("Imagen de contexto de la zona (NASA GIBS). No mide tu huerta: es una referencia visual.", "Context image of the area (NASA GIBS). It does not measure your garden: it is a visual reference.")}</p>
        </Disclosure>
      )}

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
