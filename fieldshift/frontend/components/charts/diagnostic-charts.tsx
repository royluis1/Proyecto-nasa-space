"use client";

import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis,
} from "recharts";
import { droughtHistory, droughtSentence } from "@/lib/drought";
import { MONTHS, num } from "@/lib/format";
import type { ClimateSummary, SoilMoistureSummary, VegetationSummary } from "@/types/api";
import { CHART, ChartFrame } from "./chart-frame";
import { tr } from "@/lib/i18n";

const grid = <CartesianGrid stroke="currentColor" strokeOpacity={0.15} vertical={false} />;
const tick = { fill: "currentColor", fontSize: 12 };
const tip = { contentStyle: { background: "oklch(var(--card))", border: "1px solid oklch(var(--border))", borderRadius: 8, color: "oklch(var(--foreground))" } };
const fmt = (d = 0) => (v: unknown) => (typeof v === "number" ? num(v, d) : String(v ?? "—"));

/** Lluvia mensual (barras) frente a la evapotranspiración de referencia (línea con puntos). */
export function MonthlyClimateChart({ climate }: { climate: ClimateSummary }) {
  const data = climate.monthly_climatology.map((m) => ({ mes: MONTHS[m.month - 1], lluvia: m.precip_mm, et0: m.et0_mm }));
  return (
    <ChartFrame
      title={tr("Lluvia y demanda de agua de la atmósfera, mes por mes", "Rain and atmospheric water demand, month by month")}
      caption={tr("Donde la línea (ET₀) queda por encima de las barras (lluvia), la atmósfera pide más agua de la que llueve.", "Where the line (ET₀) is above the bars (rain), the atmosphere demands more water than it rains.")}
      table={{ headers: [tr("Mes", "Month"), tr("Lluvia (mm)", "Rain (mm)"), "ET₀ (mm)"], rows: data.map((d) => [d.mes, num(d.lluvia), num(d.et0)]) }}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} />
        <YAxis tick={tick} width={44} unit=" mm" />
        <Tooltip {...tip} formatter={fmt(0)} />
        <Legend />
        <Bar isAnimationActive={false} dataKey="lluvia" name={tr("Lluvia (barras)", "Rain (bars)")} fill={CHART.agua} radius={[3, 3, 0, 0]} />
        <Line isAnimationActive={false} dataKey="et0" name={tr("ET₀ (línea con puntos)", "ET₀ (line with dots)")} stroke={CHART.tierra} strokeWidth={3} dot={{ r: 4, fill: CHART.tierra }} />
      </ComposedChart>
    </ChartFrame>
  );
}

