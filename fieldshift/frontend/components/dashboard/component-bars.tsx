"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame } from "@/components/charts/chart-frame";
import { COMPONENTS, COMPONENT_ORDER, num } from "@/lib/format";
import type { RotationEvaluation } from "@/types/api";
import { PatternDefs, SERIES_STYLE, Swatch } from "./chart-patterns";
import { rotationLabel } from "./contribution-chart";
import { tr } from "@/lib/i18n";

const tip = { contentStyle: { background: "oklch(var(--card))", border: "1px solid oklch(var(--border))", borderRadius: 8, color: "oklch(var(--foreground))" } };

/** Barras agrupadas: para cada componente, una barra por rotación elegida (hasta 4), cada una con su trama. */
export function ComponentBars({ evaluations }: { evaluations: RotationEvaluation[] }) {
  const picked = evaluations.slice(0, SERIES_STYLE.length);
  const names = picked.map(rotationLabel);
  const rows: Record<string, string | number>[] = COMPONENT_ORDER.map((k) => ({
    componente: `${k} · ${COMPONENTS[k].short}`,
    ...Object.fromEntries(picked.map((e, i) => [names[i], e.score.components.find((c) => c.key === k)?.value ?? 0])),
  }));
  return (
    <div className="space-y-3">
      <ChartFrame
        title={tr("Cada rotación, componente por componente", "Each rotation, component by component")}
        caption={tr("Puntaje de 0 a 100 en cada aspecto. Cada rotación tiene su propia trama, además del color.", "Score from 0 to 100 on each aspect. Each rotation has its own pattern, in addition to color.")}
        height={320}
        table={{ headers: [tr("Componente", "Component"), ...names], rows: rows.map((r) => [String(r.componente), ...names.map((n) => num(Number(r[n])))]) }}
      >
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <PatternDefs prefix="cb" />
          <CartesianGrid stroke="currentColor" strokeOpacity={0.15} vertical={false} />
          <XAxis dataKey="componente" tick={{ fill: "currentColor", fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fill: "currentColor", fontSize: 12 }} width={36} />
          <Tooltip {...tip} formatter={(v: unknown) => num(Number(v))} />
          {names.map((n, i) => (
            <Bar key={n} isAnimationActive={false} dataKey={n} fill={`url(#cb-${i})`} stroke={SERIES_STYLE[i].color} strokeWidth={1.5} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ChartFrame>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label={tr("Referencias del gráfico", "Chart legend")}>
        {names.map((n, i) => (
          <li key={n} className="flex items-center gap-2">
            <Swatch index={i} id={`sw-cb-${i}`} /> {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
