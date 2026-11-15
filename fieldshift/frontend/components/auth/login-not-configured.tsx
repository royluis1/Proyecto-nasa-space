"use client";

import { useT } from "@/components/i18n/lang-provider";
import { Alert } from "@/components/ui/alert";

/** Aviso cuando el sitio no tiene cargadas las claves de Supabase: el formulario se ve, pero no envía. */
export function LoginNotConfigured() {
  const t = useT();
  return (
    <Alert tone="info" title={t("El login todavía no está conectado en este sitio", "Sign-in is not connected on this site yet")}>
      <p>
        {t(
          "Falta cargar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel y volver a desplegar. Mientras tanto AgroOrbit funciona sin cuenta y los campos se guardan en este navegador.",
          "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY still need to be set in Vercel, followed by a redeploy. Meanwhile AgroOrbit works without an account and fields are saved in this browser.",
        )}
      </p>
    </Alert>
  );
}
