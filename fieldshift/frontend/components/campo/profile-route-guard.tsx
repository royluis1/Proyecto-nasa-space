"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PROFILES } from "@/lib/profile";
import { useProfile } from "@/hooks/use-profile";

// Pantallas solo del perfil agricultor (hectáreas). Huerta no las ve: se la lleva a "Mi huerta".
const AGRICULTOR_ONLY = ["perfil", "comparador", "dashboard", "calendario", "escenarios", "diagnostico", "reporte", "rotacion"];

export function ProfileRouteGuard({ fieldId, children }: { fieldId: string; children: React.ReactNode }) {
  const profile = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const after = pathname?.split(`/campo/${encodeURIComponent(fieldId)}/`)[1] ?? pathname?.split(`/campo/${fieldId}/`)[1] ?? "";
  const segment = after.split("/")[0];
  const blocked = profile === "huerta" && AGRICULTOR_ONLY.includes(segment);
  useEffect(() => {
    if (blocked) router.replace(PROFILES.huerta.home(fieldId));
  }, [blocked, fieldId, router]);
  if (blocked) return null;
  return <>{children}</>;
}
