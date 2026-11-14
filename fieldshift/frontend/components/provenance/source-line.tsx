import { CalendarClock, Database, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SourceInfo } from "@/types/api";

const KIND_TEXT: Record<SourceInfo["kind"], string> = {
  modelado: "modelado",
  observado: "observado",
  "pronóstico": "pronóstico",
  estimado: "estimado",
  supuesto: "supuesto",
};

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "sin fecha";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "sin fecha" : d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Fuente, fecha de consulta y tipo de un dato, siempre visibles. Si no es de la NASA, se aclara. */
export function SourceLine({ source, demo = false, className }: { source: SourceInfo; demo?: boolean; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1"><Database aria-hidden className="size-4" /> Fuente: <strong className="text-foreground">{source.name}</strong></span>
      <span className="inline-flex items-center gap-1"><CalendarClock aria-hidden className="size-4" /> Consultado: {formatDateTime(source.retrieved_at)}</span>
      <span className="inline-flex items-center gap-1"><Tag aria-hidden className="size-4" /> Tipo: {KIND_TEXT[source.kind]}</span>
      {!source.is_nasa && <Badge variant="outline">No es un dato de la NASA</Badge>}
      {demo ? <Badge variant="alerta">DATOS DE EJEMPLO</Badge> : source.origin_label ? <Badge variant="outline">{source.origin_label}</Badge> : null}
      {source.detail && <span className="basis-full text-xs">{source.detail}</span>}
    </p>
  );
}
