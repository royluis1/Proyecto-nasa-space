"use client";

import { CloudSun, Flame, Leaf, Mountain, Satellite, Thermometer } from "lucide-react";
import { useMemo } from "react";
import { useCampo } from "@/components/campo/campo-provider";
import { AsyncBlock } from "@/components/async-block";
import {
  AnnualRainChart, CampaignsChart, HeatChart, MonthlyClimateChart, NdviClimatologyChart, SoilMoistureAnomalyChart, SoilMoistureClimatologyChart,
} from "@/components/charts/diagnostic-charts";
import { PageHeader } from "@/components/page-header";
import { LabelBadge, OriginBadge, RiskLevelBadge } from "@/components/provenance/badges";
import { TraceInfo } from "@/components/provenance/trace-info";
import { WarningsList } from "@/components/provenance/warnings";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <OriginBadge status={r.demo ? "demo" : c.source.origin} label={r.demo ? undefined : c.source.origin_label} />
        <LabelBadge label="modelado" />
        <span className="text-sm text-muted-foreground">{c.source.provider} · {c.source.resolution}</span>
      </div>
      <p className="text-lg">
        En promedio llueven <strong>{num(wd.mean_annual_precip_mm)} mm por año</strong>, pero la atmósfera “pide” <strong>{num(wd.mean_annual_et0_mm)} mm</strong>. La diferencia es un
        déficit de agua de <strong>{num(wd.mean_annual_deficit_mm)} mm por año</strong>: en {pct(wd.months_with_deficit_pct)} de los meses se evapora más de lo que llueve.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lluvia anual media" value={`${num(wd.mean_annual_precip_mm)} mm`} hint={`Varía ${num(c.variability.annual_precip_cv_pct)} % de un año a otro`} />
        <Stat label="Evapotranspiración (ET₀)" value={`${num(wd.mean_annual_et0_mm)} mm`} hint="Lo que la atmósfera demanda, calculado con FAO-56" />
        <Stat label="Días con más de 35 °C" value={`${num(c.heat.mean_days_per_year)} por año`} hint={c.heat.heat_stress_years.length ? `Años de más calor: ${c.heat.heat_stress_years.join(", ")}` : "Sin años con estrés térmico marcado"} />
        <Stat
          label="Tendencia de la lluvia"
          value={trend.slope_per_decade == null ? "—" : `${signed(trend.slope_per_decade)} mm/década`}
          hint={trend.slope_per_decade == null ? "Hacen falta más años completos" : trend.significant ? "Tendencia estadísticamente significativa" : "No es una tendencia significativa: con pocos años no se puede afirmar"}
        />
      </div>
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
      <WarningsList warnings={r.meta.warnings} />
    </div>
  );
}

