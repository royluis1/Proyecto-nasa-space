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
import { ProfileMenuMobile, ProfileMenuSidebar } from "./profile-menu";
import { useCampo } from "./campo-provider";
import { useT } from "@/components/i18n/lang-provider";
import { useProfile } from "@/hooks/use-profile";

/** Encabezado del campo (nombre, ubicación, origen de los datos) y navegación por pasos. */
export function CampoShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const profile = useProfile();
  const { field, fieldLoading, fieldError, reloadField, fieldId, compare } = useCampo();

  if (fieldError && !field) {
    return (
      <Alert tone="error" title={t("No pudimos abrir este campo", "We couldn't open this field")}>
        <p>{fieldError}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={reloadField}>
            <RefreshCw aria-hidden /> {t("Reintentar", "Retry")}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/campos">{t("Elegir otro campo", "Choose another field")}</Link>
          </Button>
        </div>
      </Alert>
    );
  }
  if (fieldLoading || !field) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">{t("Cargando el campo…", "Loading the field…")}</span>
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const isExample = Boolean(field.sample_note);
  const showProfileMenu = profile === "agricultor";
  return (
    <div className="space-y-5">
      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-lg font-semibold">{field.name}</p>
          <span className="text-sm text-muted-foreground">
            {num(field.area_ha)} ha · {num(field.location.lat, 2)}, {num(field.location.lon, 2)} · {field.irrigated ? t("con riego", "irrigated") : t("secano", "rainfed")}
          </span>
          {isExample && <Badge variant="tierra" title={field.sample_note ?? undefined}>{t("Campo de ejemplo: datos ilustrativos", "Example field: illustrative data")}</Badge>}
          {compare.originLabel && !compare.demo && compare.result && <OriginBadge status={compare.result.inputs.climate.origin} label={`${t("Clima", "Weather")}: ${compare.originLabel}`} />}
          {compare.demo && <OriginBadge status="demo" />}
          <FieldToolsMenu fieldId={fieldId} fieldName={field.name} />
          {showProfileMenu && (
            <div className="lg:hidden ml-auto">
              <ProfileMenuMobile fieldId={fieldId} />
            </div>
          )}
        </div>
        <FieldNav fieldId={fieldId} />
      </div>
      {showProfileMenu ? (
        <div className="flex items-start gap-6">
          <ProfileMenuSidebar fieldId={fieldId} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
