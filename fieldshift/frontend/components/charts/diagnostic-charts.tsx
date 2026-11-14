"use client";

import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis,
} from "recharts";
import { MONTHS, num } from "@/lib/format";
import type { ClimateSummary, SoilMoistureSummary, VegetationSummary } from "@/types/api";
import { CHART, ChartFrame } from "./chart-frame";

const grid = <CartesianGrid stroke="currentColor" strokeOpacity={0.15} vertical={false} />;
const tick = { fill: "currentColor", fontSize: 12 };
const tip = { contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" } };
const fmt = (d = 0) => (v: unknown) => (typeof v === "number" ? num(v, d) : String(v ?? "—"));

/** Lluvia mensual (barras) frente a la evapotranspiración de referencia (línea con puntos). */
export function MonthlyClimateChart({ climate }: { climate: ClimateSummary }) {
  const data = climate.monthly_climatology.map((m) => ({ mes: MONTHS[m.month - 1], lluvia: m.precip_mm, et0: m.et0_mm }));
  return (
    <ChartFrame
      title="Lluvia y demanda de agua de la atmósfera, mes por mes"
      caption="Donde la línea (ET₀) queda por encima de las barras (lluvia), la atmósfera pide más agua de la que llueve."
      table={{ headers: ["Mes", "Lluvia (mm)", "ET₀ (mm)"], rows: data.map((d) => [d.mes, num(d.lluvia), num(d.et0)]) }}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} />
        <YAxis tick={tick} width={44} unit=" mm" />
        <Tooltip {...tip} formatter={fmt(0)} />
        <Legend />
        <Bar isAnimationActive={false} dataKey="lluvia" name="Lluvia (barras)" fill={CHART.agua} radius={[3, 3, 0, 0]} />
        <Line isAnimationActive={false} dataKey="et0" name="ET₀ (línea con puntos)" stroke={CHART.tierra} strokeWidth={3} dot={{ r: 4, fill: CHART.tierra }} />
      </ComposedChart>
    </ChartFrame>
  );
}

/** Lluvia de cada año. Los años secos y húmedos llevan la palabra escrita sobre la barra. */
export function AnnualRainChart({ climate }: { climate: ClimateSummary }) {
  const data = climate.annual
    .filter((a) => a.precip_mm != null)
    .map((a) => ({ año: String(a.year), lluvia: a.precip_mm as number, clase: a.classification ?? "normal", completo: a.complete }));
  const label = (clase: string) => (clase === "seco" ? "▼ seco" : clase === "húmedo" ? "▲ húmedo" : "");
  return (
    <ChartFrame
      title="Lluvia de cada año"
      caption="Los años marcados como secos o húmedos se comparan con el promedio de este mismo período."
      table={{ headers: ["Año", "Lluvia (mm)", "Clasificación", "Año completo"], rows: data.map((d) => [d.año, num(d.lluvia), d.clase, d.completo ? "sí" : "no"]) }}
    >
      <BarChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="año" tick={tick} />
        <YAxis tick={tick} width={44} unit=" mm" />
        <Tooltip {...tip} formatter={fmt(0)} />
        <Bar isAnimationActive={false} dataKey="lluvia" name="Lluvia anual" fill={CHART.agua} radius={[3, 3, 0, 0]}>
          <LabelList dataKey="clase" position="top" formatter={(v: unknown) => label(String(v))} fill="currentColor" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/** Porcentaje de días con más de 35 °C en cada mes. */
export function HeatChart({ climate }: { climate: ClimateSummary }) {
  const data = climate.heat.frequency_pct_by_month.map((v, i) => ({ mes: MONTHS[i], pct: v ?? 0 }));
  return (
    <ChartFrame
      title={`Días calurosos (más de ${num(climate.heat.threshold_c)} °C), por mes`}
      caption="Porcentaje de los días de cada mes que superaron el umbral en los últimos años."
      height={220}
      table={{ headers: ["Mes", "% de días"], rows: data.map((d) => [d.mes, num(d.pct, 1)]) }}
    >
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} />
        <YAxis tick={tick} width={44} unit=" %" />
        <Tooltip {...tip} formatter={fmt(1)} />
        <Bar isAnimationActive={false} dataKey="pct" name="% de días calurosos" fill={CHART.tierra} radius={[3, 3, 0, 0]} />
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
      title="Humedad típica del suelo, mes por mes"
      caption="La línea es el promedio y la franja sombreada muestra cuánto varía de un año a otro."
      height={240}
      table={{ headers: ["Mes", `Humedad media (${sm.units})`], rows: data.map((d) => [d.mes, d.media == null ? "—" : num(d.media, 3)]) }}
    >
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} />
        <YAxis tick={tick} width={52} domain={["auto", "auto"]} tickFormatter={(v: number) => num(v, 2)} />
        <Tooltip {...tip} formatter={(v: unknown) => (Array.isArray(v) ? `${num(v[0], 3)} a ${num(v[1], 3)}` : fmt(3)(v))} />
        <Area isAnimationActive={false} dataKey="banda" name="Variación entre años" stroke="none" fill={CHART.agua} fillOpacity={0.2} />
        <Line isAnimationActive={false} dataKey="media" name="Promedio" stroke={CHART.agua} strokeWidth={3} dot={{ r: 3 }} />
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
      title="Meses más secos o más húmedos de lo normal (últimos 5 años)"
      caption="Barras hacia abajo = más seco que lo normal para ese mes. Por debajo de la línea punteada (−1) es una sequía de humedad de suelo."
      height={240}
      table={{ headers: ["Mes", "Anomalía (z)", "¿Sequía?"], rows: data.map((d) => [d.mes, num(d.z, 2), d.sequia ? "sí" : "no"]) }}
    >
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} interval={Math.max(0, Math.floor(data.length / 8) - 1)} />
        <YAxis tick={tick} width={36} />
        <Tooltip {...tip} formatter={fmt(2)} />
        <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.6} />
        <ReferenceLine y={-1} stroke={CHART.alerta} strokeDasharray="5 4" label={{ value: "Sequía (−1)", position: "insideBottomRight", fill: "currentColor", fontSize: 12 }} />
        <Bar isAnimationActive={false} dataKey="z" name="Anomalía" fill={CHART.agua} />
      </BarChart>
    </ChartFrame>
  );
}

