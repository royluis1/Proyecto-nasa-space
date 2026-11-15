import { LabelBadge, OriginBadge } from "@/components/provenance/badges";
import { num } from "@/lib/format";
import type { DataTrace, OriginStatus } from "@/types/api";
import { appLocale, tr } from "@/lib/i18n";

interface Quality {
  valid_pct: number;
  valid: number;
  records: number;
  bad_quality: number;
}

const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(appLocale(), { day: "numeric", month: "long", year: "numeric" }) : "—");

/** Trazabilidad de un bloque de datos satelitales: fuente, producto, fechas, resolución, estado y limitaciones. */
export function TraceInfo({ trace, quality, demo }: { trace: DataTrace; quality?: Quality; demo?: boolean }) {
  const status: OriginStatus = demo ? "demo" : trace.status;
  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <OriginBadge status={status} />
        <LabelBadge label={trace.label} />
      </div>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <div><dt className="inline font-medium">{tr("Fuente: ", "Source: ")}</dt><dd className="inline">{trace.source}</dd></div>
        <div><dt className="inline font-medium">{tr("Producto: ", "Product: ")}</dt><dd className="inline">{trace.product}</dd></div>
        <div><dt className="inline font-medium">{tr("Resolución: ", "Resolution: ")}</dt><dd className="inline">{trace.spatial_resolution} · {trace.temporal_resolution}</dd></div>
        {trace.depth && <div><dt className="inline font-medium">{tr("Profundidad: ", "Depth: ")}</dt><dd className="inline">{trace.depth}</dd></div>}
        <div><dt className="inline font-medium">{tr("Período: ", "Period: ")}</dt><dd className="inline">{date(trace.period_start)} {tr("a", "to")} {date(trace.period_end)}</dd></div>
        <div><dt className="inline font-medium">{tr("Último dato: ", "Latest data: ")}</dt><dd className="inline">{date(trace.last_observation)}</dd></div>
        <div><dt className="inline font-medium">{tr("Obtenido el: ", "Retrieved on: ")}</dt><dd className="inline">{date(trace.retrieved_at)}</dd></div>
        {trace.pixel_site && <div><dt className="inline font-medium">{tr("Sitio de la muestra: ", "Sample site: ")}</dt><dd className="inline">{trace.pixel_site}</dd></div>}
        {quality && (
          <div>
            <dt className="inline font-medium">{tr("Calidad: ", "Quality: ")}</dt>
            <dd className="inline">{num(quality.valid_pct, 0)} % {tr("de datos válidos", "valid data")} ({num(quality.valid)} {tr("de", "of")} {num(quality.records)}{quality.bad_quality ? tr(`; ${num(quality.bad_quality)} descartados por nubes o mala calidad`, `; ${num(quality.bad_quality)} discarded for clouds or poor quality`) : ""})</dd>
          </div>
        )}
      </dl>
      <details>
        <summary className="cursor-pointer font-medium">Limitaciones y cita</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {trace.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">{trace.citation}</p>
      </details>
    </div>
  );
}
