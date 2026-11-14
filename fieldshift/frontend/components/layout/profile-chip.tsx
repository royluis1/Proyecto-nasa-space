"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { PROFILES } from "@/lib/profile";
import { useProfile } from "@/hooks/use-profile";

/** Perfil actual y acceso para cambiarlo. */
export function ProfileChip() {
  const profile = useProfile();
  return (
    <Link
      href="/ingresar"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold hover:bg-accent"
      aria-label={profile ? `Perfil: ${PROFILES[profile].label}. Cambiar perfil` : "Elegir perfil"}
    >
      {profile ? <span aria-hidden className="text-lg">{PROFILES[profile].icon}</span> : <UserRound aria-hidden className="size-4" />}
      {profile ? PROFILES[profile].label : "Elegir perfil"}
      {profile && <span className="text-muted-foreground">· Cambiar</span>}
    </Link>
  );
}

/** Botón de inicio: si no eligió perfil, primero lo elige. */
export function StartLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const profile = useProfile();
  return <Link href={profile ? "/campos" : "/ingresar"} className={className}>{children}</Link>;
}