/** NDVI típico de cada mes y el umbral por debajo del cual se considera barbecho. */
export function NdviClimatologyChart({ v }: { v: VegetationSummary }) {
  const data = Array.from({ length: 12 }, (_, i) => ({ mes: MONTHS[i], ndvi: v.monthly_climatology[String(i + 1) as unknown as number] ?? null }));
  return (
    <ChartFrame
      title="Verdor típico de cada mes (NDVI)"
      caption={`Por debajo de la línea punteada (${num(v.bare_threshold, 2)}) el lote está en barbecho o con el suelo casi desnudo.`}
      height={240}
      table={{ headers: ["Mes", "NDVI medio"], rows: data.map((d) => [d.mes, d.ndvi == null ? "—" : num(d.ndvi, 2)]) }}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="mes" tick={tick} />
        <YAxis tick={tick} width={36} domain={[0, 1]} tickFormatter={(x: number) => num(x, 1)} />
        <Tooltip {...tip} formatter={fmt(2)} />
        <ReferenceLine y={v.bare_threshold} stroke={CHART.tierra} strokeDasharray="5 4" label={{ value: "Barbecho", position: "insideTopRight", fill: "currentColor", fontSize: 12 }} />
        <Line isAnimationActive={false} dataKey="ndvi" name="NDVI medio" stroke={CHART.cultivo} strokeWidth={3} dot={{ r: 4, fill: CHART.cultivo }} connectNulls />
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
      title="Biomasa producida en cada campaña"
      caption="Cuánto verde acumuló el lote entre julio y junio. Arriba de cada barra, la diferencia con el promedio."
      height={260}
      table={{ headers: ["Campaña", "NDVI integrado", "Diferencia con el promedio (%)", "Ciclos de crecimiento"], rows: v.campaigns.filter((c) => c.complete).map((c) => [c.campaign, num(c.integrated_ndvi, 1), c.anomaly_pct == null ? "—" : num(c.anomaly_pct, 1), c.growth_cycles]) }}
    >
      <BarChart data={data} margin={{ top: 22, right: 12, bottom: 0, left: 0 }}>
        {grid}
        <XAxis dataKey="campaña" tick={tick} />
        <YAxis tick={tick} width={40} />
        <Tooltip {...tip} formatter={fmt(1)} />
        <Bar isAnimationActive={false} dataKey="biomasa" name="NDVI integrado" fill={CHART.cultivo} radius={[3, 3, 0, 0]}>
          <LabelList dataKey="anom" position="top" formatter={label} fill="currentColor" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
