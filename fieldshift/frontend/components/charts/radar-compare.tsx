"use client";

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Tooltip } from "recharts";
import { COMPONENTS, COMPONENT_ORDER, STRATEGY_LABELS, num } from "@/lib/format";
import type { RotationEvaluation } from "@/types/api";
import { CHART, ChartFrame } from "./chart-frame";
import { tr } from "@/lib/i18n";

// Cada serie lleva un trazo distinto además del color: no depende solo del color.
const SERIES = [
  { color: CHART.cultivo, dash: undefined },
  { color: CHART.agua, dash: "8 4" },
  { color: CHART.tierra, dash: "2 4" },
  { color: CHART.gris, dash: "12 4 2 4" },
] as const;

/** `pick="auto"`: las 3 mejores y la actual. `pick="all"`: exactamente las que se pasan (hasta 4). */
export function RadarCompare({ evaluations, pick = "auto" }: { evaluations: RotationEvaluation[]; pick?: "auto" | "all" }) {
  const actual = evaluations.find((e) => e.rotation.strategy === "actual");
  const picked =
    pick === "all"
      ? evaluations.slice(0, SERIES.length)
      : [...evaluations.slice(0, 3), ...(actual && !evaluations.slice(0, 3).includes(actual) ? [actual] : [])];
  const names = picked.map((e) => `${e.score.rank}. ${STRATEGY_LABELS[e.rotation.strategy]}`);
  const data: Record<string, string | number>[] = COMPONENT_ORDER.map((k) => ({
    eje: `${k} ${COMPONENTS[k].short}`,
    ...Object.fromEntries(picked.map((e, i) => [names[i], e.score.components.find((c) => c.key === k)?.value ?? 0])),
  }));
  return (
    <ChartFrame
      title={tr("Las mejores opciones y tu rotación actual, componente por componente", "The best options and your current rotation, component by component")}
      caption={tr("Cuanto más lejos del centro, mejor el componente (0 a 100).", "The farther from the center, the better the component (0 to 100).")}
      height={340}
      table={{ headers: [tr("Componente", "Component"), ...names], rows: data.map((d) => [String(d.eje), ...names.map((n) => num(Number(d[n])))]) }}
    >
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="currentColor" strokeOpacity={0.25} />
        <PolarAngleAxis dataKey="eje" tick={{ fill: "currentColor", fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "currentColor", fontSize: 10 }} />
        <Tooltip contentStyle={{ background: "oklch(var(--card))", border: "1px solid oklch(var(--border))", borderRadius: 8, color: "oklch(var(--foreground))" }} />
        {names.map((n, i) => (
          <Radar isAnimationActive={false} key={n} name={n} dataKey={n} stroke={SERIES[i % SERIES.length].color} strokeDasharray={SERIES[i % SERIES.length].dash} strokeWidth={3} fill={SERIES[i % SERIES.length].color} fillOpacity={0.08} />
        ))}
        <Legend />
      </RadarChart>
    </ChartFrame>
  );
}
