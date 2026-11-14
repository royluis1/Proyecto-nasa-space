"use client";

import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AsyncState } from "@/hooks/use-async";

interface Props<T> {
  state: AsyncState<T>;
  /** Qué se está cargando, para el mensaje de espera y de error. */
  what: string;
  skeleton?: React.ReactNode;
  /** Si devuelve true, se muestra el estado vacío en lugar de los hijos. */
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  children: (data: T) => React.ReactNode;
}

/** Estados de carga, error con reintento y vacío para un bloque de datos. */
export function AsyncBlock<T>({ state, what, skeleton, isEmpty, emptyMessage, children }: Props<T>) {
  if (state.error && !state.data) {
    return (
      <Alert tone="error" title={`No pudimos cargar ${what}`}>
        <p>{state.error}</p>
        <Button size="sm" variant="outline" onClick={state.reload}>
          <RefreshCw aria-hidden /> Reintentar
        </Button>
      </Alert>
    );
  }
  if (!state.data) {
    return (
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando {what}…</span>
        {skeleton ?? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
      </div>
    );
  }
  if (isEmpty?.(state.data)) {
    return (
      <Alert tone="info" title="Sin datos">
        <p>{emptyMessage ?? `Todavía no hay ${what}.`}</p>
      </Alert>
    );
  }
  return (
    <div aria-busy={state.loading}>
      {state.error && (
        <Alert tone="warning" title="No se pudo actualizar" className="mb-3">
          <p>{state.error} Se muestran los últimos datos que se pudieron cargar.</p>
          <Button size="sm" variant="outline" onClick={state.reload}>
            <RefreshCw aria-hidden /> Reintentar
          </Button>
        </Alert>
      )}
      {children(state.data)}
    </div>
  );
}