/** Lluvia de cada año. Los años secos y húmedos llevan la palabra escrita sobre la barra. */
export function AnnualRainChart({ climate }: { climate: ClimateSummary }) {
  const data = climate.annual
    .filter((a) => a.precip_mm != null)
    .map((a) => ({ año: String(a.year), lluvia: a.precip_mm as number, clase: a.classification ?? "normal", completo: a.complete }));
  const label = (clase: string) => (clase === "seco" ? tr("▼ seco", "▼ dry") : clase === "húmedo" ? tr("▲ húmedo", "▲ wet") : "");
  const claseText = (clase: string) => (clase === "seco" ? tr("seco", "dry") : clase === "húmedo" ? tr("húmedo", "wet") : clase === "normal" ? tr("normal", "normal") : clase);
  return (
    <ChartFrame
      title={tr("Lluvia de cada año", "Rain each year")}
      caption={tr("Los años marcados como secos o húmedos se comparan con el promedio de este mismo período.", "Years marked dry or wet are compared with the average of this same period.")}
      table={{ headers: [tr("Año", "Year"), tr("Lluvia (mm)", "Rain (mm)"), tr("Clasificación", "Classification"), tr("Año completo", "Complete year")], rows: data.map((d) => [d.año, num(d.lluvia), claseText(d.clase), d.completo ? tr("sí", "yes") : "no"]) }}
    >
      <BarChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="año" tick={tick} />
        <YAxis tick={tick} width={44} unit=" mm" />
        <Tooltip {...tip} formatter={fmt(0)} />
        <Bar isAnimationActive={false} dataKey="lluvia" name={tr("Lluvia anual", "Annual rain")} fill={CHART.agua} radius={[3, 3, 0, 0]}>
          <LabelList dataKey="clase" position="top" formatter={(v: unknown) => label(String(v))} fill="currentColor" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/**
 * Historial de sequía: el agua que faltó cada año (déficit) con NASA POWER, el promedio y una tendencia orientativa.
 * Es el "historial para decidir": qué tan seguido y qué tan fuerte faltó agua en la zona.
 */
export function DroughtHistoryChart({ climate }: { climate: ClimateSummary }) {
  const h = droughtHistory(climate.annual);
  if (h.years.length === 0) return <p className="text-muted-foreground">{droughtSentence(h, (v) => num(v))}</p>;
  const driest = new Set(h.driest);
  const data = h.years.map((y) => ({
    año: String(y.year),
    deficit: y.deficit,
    tendencia: h.trend[y.year] ?? null,
    marca: driest.has(y.year) ? "▲ seco" : "",
  }));
  return (
    <div className="space-y-2">
      <p>{droughtSentence(h, (v) => num(v))}</p>
      <ChartFrame
        title={tr("Agua que faltó cada año", "Water missing each year")}
        caption={tr("Suma de los meses en que la atmósfera pidió más agua de la que llovió (NASA POWER, ET₀ FAO-56). Más alto = año más seco para los cultivos. La línea es una tendencia orientativa: con unos 10 años no alcanza para afirmar un cambio.", "Sum of the months in which the atmosphere demanded more water than it rained (NASA POWER, ET₀ FAO-56). Higher = drier year for crops. The line is an indicative trend: about 10 years is not enough to claim a change.")}
        table={{
          headers: [tr("Año", "Year"), tr("Déficit (mm)", "Deficit (mm)"), tr("Lluvia (mm)", "Rain (mm)"), "ET₀ (mm)"],
          rows: h.years.map((y) => [String(y.year), num(y.deficit), y.rain == null ? "—" : num(y.rain), y.et0 == null ? "—" : num(y.et0)]),
        }}
      >
        <ComposedChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: 0 }}>
          {grid}
          <XAxis dataKey="año" tick={tick} />
          <YAxis tick={tick} width={48} unit=" mm" />
          <Tooltip {...tip} formatter={fmt(0)} />
          <Legend />
          {h.mean != null && <ReferenceLine y={h.mean} stroke="currentColor" strokeDasharray="4 4" label={{ value: tr("promedio", "average"), position: "insideTopRight", fill: "currentColor", fontSize: 12 }} />}
          <Bar isAnimationActive={false} dataKey="deficit" name={tr("Agua que faltó (barras)", "Missing water (bars)")} fill={CHART.tierra} radius={[3, 3, 0, 0]}>
            <LabelList dataKey="marca" position="top" fill="currentColor" fontSize={12} />
          </Bar>
          {h.slopePerDecade != null && (
            <Line isAnimationActive={false} dataKey="tendencia" name={tr("Tendencia orientativa (línea)", "Indicative trend (line)")} stroke={CHART.agua} strokeWidth={2.5} dot={false} />
          )}
        </ComposedChart>
      </ChartFrame>
    </div>
  );
}

