"use client";

import { CloudSun, Leaf, Mountain, Satellite, Thermometer } from "lucide-react";
import { useMemo } from "react";
import { useCampo } from "@/components/campo/campo-provider";
import { AsyncBlock } from "@/components/async-block";
import {
  AnnualRainChart, CampaignsChart, DroughtHistoryChart, HeatChart, MonthlyClimateChart, NdviClimatologyChart, SoilMoistureAnomalyChart, SoilMoistureClimatologyChart,
} from "@/components/charts/diagnostic-charts";
import { TodaySatellite } from "@/components/map/today-satellite";
import { HeatStressCard } from "@/components/satellite/heat-stress-card";
import { SectorsCard } from "@/components/satellite/sectors-card";
import { PageHeader } from "@/components/page-header";
import { SoilMoistureIndicator } from "@/components/zones/soil-moisture-indicator";
import { LabelBadge, OriginBadge, RiskLevelBadge } from "@/components/provenance/badges";
import { TraceInfo } from "@/components/provenance/trace-info";
import { SourceLine } from "@/components/provenance/source-line";
import { WarningsList } from "@/components/provenance/warnings";
import { PageNotes } from "@/components/layout/page-notes";
import { Disclosure } from "@/components/ui/disclosure";
import { Stat } from "@/components/stat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { MONTHS_LONG, num, pct, signed } from "@/lib/format";
import type { ApiResult, ClimateSummary, SoilMoistureSummary, TerrainSummary, VegetationSummary } from "@/types/api";
import { L, localize, tr } from "@/lib/i18n";

const ZONES: Record<string, string> = localize({ arido: L("árida", "arid"), semiarido: L("semiárida", "semi-arid"), subhumedo_seco: L("subhúmeda seca", "dry sub-humid"), humedo: L("húmeda", "humid") });

