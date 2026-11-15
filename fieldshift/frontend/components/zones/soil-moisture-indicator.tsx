"use client";

import { Info } from "lucide-react";
import { AsyncBlock } from "@/components/async-block";
import { Badge } from "@/components/ui/badge";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { ApiResult, FieldSoilMoisture, SoilMoistureProduct } from "@/types/api";
import { appLocale, tr } from "@/lib/i18n";
import { LABEL_INFO } from "@/lib/format";
import type { DataLabel } from "@/types/api";

const fmtDate = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(appLocale(), { day: "numeric", month: "long", year: "numeric" }) : tr("sin dato", "no data"));

function Spark({ p }: { p: SoilMoistureProduct }) {
  const vals = p.recent.map((x) => x.value).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${28 - ((v - min) / span) * 26}`).join(" ");
  return (
    <svg aria-hidden viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full text-agua-600 dark:text-info">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Product({ p, demo }: { p: SoilMoistureProduct; demo: boolean }) {
  return (
    <article className="space-y-1 rounded-[1rem] border p-4">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {p.product.startsWith("SPL3") ? tr("Superficie (SMAP L3)", "Surface (SMAP L3)") : tr("Zona de raíces (SMAP L4)", "Root zone (SMAP L4)")}
        <Badge variant={p.label === "observado" ? "cultivo" : "agua"}>{LABEL_INFO[p.label as DataLabel]?.text ?? p.label}</Badge>
        <Badge variant={demo || p.origin === "sample" ? "alerta" : "outline"}>{demo ? tr("DATOS DE EJEMPLO", "SAMPLE DATA") : p.origin_label}</Badge>
      </p>
      <p className="text-sm text-muted-foreground">{p.depth} · {tr("píxel de", "pixel of")} {p.resolution}</p>
      <p>{tr("Última observación disponible:", "Latest available observation:")} <strong>{fmtDate(p.last_observation)}</strong>{p.last_value != null && <> · {p.last_value.toLocaleString(appLocale())} {p.units}</>}</p>
      <p className="text-lg font-medium">{p.reading}</p>
      <Spark p={p} />
      <p className="sr-only">{tr(`Serie de los últimos ${p.recent.length} datos disponibles.`, `Series of the last ${p.recent.length} available values.`)}</p>
    </article>
  );
}

/** Humedad del suelo satelital del lote: contexto regional, última observación disponible (no tiempo real). */
export function SoilMoistureIndicator({ fieldId }: { fieldId: string }) {
  const s = useAsync<ApiResult<FieldSoilMoisture>>((signal) => api.fieldSoilMoisture(fieldId, { signal }), [fieldId]);
  return (
    <AsyncBlock state={s} what={tr("la humedad del suelo satelital", "satellite soil moisture")}>
      {(r) => (
        <section aria-labelledby="hum-sat" className="space-y-3">
          <h3 id="hum-sat" className="text-lg font-semibold">{r.data.title}</h3>
          <p className="flex gap-2 text-sm text-muted-foreground"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />{r.data.context}</p>
          <div className="grid gap-3 md:grid-cols-2">{r.data.products.map((p) => <Product key={p.product} p={p} demo={r.demo} />)}</div>
          <p className="text-sm text-muted-foreground">{r.data.sensors}</p>
        </section>
      )}
    </AsyncBlock>
  );
}
