"use client";

import Link from "next/link";
import { LogIn, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useT } from "@/components/i18n/lang-provider";

/** Acceso a la cuenta en el encabezado. Se ve siempre; si falta Supabase, la página de cuenta lo explica. */
export function AccountChip() {
  const t = useT();
  const { configured, user, loading } = useAuth();
  const name = (user?.user_metadata?.nombre as string | undefined) || user?.email?.split("@")[0];

  return (
    <Link
      href="/cuenta"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold hover:bg-accent"
      aria-label={user ? t(`Tu cuenta: ${name}`, `Your account: ${name}`) : undefined}
    >
      {user ? <UserRound aria-hidden className="size-4" /> : <LogIn aria-hidden className="size-4" />}
      {configured && loading ? "…" : user ? <span className="max-w-[9rem] truncate">{name}</span> : t("Entrar", "Sign in")}
    </Link>
  );
}
