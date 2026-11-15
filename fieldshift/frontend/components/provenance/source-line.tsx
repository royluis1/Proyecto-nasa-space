import { CalendarClock, Database, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SourceInfo } from "@/types/api";
import { appLocale, L, localize, tr } from "@/lib/i18n";

const KIND_TEXT: Record<SourceInfo["kind"], string> = localize({
  modelado: L("modelado", "modeled"),
  observado: L("observado", "observed"),
  "pronóstico": L("pronóstico", "forecast"),
  estimado: L("estimado", "estimated"),
  supuesto: L("supuesto", "assumed"),
});

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return tr("sin fecha", "no date");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? tr("sin fecha", "no date") : d.toLocaleString(appLocale(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Fuente, fecha de consulta y tipo de un dato, siempre visibles. Si no es de la NASA, se aclara. */
export function SourceLine({ source, demo = false, className }: { source: SourceInfo; demo?: boolean; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1"><Database aria-hidden className="size-4" /> {tr("Fuente", "Source")}: <strong className="text-foreground">{source.name}</strong></span>
      <span className="inline-flex items-center gap-1"><CalendarClock aria-hidden className="size-4" /> {tr("Consultado", "Retrieved")}: {formatDateTime(source.retrieved_at)}</span>
      <span className="inline-flex items-center gap-1"><Tag aria-hidden className="size-4" /> {tr("Tipo", "Type")}: {KIND_TEXT[source.kind]}</span>
      {!source.is_nasa && <Badge variant="outline">{tr("No es un dato de la NASA", "Not NASA data")}</Badge>}
      {demo ? <Badge variant="alerta">{tr("DATOS DE EJEMPLO", "SAMPLE DATA")}</Badge> : source.origin_label ? <Badge variant="outline">{source.origin_label}</Badge> : null}
      {source.detail && <span className="basis-full text-xs">{source.detail}</span>}
    </p>
  );
}