/** Porcentaje de días con más de 35 °C en cada mes. */
export function HeatChart({ climate }: { climate: ClimateSummary }) {
  const data = climate.heat.frequency_pct_by_month.map((v, i) => ({ mes: MONTHS[i], pct: v ?? 0 }));
  return (
    <ChartFrame
      title={tr(`Días calurosos (más de ${num(climate.heat.threshold_c)} °C), por mes`, `Hot days (above ${num(climate.heat.threshold_c)} °C), by month`)}
      caption={tr("Porcentaje de los días de cada mes que superaron el umbral en los últimos años.", "Share of days each month that exceeded the threshold in recent years.")}
      height={220}
      table={{ headers: [tr("Mes", "Month"), tr("% de días", "% of days")], rows: data.map((d) => [d.mes, num(d.pct, 1)]) }}
    >
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} />
        <YAxis tick={tick} width={44} unit=" %" />
        <Tooltip {...tip} formatter={fmt(1)} />
        <Bar isAnimationActive={false} dataKey="pct" name={tr("% de días calurosos", "% of hot days")} fill={CHART.tierra} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

/** Humedad típica de cada mes con su variación entre años. */
export function SoilMoistureClimatologyChart({ sm }: { sm: SoilMoistureSummary }) {
  const data = sm.monthly_climatology.map((m) => ({
    mes: MONTHS[m.month - 1],
    media: m.mean,
    banda: m.mean != null && m.std != null ? [Math.max(0, m.mean - m.std), m.mean + m.std] : null,
  }));
  return (
    <ChartFrame
      title={tr("Humedad típica del suelo, mes por mes", "Typical soil moisture, month by month")}
      caption={tr("La línea es el promedio y la franja sombreada muestra cuánto varía de un año a otro.", "The line is the average and the shaded band shows how much it varies from year to year.")}
      height={240}
      table={{ headers: [tr("Mes", "Month"), tr(`Humedad media (${sm.units})`, `Mean moisture (${sm.units})`)], rows: data.map((d) => [d.mes, d.media == null ? "—" : num(d.media, 3)]) }}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} />
        <YAxis tick={tick} width={52} domain={["auto", "auto"]} tickFormatter={(v: number) => num(v, 2)} />
        <Tooltip {...tip} formatter={(v: unknown) => (Array.isArray(v) ? `${num(v[0], 3)} ${tr("a", "to")} ${num(v[1], 3)}` : fmt(3)(v))} />
        <Area isAnimationActive={false} dataKey="banda" name={tr("Variación entre años", "Variation between years")} stroke="none" fill={CHART.agua} fillOpacity={0.2} />
        <Line isAnimationActive={false} dataKey="media" name={tr("Promedio", "Average")} stroke={CHART.agua} strokeWidth={3} dot={{ r: 3 }} />
      </ComposedChart>
    </ChartFrame>
  );
}

/** Anomalía mensual: por encima de la línea de cero = más húmedo que lo normal; por debajo = más seco. */
export function SoilMoistureAnomalyChart({ sm }: { sm: SoilMoistureSummary }) {
  const rows = sm.monthly.filter((m) => m.anomaly_z != null).slice(-60);
  const data = rows.map((m) => ({ mes: `${m.year}-${String(m.month).padStart(2, "0")}`, z: m.anomaly_z as number, sequia: m.drought }));
  return (
    <ChartFrame
      title={tr("Meses más secos o más húmedos de lo normal (últimos 5 años)", "Months drier or wetter than normal (last 5 years)")}
      caption={tr("Barras hacia abajo = más seco que lo normal para ese mes. Por debajo de la línea punteada (−1) es una sequía de humedad de suelo.", "Bars pointing down = drier than normal for that month. Below the dotted line (−1) is a soil-moisture drought.")}
      height={240}
      table={{ headers: [tr("Mes", "Month"), tr("Anomalía (z)", "Anomaly (z)"), tr("¿Sequía?", "Drought?")], rows: data.map((d) => [d.mes, num(d.z, 2), d.sequia ? tr("sí", "yes") : "no"]) }}
    >
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} interval={Math.max(0, Math.floor(data.length / 8) - 1)} />
        <YAxis tick={tick} width={36} />
        <Tooltip {...tip} formatter={fmt(2)} />
        <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.6} />
        <ReferenceLine y={-1} stroke={CHART.alerta} strokeDasharray="5 4" label={{ value: tr("Sequía (−1)", "Drought (−1)"), position: "insideBottomRight", fill: "currentColor", fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="z" name={tr("Anomalía", "Anomaly")} fill={CHART.agua} />
      </BarChart>
    </ChartFrame>
  );
}

