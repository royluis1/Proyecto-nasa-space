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

const ZONES: Record<string, string> = { arido: "árida", semiarido: "semiárida", subhumedo_seco: "subhúmeda seca", humedo: "húmeda" };

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
        Llueven <strong>{num(wd.mean_annual_precip_mm)} mm por año</strong> y la atmósfera pide <strong>{num(wd.mean_annual_et0_mm)} mm</strong>: faltan{" "}
        <strong>{num(wd.mean_annual_deficit_mm)} mm por año</strong>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lluvia anual media" value={`${num(wd.mean_annual_precip_mm)} mm`} hint={`Varía ${num(c.variability.annual_precip_cv_pct)} % entre años`} />
        <Stat label="Demanda de agua (ET₀)" value={`${num(wd.mean_annual_et0_mm)} mm`} />
        <Stat label="Días con más de 35 °C" value={`${num(c.heat.mean_days_per_year)} por año`} />
        <Stat label="Tendencia de la lluvia" value={trend.slope_per_decade == null ? "—" : `${signed(trend.slope_per_decade)} mm/década`} hint={trend.slope_per_decade != null && !trend.significant ? "No significativa" : undefined} />
      </div>
      <DroughtHistoryChart climate={c} />
      <Disclosure label="Ver gráficos y detalle del clima" contentClassName="space-y-6">
      <SourceLine
        source={{
          name: c.source.provider, is_nasa: true, kind: "modelado", retrieved_at: c.source.retrieved_at, origin: c.source.origin,
          origin_label: c.source.origin_label, detail: c.source.sample_site ? `Archivo o sitio usado: ${c.source.sample_site}` : null,
        }}
        demo={r.demo}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <MonthlyClimateChart climate={c} />
        <AnnualRainChart climate={c} />
      </div>
      <HeatChart climate={c} />
      <p className="text-sm text-muted-foreground">
        {c.precipitation.dry_years.length > 0 && <>Años secos del período: {c.precipitation.dry_years.join(", ")}. </>}
        {c.precipitation.wet_years.length > 0 && <>Años húmedos: {c.precipitation.wet_years.join(", ")}. </>}
        Se comparan con el promedio de este período, no con una normal oficial.
      </p>
      <details className="rounded-lg border bg-muted/40 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Limitaciones de este dato</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {c.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
      <p className="text-sm text-muted-foreground">
        ET₀ calculada con FAO-56. {c.heat.heat_stress_years.length ? `Años de más calor: ${c.heat.heat_stress_years.join(", ")}.` : ""}
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
          "No hay datos suficientes para comparar la humedad reciente con la normal."
        ) : (
          <>
            En los últimos días ({ws.window_start} a {ws.window_end}) la humedad del suelo estuvo{" "}
            <strong>{num(Math.abs(ws.anomaly_pct), 1)} % {ws.anomaly_pct < 0 ? "por debajo" : "por encima"} de lo normal</strong> para esa época.
          </>
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Estrés hídrico" value={ws.level ? <RiskLevelBadge level={ws.level} prefix="Estrés" /> : "—"} />
        <Stat label="Frecuencia de sequías" value={pct(s.drought_frequency_pct, 1)} />
        <Stat label="Meses más secos" value={<span className="text-lg">{dry || "—"}</span>} />
        <Stat label="Tendencia" value={s.trend.slope_per_decade == null ? "—" : `${signed(s.trend.slope_per_decade, 3)} /década`} hint={s.trend.slope_per_decade != null && !s.trend.significant ? "No significativa" : undefined} />
      </div>
      <Disclosure label="Ver gráficos y detalle de la humedad" contentClassName="space-y-6">
      <TraceInfo trace={s.trace} quality={s.quality} demo={r.demo} />
      <p className="text-sm text-muted-foreground">
        Humedad media {num(s.mean, 3)} m³/m³ (depende del suelo: mirá la variación, no el valor).
        {ws.percentile != null && <> Lo reciente fue más húmedo que el {num(ws.percentile)} % de los años anteriores.</>}
        {ws.stress_index != null && <> Índice de estrés {num(ws.stress_index, 2)} (0 = sin estrés, 1 = lo más seco del registro).</>}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <SoilMoistureClimatologyChart sm={s} />
        <SoilMoistureAnomalyChart sm={s} />
      </div>
      {s.drought_events.length > 0 && (
        <details className="rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-medium">Episodios de sequía de humedad de suelo ({s.drought_events.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {s.drought_events.map((e) => (
              <li key={e.start}>{e.start} a {e.end}: {e.months} {e.months === 1 ? "mes" : "meses"} (anomalía más fuerte: {num(e.min_anomaly_z, 1)})</li>
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
        El suelo estuvo casi desnudo el <strong>{pct((v.recent_bare_soil_fraction ?? v.bare_soil_fraction ?? 0) * 100)}</strong> del tiempo en las últimas campañas.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Verdor promedio (NDVI)" value={num(v.mean_ndvi, 2)} hint="0 = suelo desnudo · 1 = muy verde" />
        <Stat label="Cobertura vegetal" value={pct((v.cover_fraction_mean ?? 0) * 100)} />
        <Stat label="Barbechos" value={num(v.fallow_periods.length)} hint={longest ? `El más largo: ${num(longest)} días` : undefined} />
        <Stat label="Mejor campaña" value={v.best_campaign ?? "—"} hint={v.worst_campaign ? `Peor: ${v.worst_campaign}` : undefined} />
      </div>
      <Disclosure label="Ver gráficos y detalle de la vegetación" contentClassName="space-y-6">
      <TraceInfo trace={v.trace} quality={v.quality} demo={r.demo} />
      {v.biomass_trend_pct_per_decade != null && (
        <p className="text-sm text-muted-foreground">
          La biomasa {v.biomass_trend_pct_per_decade < 0 ? "bajó" : "subió"} {num(Math.abs(v.biomass_trend_pct_per_decade))} % por década
          {v.biomass_trend.significant ? " (tendencia significativa)." : " (no significativa)."} Cobertura estimada con: {v.cover_method}.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <NdviClimatologyChart v={v} />
        <CampaignsChart v={v} />
      </div>
      {v.fallow_periods.length > 0 && (
        <details className="rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-medium">Períodos de barbecho detectados ({v.fallow_periods.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {v.fallow_periods.map((p) => (
              <li key={p.start}>{p.start} a {p.end}: {p.days} días, NDVI medio {num(p.mean_ndvi, 2)}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-sm text-muted-foreground">El NDVI muestra verdor, no materia orgánica: la salud del suelo que se infiere es indirecta.</p>
      </Disclosure>
    </div>
  );
}

const SLOPE_WORD: Record<TerrainSummary["slope_class"], string> = { plano: "Plano", suave: "Suave", moderada: "Moderada", fuerte: "Fuerte" };

function TerrainSection({ r }: { r: ApiResult<TerrainSummary> }) {
  const t = r.data;
  return (
    <div className="space-y-5">
      <p className="text-lg">{t.interpretation}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pendiente media" value={`${num(t.slope_mean_pct, 1)} %`} hint={`Relieve ${SLOPE_WORD[t.slope_class].toLowerCase()}`} />
        <Stat label="Zonas más inclinadas" value={`${num(t.slope_p90_pct, 1)} %`} />
        <Stat label="Altura media" value={`${num(t.elevation_mean_m)} m`} />
        <Stat label="Desnivel" value={`${num(t.elevation_max_m - t.elevation_min_m)} m`} />
      </div>
      <Disclosure label="Ver detalle del relieve" contentClassName="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <OriginBadge status={r.demo ? "demo" : t.origin} label={r.demo ? undefined : t.origin_label} />
        <span className="text-sm text-muted-foreground">{t.product} · baldosa {t.tile} · {t.area} · píxel de ~{num(t.resolution_m)} m</span>
      </div>
      <p className="text-sm">
        El 10 % del lote supera {num(t.slope_p90_pct, 1)} % de pendiente (máxima {num(t.slope_max_pct, 1)} %). Altura de {num(t.elevation_min_m)} a {num(t.elevation_max_m)} m.
        La pendiente entra en el puntaje de suelo: con más pendiente, el suelo desnudo pierde más por el agua.
      </p>
      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Limitaciones de SRTM</summary>
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
      <PageHeader title="Diagnóstico" description={`Lo que dicen los datos de la NASA sobre la zona de ${field?.name ?? "tu campo"}.`} />
      {zone && (
        <Card className="border-agua-500/50 bg-agua-50 dark:bg-agua-900/30">
          <CardContent className="flex flex-wrap items-center gap-3 py-4 text-lg">
            <Thermometer aria-hidden className="size-6 shrink-0" />
            <p>
              Tu zona es <strong>{ZONES[zone.zone] ?? zone.zone}</strong> (índice de aridez {num(zone.aridity_index, 2)}).
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><CloudSun aria-hidden className="size-6 text-agua-600" /> Clima (NASA POWER)</CardTitle>
          <CardDescription>Últimos 10 años · dato regional (~50 km)</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={climate} what="el clima">{(r) => <ClimateSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><Satellite aria-hidden className="size-6 text-agua-600" /> Humedad del suelo (NASA SMAP)</CardTitle>
          <CardDescription>Agua en la zona de raíces · contexto regional (9 km)</CardDescription>
        </CardHeader>
        <CardContent>
          <SoilMoistureIndicator fieldId={fieldId} />
          <h3 className="mt-6 text-lg font-semibold">Historia de la zona</h3>
          <AsyncBlock state={soil} what="la humedad del suelo">{(r) => <SoilMoistureSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><Leaf aria-hidden className="size-6 text-cultivo-600" /> Vegetación (NASA MODIS NDVI)</CardTitle>
          <CardDescription>Verdor de cada campaña · 250 m</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={veg} what="la vegetación">{(r) => <VegetationSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><Mountain aria-hidden className="size-6 text-tierra-600" /> Relieve (NASA SRTM)</CardTitle>
          <CardDescription>Altura y pendiente del lote · 30 m</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={terrain} what="el relieve">{(r) => <TerrainSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>
      <SectorsCard fieldId={fieldId} />
      <Disclosure variant="card" label="Más análisis: calor de la superficie e imagen satelital de hoy" contentClassName="space-y-6">
        <HeatStressCard fieldId={fieldId} />
        {field && <TodaySatellite field={field} />}
      </Disclosure>
      <PageNotes>
        <p>Estos datos describen la zona. Para decidir, combinalos con lo que sabés de tu lote y consultá a un ingeniero agrónomo.</p>
        {warnings.length > 0 && <WarningsList warnings={warnings} />}
      </PageNotes>
    </div>
  );
}
