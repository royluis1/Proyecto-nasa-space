"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, ChartFrame } from "@/components/charts/chart-frame";
import { contributions, type Weights } from "@/lib/dashboard";
import { COMPONENTS, COMPONENT_ORDER, STRATEGY_LABELS, num } from "@/lib/format";
import type { RotationEvaluation, ScoreComponentKey } from "@/types/api";
import { tr } from "@/lib/i18n";

/** Un color por componente; además cada tramo lleva su letra (A, S, R, I, E) y el aporte en puntos. */
const COLORS: Record<ScoreComponentKey, string> = { A: CHART.agua, S: CHART.tierra, R: "#6b7c93", I: "#b8862b", E: CHART.cultivo };
const tip = { contentStyle: { background: "oklch(var(--card))", border: "1px solid oklch(var(--border))", borderRadius: 8, color: "oklch(var(--foreground))" } };

export const rotationLabel = (ev: RotationEvaluation) => `${ev.score.rank}. ${STRATEGY_LABELS[ev.rotation.strategy]}`;

/** Cada barra es el puntaje total de una rotación, partido en lo que aporta cada componente (puntaje × peso). */
export function ContributionChart({ evaluations, weights }: { evaluations: RotationEvaluation[]; weights: Weights }) {
  const rows = evaluations.map((ev) => {
    const c = contributions(ev, weights);
    return { name: rotationLabel(ev), total: ev.score.total ?? 0, ...Object.fromEntries(c.map((x) => [x.key, Math.round(x.points * 10) / 10])) } as Record<string, string | number>;
  });
  return (
    <ChartFrame
      title={tr("Cuántos puntos aporta cada componente al total", "How many points each component adds to the total")}
      caption={tr("Cada barra es el puntaje total de una rotación. Los tramos muestran cuánto aporta agua (A), suelo (S), riesgo (R), ingreso (I) y sostenibilidad (E), según el peso que le diste a cada uno.", "Each bar is a rotation's total score. The segments show how much water (A), soil (S), risk (R), income (I) and sustainability (E) contribute, based on the weight you gave each one.")}
      height={Math.max(260, rows.length * 52 + 70)}
      table={{ headers: [tr("Rotación", "Rotation"), "Total", ...COMPONENT_ORDER.map((k) => `${k} ${COMPONENTS[k].short} (${tr("puntos", "points")})`)], rows: rows.map((r) => [String(r.name), num(Number(r.total), 1), ...COMPONENT_ORDER.map((k) => num(Number(r[k]), 1))]) }}
    >
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, bottom: 0, left: 8 }}>
        <CartesianGrid stroke="currentColor" strokeOpacity={0.15} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fill: "currentColor", fontSize: 12 }} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fill: "currentColor", fontSize: 12 }} />
        <Tooltip {...tip} formatter={(v: unknown, n: unknown) => [`${num(Number(v), 1)} puntos`, COMPONENTS[String(n) as ScoreComponentKey]?.name ?? String(n)]} />
        <Legend itemSorter={(item) => COMPONENT_ORDER.indexOf(String(item.value) as ScoreComponentKey)} formatter={(v: string) => `${v} · ${COMPONENTS[v as ScoreComponentKey]?.short ?? v}`} />
        {COMPONENT_ORDER.map((k) => (
          <Bar key={k} isAnimationActive={false} dataKey={k} name={k} stackId="total" fill={COLORS[k]} stroke="oklch(var(--background))" strokeWidth={1}>
            <LabelList dataKey={k} position="center" fill="#fff" fontSize={11} fontWeight={700} formatter={(v: unknown) => (Number(v) >= 6 ? `${k} ${num(Number(v))}` : "")} />
          </Bar>
        ))}
      </BarChart>
    </ChartFrame>
  );
}