/** NDVI típico de cada mes y el umbral por debajo del cual se considera barbecho. */
export function NdviClimatologyChart({ v }: { v: VegetationSummary }) {
  const data = Array.from({ length: 12 }, (_, i) => ({ mes: MONTHS[i], ndvi: v.monthly_climatology[String(i + 1) as unknown as number] ?? null }));
  return (
    <ChartFrame
      title={tr("Verdor típico de cada mes (NDVI)", "Typical greenness each month (NDVI)")}
      caption={tr(`Por debajo de la línea punteada (${num(v.bare_threshold, 2)}) el lote está en barbecho o con el suelo casi desnudo.`, `Below the dotted line (${num(v.bare_threshold, 2)}) the plot is fallow or the soil is almost bare.`)}
      height={240}
      table={{ headers: [tr("Mes", "Month"), tr(tr("NDVI medio", "Mean NDVI"), "Mean NDVI")], rows: data.map((d) => [d.mes, d.ndvi == null ? "—" : num(d.ndvi, 2)]) }}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} />
        <YAxis tick={tick} width={36} domain={[0, 1]} tickFormatter={(x: number) => num(x, 1)} />
        <Tooltip {...tip} formatter={fmt(2)} />
        <ReferenceLine y={v.bare_threshold} stroke={CHART.tierra} strokeDasharray="5 4" label={{ value: tr("Barbecho", "Fallow"), position: "insideTopRight", fill: "currentColor", fontSize: 12 }} />
        <Line isAnimationActive={false} dataKey="ndvi" name={tr("NDVI medio", "Mean NDVI")} stroke={CHART.cultivo} strokeWidth={3} dot={{ r: 4, fill: CHART.cultivo }} connectNulls />
      </LineChart>
    </ChartFrame>
  );
}

/** Biomasa producida en cada campaña (NDVI integrado) con su diferencia frente al promedio. */
export function CampaignsChart({ v }: { v: VegetationSummary }) {
  const data = v.campaigns.filter((c) => c.complete && c.integrated_ndvi != null).map((c) => ({ campaña: c.campaign, biomasa: c.integrated_ndvi as number, anom: c.anomaly_pct }));
  const label = (a: unknown) => (typeof a === "number" ? `${a > 0 ? "▲+" : a < 0 ? "▼" : ""}${num(a)}%` : "");
  return (
    <ChartFrame
      title={tr("Biomasa producida en cada campaña", "Biomass produced each season")}
      caption={tr("Cuánto verde acumuló el lote entre julio y junio. Arriba de cada barra, la diferencia con el promedio.", "How much green the plot accumulated from July to June. Above each bar, the difference from the average.")}
      height={260}
      table={{ headers: [tr("Campaña", "Season"), tr(tr("NDVI integrado", "Integrated NDVI"), "Integrated NDVI"), tr("Diferencia con el promedio (%)", "Difference from average (%)"), tr("Ciclos de crecimiento", "Growth cycles")], rows: v.campaigns.filter((c) => c.complete).map((c) => [c.campaign, num(c.integrated_ndvi, 1), c.anomaly_pct == null ? "—" : num(c.anomaly_pct, 1), c.growth_cycles]) }}
    >
      <BarChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="campaña" tick={tick} />
        <YAxis tick={tick} width={40} />
        <Tooltip {...tip} formatter={fmt(1)} />
        <Bar isAnimationActive={false} dataKey="biomasa" name={tr("NDVI integrado", "Integrated NDVI")} fill={CHART.cultivo} radius={[3, 3, 0, 0]}>
          <LabelList dataKey="anom" position="top" formatter={label} fill="currentColor" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