function SoilMoistureSection({ r }: { r: ApiResult<SoilMoistureSummary> }) {
  const s = r.data;
  const ws = s.water_stress;
  const dry = s.typically_dry_months.map((m) => MONTHS_LONG[m - 1]).join(", ");
  return (
    <div className="space-y-6">
      <TraceInfo trace={s.trace} quality={s.quality} demo={r.demo} />
      <p className="text-lg">
        {ws.anomaly_pct == null ? (
          "No hay datos suficientes para comparar la humedad reciente con la normal."
        ) : (
          <>
            En los últimos días ({ws.window_start} a {ws.window_end}) la humedad del suelo estuvo{" "}
            <strong>{num(Math.abs(ws.anomaly_pct), 1)} % {ws.anomaly_pct < 0 ? "por debajo" : "por encima"} de lo normal</strong> para esa época
            {ws.percentile != null && <>: fue más húmeda que el {num(ws.percentile)} % de los años anteriores</>}.
          </>
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Humedad media" value={`${num(s.mean, 3)} m³/m³`} hint="Depende del suelo de la zona: mirá la variación, no el valor absoluto." />
        <Stat label="Frecuencia de sequías" value={pct(s.drought_frequency_pct, 1)} hint={`${s.drought_months} meses en ${s.drought_events.length} episodios`} />
        <Stat label="Estrés hídrico relativo" value={ws.level ? <RiskLevelBadge level={ws.level} prefix="Estrés" /> : "—"} hint={ws.stress_index != null ? `Índice ${num(ws.stress_index, 2)} (0 = sin estrés, 1 = lo más seco del registro)` : "Sin datos"} />
        <Stat
          label="Tendencia de la humedad"
          value={s.trend.slope_per_decade == null ? "—" : `${signed(s.trend.slope_per_decade, 3)} /década`}
          hint={s.trend.slope_per_decade == null ? "Hacen falta más años" : s.trend.significant ? "Tendencia significativa" : "No es una tendencia significativa"}
        />
      </div>
      {dry && <p className="text-base">Meses típicamente más secos: <strong>{dry}</strong>.</p>}
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
      <WarningsList warnings={r.meta.warnings} />
    </div>
  );
}

function VegetationSection({ r }: { r: ApiResult<VegetationSummary> }) {
  const v = r.data;
  const longest = v.fallow_periods.reduce((m, p) => Math.max(m, p.days), 0);
  return (
    <div className="space-y-6">
      <TraceInfo trace={v.trace} quality={v.quality} demo={r.demo} />
      <p className="text-lg">
        En las últimas campañas el lote estuvo con el suelo casi desnudo el <strong>{pct((v.recent_bare_soil_fraction ?? v.bare_soil_fraction ?? 0) * 100)}</strong> del tiempo
        y la cobertura vegetal promedio fue de <strong>{pct((v.cover_fraction_mean ?? 0) * 100)}</strong>.
        {v.biomass_trend_pct_per_decade != null && (
          <> La biomasa {v.biomass_trend_pct_per_decade < 0 ? "bajó" : "subió"} {num(Math.abs(v.biomass_trend_pct_per_decade))} % por década
          {v.biomass_trend.significant ? " (tendencia significativa)." : ", pero no es una tendencia significativa."}</>
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="NDVI promedio" value={num(v.mean_ndvi, 2)} hint="0 = suelo desnudo, cerca de 1 = vegetación muy densa" />
        <Stat label="Cobertura vegetal estimada" value={pct((v.cover_fraction_mean ?? 0) * 100)} hint={v.cover_method} />
        <Stat label="Períodos de barbecho" value={num(v.fallow_periods.length)} hint={longest ? `El más largo: ${num(longest)} días` : "Sin períodos largos"} />
        <Stat label="Mejor y peor campaña" value={v.best_campaign ?? "—"} hint={v.worst_campaign ? `Peor: ${v.worst_campaign}` : undefined} />
      </div>
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
      <WarningsList warnings={r.meta.warnings} />
    </div>
  );
}

const SLOPE_WORD: Record<TerrainSummary["slope_class"], string> = { plano: "Plano", suave: "Suave", moderada: "Moderada", fuerte: "Fuerte" };

function TerrainSection({ r }: { r: ApiResult<TerrainSummary> }) {
  const t = r.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <OriginBadge status={r.demo ? "demo" : t.origin} label={r.demo ? undefined : t.origin_label} />
        <span className="text-sm text-muted-foreground">{t.product} · baldosa {t.tile} · {t.area} · píxel de ~{num(t.resolution_m)} m</span>
      </div>
      <p className="text-lg">{t.interpretation}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pendiente media" value={`${num(t.slope_mean_pct, 1)} %`} hint={`Relieve ${SLOPE_WORD[t.slope_class].toLowerCase()}`} />
        <Stat label="Pendiente en los sectores más inclinados" value={`${num(t.slope_p90_pct, 1)} %`} hint={`El 10 % del lote supera este valor. Máxima: ${num(t.slope_max_pct, 1)} %`} />
        <Stat label="Altura media" value={`${num(t.elevation_mean_m)} m`} hint="Sobre el nivel del mar" />
        <Stat label="Desnivel" value={`${num(t.elevation_max_m - t.elevation_min_m)} m`} hint={`De ${num(t.elevation_min_m)} a ${num(t.elevation_max_m)} m`} />
      </div>
      <p className="text-sm">La pendiente se usa en el puntaje de suelo: con más pendiente, el suelo desnudo pierde más por el agua.</p>
      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Limitaciones de SRTM</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">{t.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
      </details>
      <WarningsList warnings={r.meta.warnings} />
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

  return (
    <div className="space-y-8">
      <PageHeader title="Diagnóstico climático e hídrico" description={`Qué dicen los datos de la NASA sobre la zona de ${field?.name ?? "tu campo"}: clima, humedad del suelo y vegetación.`} />
      {zone && (
        <Card className="border-agua-500/50 bg-agua-50 dark:bg-agua-900/30">
          <CardContent className="flex flex-wrap items-center gap-3 py-4 text-lg">
            <Thermometer aria-hidden className="size-6 shrink-0" />
            <p>
              Tu zona es <strong>{ZONES[zone.zone] ?? zone.zone}</strong>: llueve {num(zone.annual_precip_mm)} mm al año y la demanda de agua es de {num(zone.annual_et0_mm)} mm
              (índice de aridez {num(zone.aridity_index, 2)}).
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><CloudSun aria-hidden className="size-6 text-agua-600" /> Clima (NASA POWER)</CardTitle>
          <CardDescription>Últimos 10 años completos. Es un dato regional de unos 50 km, no una medición de tu lote.</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={climate} what="el clima">{(r) => <ClimateSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><Satellite aria-hidden className="size-6 text-agua-600" /> Humedad del suelo (NASA SMAP)</CardTitle>
          <CardDescription>Agua en la zona de raíces (hasta 1 m). Un píxel de 9 km: sirve como contexto de la zona, no del lote.</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={soil} what="la humedad del suelo">{(r) => <SoilMoistureSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><Leaf aria-hidden className="size-6 text-cultivo-600" /> Vegetación (NASA MODIS NDVI)</CardTitle>
          <CardDescription>Verdor de cada campaña cada 16 días, con píxeles de 250 m.</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={veg} what="la vegetación">{(r) => <VegetationSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2"><Mountain aria-hidden className="size-6 text-tierra-600" /> Relieve (NASA SRTM)</CardTitle>
          <CardDescription>Altura y pendiente del lote con píxeles de 30 m, descargadas con Earthdata Login.</CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBlock state={terrain} what="el relieve">{(r) => <TerrainSection r={r} />}</AsyncBlock>
        </CardContent>
      </Card>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Flame aria-hidden className="mt-0.5 size-4 shrink-0" />
        Estos datos describen la zona. Para decidir, combinalos con lo que sabés de tu lote y consultá a un ingeniero agrónomo.
      </p>
    </div>
  );
}