function ClimateSection({ r }: { r: ApiResult<ClimateSummary> }) {
  const c = r.data;
  const wd = c.water_deficit;
  const trend = c.trends.precipitation;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <OriginBadge status={r.demo ? "demo" : c.source.origin} label={r.demo ? undefined : c.source.origin_label} />
        <LabelBadge label="modelado" />
      </div>
      <p className="text-lg">
        {tr(
          <>Llueven <strong>{num(wd.mean_annual_precip_mm)} mm por año</strong> y la atmósfera pide <strong>{num(wd.mean_annual_et0_mm)} mm</strong>: faltan <strong>{num(wd.mean_annual_deficit_mm)} mm por año</strong>.</>,
          <>It rains <strong>{num(wd.mean_annual_precip_mm)} mm per year</strong> and the atmosphere demands <strong>{num(wd.mean_annual_et0_mm)} mm</strong>: <strong>{num(wd.mean_annual_deficit_mm)} mm per year</strong> is missing.</>,
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={tr("Lluvia anual media", "Mean annual rain")} value={`${num(wd.mean_annual_precip_mm)} mm`} hint={tr(`Varía ${num(c.variability.annual_precip_cv_pct)} % entre años`, `Varies ${num(c.variability.annual_precip_cv_pct)} % between years`)} />
        <Stat label={tr("Demanda de agua (ET₀)", "Water demand (ET₀)")} value={`${num(wd.mean_annual_et0_mm)} mm`} />
        <Stat label={tr("Días con más de 35 °C", "Days above 35 °C")} value={tr(`${num(c.heat.mean_days_per_year)} por año`, `${num(c.heat.mean_days_per_year)} per year`)} />
        <Stat label={tr("Tendencia de la lluvia", "Rainfall trend")} value={trend.slope_per_decade == null ? "—" : `${signed(trend.slope_per_decade)} ${tr("mm/década", "mm/decade")}`} hint={trend.slope_per_decade != null && !trend.significant ? tr("No significativa", "Not significant") : undefined} />
      </div>
      <DroughtHistoryChart climate={c} />
      <Disclosure label={tr("Ver gráficos y detalle del clima", "See weather charts and details")} contentClassName="space-y-6">
      <SourceLine
        source={{
          name: c.source.provider, is_nasa: true, kind: "modelado", retrieved_at: c.source.retrieved_at, origin: c.source.origin,
          origin_label: c.source.origin_label, detail: c.source.sample_site ? tr(`Archivo o sitio usado: ${c.source.sample_site}`, `File or site used: ${c.source.sample_site}`) : null,
        }}
        demo={r.demo}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <MonthlyClimateChart climate={c} />
        <AnnualRainChart climate={c} />
      </div>
      <HeatChart climate={c} />
      <p className="text-sm text-muted-foreground">
        {c.precipitation.dry_years.length > 0 && <>{tr("Años secos del período", "Dry years in the period")}: {c.precipitation.dry_years.join(", ")}. </>}
        {c.precipitation.wet_years.length > 0 && <>{tr("Años húmedos", "Wet years")}: {c.precipitation.wet_years.join(", ")}. </>}
        {tr("Se comparan con el promedio de este período, no con una normal oficial.", "They are compared with this period's average, not an official normal.")}
      </p>
      <details className="rounded-lg border bg-muted/40 p-4 text-sm">
        <summary className="cursor-pointer font-medium">{tr("Limitaciones de este dato", "Limitations of this data")}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {c.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
      <p className="text-sm text-muted-foreground">
        {tr("ET₀ calculada con FAO-56.", "ET₀ calculated with FAO-56.")} {c.heat.heat_stress_years.length ? tr(`Años de más calor: ${c.heat.heat_stress_years.join(", ")}.`, `Hottest years: ${c.heat.heat_stress_years.join(", ")}.`) : ""}
      </p>
      </Disclosure>
    </div>
  );
}

function SoilMoistureSection({ r }: { r: ApiResult<SoilMoistureSummary> }) {
  const s = r.data;
  const ws = s.water_stress;
  const dry = s.typically_dry_months.map((m) => MONTHS_LONG[m - 1]).join(", ");
  return (
    <div className="space-y-5">
      <p className="text-lg">
        {ws.anomaly_pct == null ? (
          tr("No hay datos suficientes para comparar la humedad reciente con la normal.", "There is not enough data to compare recent moisture with normal.")
        ) : (
          <>
            {tr(
              <>En los últimos días ({ws.window_start} a {ws.window_end}) la humedad del suelo estuvo <strong>{num(Math.abs(ws.anomaly_pct), 1)} % {ws.anomaly_pct < 0 ? "por debajo" : "por encima"} de lo normal</strong> para esa época.</>,
              <>In recent days ({ws.window_start} to {ws.window_end}) soil moisture was <strong>{num(Math.abs(ws.anomaly_pct), 1)} % {ws.anomaly_pct < 0 ? "below" : "above"} normal</strong> for that time of year.</>,
            )}
          </>
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={tr("Estrés hídrico", "Water stress")} value={ws.level ? <RiskLevelBadge level={ws.level} prefix={tr("Estrés", "Stress")} /> : "—"} />
        <Stat label={tr("Frecuencia de sequías", "Drought frequency")} value={pct(s.drought_frequency_pct, 1)} />
        <Stat label={tr("Meses más secos", "Driest months")} value={<span className="text-lg">{dry || "—"}</span>} />
        <Stat label={tr("Tendencia", "Trend")} value={s.trend.slope_per_decade == null ? "—" : `${signed(s.trend.slope_per_decade, 3)} ${tr("/década", "/decade")}`} hint={s.trend.slope_per_decade != null && !s.trend.significant ? tr("No significativa", "Not significant") : undefined} />
      </div>
      <Disclosure label={tr("Ver gráficos y detalle de la humedad", "See moisture charts and details")} contentClassName="space-y-6">
      <TraceInfo trace={s.trace} quality={s.quality} demo={r.demo} />
      <p className="text-sm text-muted-foreground">
        {tr(`Humedad media ${num(s.mean, 3)} m³/m³ (depende del suelo: mirá la variación, no el valor).`, `Mean moisture ${num(s.mean, 3)} m³/m³ (it depends on the soil: look at the variation, not the value).`)}
        {ws.percentile != null && <> {tr(`Lo reciente fue más húmedo que el ${num(ws.percentile)} % de los años anteriores.`, `Recent conditions were wetter than ${num(ws.percentile)} % of previous years.`)}</>}
        {ws.stress_index != null && <> {tr(`Índice de estrés ${num(ws.stress_index, 2)} (0 = sin estrés, 1 = lo más seco del registro).`, `Stress index ${num(ws.stress_index, 2)} (0 = no stress, 1 = driest on record).`)}</>}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <SoilMoistureClimatologyChart sm={s} />
        <SoilMoistureAnomalyChart sm={s} />
      </div>
      {s.drought_events.length > 0 && (
        <details className="rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-medium">{tr("Episodios de sequía de humedad de suelo", "Soil-moisture drought episodes")} ({s.drought_events.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {s.drought_events.map((e) => (
              <li key={e.start}>{tr(`${e.start} a ${e.end}: ${e.months} ${e.months === 1 ? "mes" : "meses"} (anomalía más fuerte: ${num(e.min_anomaly_z, 1)})`, `${e.start} to ${e.end}: ${e.months} ${e.months === 1 ? "month" : "months"} (strongest anomaly: ${num(e.min_anomaly_z, 1)})`)}</li>
            ))}
          </ul>
        </details>
      )}
      </Disclosure>
    </div>
  );
}

function VegetationSection({ r }: { r: ApiResult<VegetationSummary> }) {
  const v = r.data;
  const longest = v.fallow_periods.reduce((m, p) => Math.max(m, p.days), 0);
  return (
    <div className="space-y-5">
      <p className="text-lg">
        {tr(
          <>El suelo estuvo casi desnudo el <strong>{pct((v.recent_bare_soil_fraction ?? v.bare_soil_fraction ?? 0) * 100)}</strong> del tiempo en las últimas campañas.</>,
          <>The soil was almost bare <strong>{pct((v.recent_bare_soil_fraction ?? v.bare_soil_fraction ?? 0) * 100)}</strong> of the time in recent seasons.</>,
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={tr("Verdor promedio (NDVI)", "Average greenness (NDVI)")} value={num(v.mean_ndvi, 2)} hint={tr("0 = suelo desnudo · 1 = muy verde", "0 = bare soil · 1 = very green")} />
        <Stat label={tr("Cobertura vegetal", "Plant cover")} value={pct((v.cover_fraction_mean ?? 0) * 100)} />
        <Stat label={tr("Barbechos", "Fallows")} value={num(v.fallow_periods.length)} hint={longest ? tr(`El más largo: ${num(longest)} días`, `Longest: ${num(longest)} days`) : undefined} />
        <Stat label={tr("Mejor campaña", "Best season")} value={v.best_campaign ?? "—"} hint={v.worst_campaign ? tr(`Peor: ${v.worst_campaign}`, `Worst: ${v.worst_campaign}`) : undefined} />
      </div>
      <Disclosure label={tr("Ver gráficos y detalle de la vegetación", "See vegetation charts and details")} contentClassName="space-y-6">
      <TraceInfo trace={v.trace} quality={v.quality} demo={r.demo} />
      {v.biomass_trend_pct_per_decade != null && (
        <p className="text-sm text-muted-foreground">
          {tr(
            `La biomasa ${v.biomass_trend_pct_per_decade < 0 ? "bajó" : "subió"} ${num(Math.abs(v.biomass_trend_pct_per_decade))} % por década${v.biomass_trend.significant ? " (tendencia significativa)." : " (no significativa)."}`,
            `Biomass ${v.biomass_trend_pct_per_decade < 0 ? "fell" : "rose"} ${num(Math.abs(v.biomass_trend_pct_per_decade))} % per decade${v.biomass_trend.significant ? " (significant trend)." : " (not significant)."}`,
          )}{" "}
          {tr("Cobertura estimada con", "Cover estimated with")}: {v.cover_method}.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <NdviClimatologyChart v={v} />
        <CampaignsChart v={v} />
      </div>
      {v.fallow_periods.length > 0 && (
        <details className="rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-medium">{tr("Períodos de barbecho detectados", "Fallow periods detected")} ({v.fallow_periods.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {v.fallow_periods.map((p) => (
              <li key={p.start}>{tr(`${p.start} a ${p.end}: ${p.days} días, NDVI medio ${num(p.mean_ndvi, 2)}`, `${p.start} to ${p.end}: ${p.days} days, mean NDVI ${num(p.mean_ndvi, 2)}`)}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-sm text-muted-foreground">{tr("El NDVI muestra verdor, no materia orgánica: la salud del suelo que se infiere es indirecta.", "NDVI shows greenness, not organic matter: any soil health inferred from it is indirect.")}</p>
      </Disclosure>
    </div>
  );
}

const SLOPE_WORD: Record<TerrainSummary["slope_class"], string> = localize({ plano: L("Plano", "Flat"), suave: L("Suave", "Gentle"), moderada: L("Moderada", "Moderate"), fuerte: L("Fuerte", "Steep") });

function TerrainSection({ r }: { r: ApiResult<TerrainSummary> }) {
  const t = r.data;
  return (
    <div className="space-y-5">
      <p className="text-lg">{t.interpretation}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={tr("Pendiente media", "Mean slope")} value={`${num(t.slope_mean_pct, 1)} %`} hint={tr(`Relieve ${SLOPE_WORD[t.slope_class].toLowerCase()}`, `${SLOPE_WORD[t.slope_class]} terrain`)} />
        <Stat label={tr("Zonas más inclinadas", "Steepest areas")} value={`${num(t.slope_p90_pct, 1)} %`} />
        <Stat label={tr("Altura media", "Mean elevation")} value={`${num(t.elevation_mean_m)} m`} />
        <Stat label={tr("Desnivel", "Elevation range")} value={`${num(t.elevation_max_m - t.elevation_min_m)} m`} />
      </div>
      <Disclosure label={tr("Ver detalle del relieve", "See terrain details")} contentClassName="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <OriginBadge status={r.demo ? "demo" : t.origin} label={r.demo ? undefined : t.origin_label} />
        <span className="text-sm text-muted-foreground">{t.product} · {tr("baldosa", "tile")} {t.tile} · {t.area} · {tr("píxel de", "pixel of")} ~{num(t.resolution_m)} m</span>
      </div>
      <p className="text-sm">
        {tr(
          `El 10 % del lote supera ${num(t.slope_p90_pct, 1)} % de pendiente (máxima ${num(t.slope_max_pct, 1)} %). Altura de ${num(t.elevation_min_m)} a ${num(t.elevation_max_m)} m. La pendiente entra en el puntaje de suelo: con más pendiente, el suelo desnudo pierde más por el agua.`,
          `10 % of the plot exceeds ${num(t.slope_p90_pct, 1)} % slope (max ${num(t.slope_max_pct, 1)} %). Elevation from ${num(t.elevation_min_m)} to ${num(t.elevation_max_m)} m. Slope enters the soil score: the steeper it is, the more bare soil is lost to water.`,
        )}
      </p>
      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-medium">{tr("Limitaciones de SRTM", "SRTM limitations")}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">{t.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
      </details>
      </Disclosure>
    </div>
  );
}

export default function DiagnosticoPage() {
  const { fieldId, field, compare } = useCampo();
  const period = useMemo(() => {
    const y = new Date().getFullYear();
    return { start_date: `${y - 10}-01-01`, end_date: `${y - 1}-12-31` };
  }, []);
  const climate = useAsync<ApiResult<ClimateSummary>>((signal) => api.climate({ field_id: fieldId, ...period, include_daily: false }, { signal }), [fieldId]);
  const soil = useAsync<ApiResult<SoilMoistureSummary>>((signal) => api.soilMoisture({ field_id: fieldId }, { signal }), [fieldId]);
  const veg = useAsync<ApiResult<VegetationSummary>>((signal) => api.vegetation({ field_id: fieldId }, { signal }), [fieldId]);
  const terrain = useAsync<ApiResult<TerrainSummary>>((signal) => api.terrain({ field_id: fieldId }, { signal }), [fieldId]);
  const zone = compare.result?.inputs.climate;
  const warnings = [...new Set([climate, soil, veg, terrain].flatMap((x) => x.data?.meta.warnings ?? []))];

  return (
    <div className="space-y-8">
      <PageHeader title={tr("Diagnóstico", "Diagnosis")} description={tr(`Lo que dicen los datos de la NASA sobre la zona de ${field?.name ?? "tu campo"}.`, `What NASA data says about the area of ${field?.name ?? "your field"}.`)} />
      {zone && (
        <Card className="border-agua-500/50 bg-agua-50 dark:bg-agua-900/30">
          <CardContent className="flex flex-wrap items-center gap-3 py-4 text-lg">
            <Thermometer aria-hidden className="size-6 shrink-0" />
            <p>
              {tr("Tu zona es", "Your area is")} <strong>{ZONES[zone.zone] ?? zone.zone}</strong> ({tr("índice de aridez", "aridity index")} {num(zone.aridity_index, 2)}).
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><CloudSun aria-hidden className="size-6 text-agua-600" /> {tr("Clima (NASA POWER)", "Weather (NASA POWER)")}</CardTitle>
          <CardDescription>{tr("Últimos 10 años · dato regional (~50 km)", "Last 10 years · regional data (~50 km)")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={climate} what={tr("el clima", "the weather")}>{(r) => <ClimateSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><Satellite aria-hidden className="size-6 text-agua-600" /> {tr("Humedad del suelo (NASA SMAP)", "Soil moisture (NASA SMAP)")}</CardTitle>
          <CardDescription>{tr("Agua en la zona de raíces · contexto regional (9 km)", "Water in the root zone · regional context (9 km)")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SoilMoistureIndicator fieldId={fieldId} />
          <h3 className="mt-6 text-lg font-semibold">{tr("Historia de la zona", "History of the area")}</h3>
          <AsyncBlock state={soil} what={tr("la humedad del suelo", "the soil moisture")}>{(r) => <SoilMoistureSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><Leaf aria-hidden className="size-6 text-cultivo-600" /> {tr("Vegetación (NASA MODIS NDVI)", "Vegetation (NASA MODIS NDVI)")}</CardTitle>
          <CardDescription>{tr("Verdor de cada campaña · 250 m", "Greenness each season · 250 m")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={veg} what={tr("la vegetación", "the vegetation")}>{(r) => <VegetationSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><Mountain aria-hidden className="size-6 text-tierra-600" /> {tr("Relieve (NASA SRTM)", "Terrain (NASA SRTM)")}</CardTitle>
          <CardDescription>{tr("Altura y pendiente del lote · 30 m", "Plot elevation and slope · 30 m")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={terrain} what={tr("el relieve", "the terrain")}>{(r) => <TerrainSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>
      <SectorsCard fieldId={fieldId} />
      <Disclosure variant="card" label={tr("Más análisis: calor de la superficie e imagen satelital de hoy", "More analysis: surface heat and today's satellite image")} contentClassName="space-y-6">
        <HeatStressCard fieldId={fieldId} />
        {field && <TodaySatellite field={field} />}
      </Disclosure>
      <PageNotes>
        <p>{tr("Estos datos describen la zona. Para decidir, combinalos con lo que sabés de tu lote y consultá a un ingeniero agrónomo.", "This data describes the area. To decide, combine it with what you know about your plot and consult an agronomist.")}</p>
        {warnings.length > 0 && <WarningsList warnings={warnings} />}
      </PageNotes>
    </div>
  );
}
