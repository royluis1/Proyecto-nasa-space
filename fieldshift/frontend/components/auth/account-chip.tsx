"use client";

import Link from "next/link";
import { LogIn, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

/** Acceso a la cuenta en el encabezado. No se muestra si Supabase no está configurado. */
export function AccountChip() {
  const { configured, user, loading } = useAuth();
  if (!configured) return null;

  const name = (user?.user_metadata?.nombre as string | undefined) || user?.email?.split("@")[0];

  return (
    <Link
      href="/cuenta"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold hover:bg-accent"
      aria-label={user ? `Tu cuenta: ${name}` : undefined}
    >
      {user ? <UserRound aria-hidden className="size-4" /> : <LogIn aria-hidden className="size-4" />}
      {loading ? "…" : user ? <span className="max-w-[9rem] truncate">{name}</span> : "Entrar"}
    </Link>
  );
}
