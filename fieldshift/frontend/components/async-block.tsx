"use client";

import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AsyncState } from "@/hooks/use-async";
import { useT } from "@/components/i18n/lang-provider";

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
  const t = useT();
  if (state.error && !state.data) {
    return (
      <Alert tone="error" title={t(`No pudimos cargar ${what}`, `We couldn't load ${what}`)}>
        <p>{state.error}</p>
        <Button size="sm" variant="outline" onClick={state.reload}>
          <RefreshCw aria-hidden /> {t("Reintentar", "Retry")}
        </Button>
      </Alert>
    );
  }
  if (!state.data) {
    return (
      <div role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t("Cargando", "Loading")} {what}…</span>
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
      <Alert tone="info" title={t("Sin datos", "No data")}>
        <p>{emptyMessage ?? t(`Todavía no hay ${what}.`, `There is no ${what} yet.`)}</p>
      </Alert>
    );
  }
  return (
    <div aria-busy={state.loading}>
      {state.error && (
        <Alert tone="warning" title={t("No se pudo actualizar", "Could not update")} className="mb-3">
          <p>{state.error} {t("Se muestran los últimos datos que se pudieron cargar.", "Showing the last data that could be loaded.")}</p>
          <Button size="sm" variant="outline" onClick={state.reload}>
            <RefreshCw aria-hidden /> {t("Reintentar", "Retry")}
          </Button>
        </Alert>
      )}
      {children(state.data)}
    </div>
  );
}
