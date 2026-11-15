"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OriginBadge } from "@/components/provenance/badges";
import { num } from "@/lib/format";
import { FieldNav } from "./field-nav";
import { FieldToolsMenu } from "./field-tools-menu";
import { useCampo } from "./campo-provider";

/** Encabezado del campo (nombre, ubicación, origen de los datos) y navegación por pasos. */
export function CampoShell({ children }: { children: React.ReactNode }) {
  const { field, fieldLoading, fieldError, reloadField, fieldId, compare } = useCampo();

  if (fieldError && !field) {
    return (
      <Alert tone="error" title="No pudimos abrir este campo">
        <p>{fieldError}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={reloadField}>
            <RefreshCw aria-hidden /> Reintentar
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/campos">Elegir otro campo</Link>
          </Button>
        </div>
      </Alert>
    );
  }
  if (fieldLoading || !field) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Cargando el campo…</span>
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const isExample = Boolean(field.sample_note);
  return (
    <div className="space-y-5">
      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-lg font-semibold">{field.name}</p>
          <span className="text-sm text-muted-foreground">
            {num(field.area_ha)} ha · {num(field.location.lat, 2)}, {num(field.location.lon, 2)} · {field.irrigated ? "con riego" : "secano"}
          </span>
          {isExample && <Badge variant="tierra" title={field.sample_note ?? undefined}>Campo de ejemplo: datos ilustrativos</Badge>}
          {compare.originLabel && !compare.demo && compare.result && <OriginBadge status={compare.result.inputs.climate.origin} label={`Clima: ${compare.originLabel}`} />}
          {compare.demo && <OriginBadge status="demo" />}
          <FieldToolsMenu fieldId={fieldId} fieldName={field.name} />
        </div>
        <FieldNav fieldId={fieldId} />
      </div>
      {children}
    </div>
  );
}
