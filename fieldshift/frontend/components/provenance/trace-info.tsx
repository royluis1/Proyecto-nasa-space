import { LabelBadge, OriginBadge } from "@/components/provenance/badges";
import { num } from "@/lib/format";
import type { DataTrace, OriginStatus } from "@/types/api";

interface Quality {
  valid_pct: number;
  valid: number;
  records: number;
  bad_quality: number;
}

const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "—");

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
        <div><dt className="inline font-medium">Fuente: </dt><dd className="inline">{trace.source}</dd></div>
        <div><dt className="inline font-medium">Producto: </dt><dd className="inline">{trace.product}</dd></div>
        <div><dt className="inline font-medium">Resolución: </dt><dd className="inline">{trace.spatial_resolution} · {trace.temporal_resolution}</dd></div>
        {trace.depth && <div><dt className="inline font-medium">Profundidad: </dt><dd className="inline">{trace.depth}</dd></div>}
        <div><dt className="inline font-medium">Período: </dt><dd className="inline">{date(trace.period_start)} a {date(trace.period_end)}</dd></div>
        <div><dt className="inline font-medium">Último dato: </dt><dd className="inline">{date(trace.last_observation)}</dd></div>
        <div><dt className="inline font-medium">Obtenido el: </dt><dd className="inline">{date(trace.retrieved_at)}</dd></div>
        {trace.pixel_site && <div><dt className="inline font-medium">Sitio de la muestra: </dt><dd className="inline">{trace.pixel_site}</dd></div>}
        {quality && (
          <div>
            <dt className="inline font-medium">Calidad: </dt>
            <dd className="inline">{num(quality.valid_pct, 0)} % de datos válidos ({num(quality.valid)} de {num(quality.records)}{quality.bad_quality ? `; ${num(quality.bad_quality)} descartados por nubes o mala calidad` : ""})</dd>
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
