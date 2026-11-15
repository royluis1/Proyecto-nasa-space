"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { PROFILES, startHref } from "@/lib/profile";
import { useProfile } from "@/hooks/use-profile";
import { useT } from "@/components/i18n/lang-provider";

/** Perfil actual y acceso para cambiarlo. */
export function ProfileChip() {
  const t = useT();
  const profile = useProfile();
  return (
    <Link
      href="/ingresar"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold hover:bg-accent"
      aria-label={profile ? t(`Perfil: ${PROFILES[profile].label}. Cambiar perfil`, `Profile: ${PROFILES[profile].label}. Change profile`) : t("Elegir perfil", "Choose profile")}
    >
      {profile ? <span aria-hidden className="text-lg">{PROFILES[profile].icon}</span> : <UserRound aria-hidden className="size-4" />}
      {profile ? PROFILES[profile].label : t("Elegir perfil", "Choose profile")}
      {profile && <span className="text-muted-foreground">· {t("Cambiar", "Change")}</span>}
    </Link>
  );
}

/** Botón de inicio: si no eligió perfil, primero lo elige. */
export function StartLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const profile = useProfile();
  return <Link href={startHref(profile)} className={className}>{children}</Link>;
}
