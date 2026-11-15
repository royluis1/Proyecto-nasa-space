"use client";

import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useBackendStatus } from "@/hooks/use-backend-status";
import { demoNotice } from "@/lib/content";
import { useT } from "@/components/i18n/lang-provider";

/** Aparece cuando el servidor no respondió y se están mostrando datos de ejemplo. */
export function BackendBanner() {
  const t = useT();
  const { demo } = useBackendStatus();
  if (!demo) return null;
  return (
    <div role="region" aria-label={t("Estado de la conexión", "Connection status")} className="container pt-4 print:hidden">
      <Alert tone="warning" title={t("Sin conexión con el servidor: datos de ejemplo", "No connection to the server: sample data")}>
        <p>{demoNotice()}</p>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden /> {t("Reintentar conexión", "Retry connection")}
        </Button>
      </Alert>
    </div>
  );
}
