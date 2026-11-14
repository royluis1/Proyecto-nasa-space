"use client";

import { RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useBackendStatus } from "@/hooks/use-backend-status";
import { DEMO_NOTICE } from "@/lib/content";

/** Aparece cuando el servidor no respondió y se están mostrando datos de ejemplo. */
export function BackendBanner() {
  const { demo } = useBackendStatus();
  if (!demo) return null;
  return (
    <div role="region" aria-label="Estado de la conexión" className="container pt-4 print:hidden">
      <Alert tone="warning" title="Sin conexión con el servidor: datos de ejemplo">
        <p>{DEMO_NOTICE}</p>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden /> Reintentar conexión
        </Button>
      </Alert>
    </div>
  );
}
