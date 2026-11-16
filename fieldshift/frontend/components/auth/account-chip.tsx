"use client";

import Link from "next/link";
import { LogIn, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

/** Unified access button in the header. Shows account when signed in, otherwise "Sign in". */
export function AccountChip() {
  const { configured, user, loading } = useAuth();
  const name = (user?.user_metadata?.nombre as string | undefined) || user?.email?.split("@")[0];
  const signedIn = configured && !!user;

  return (
    <Link
      href="/cuenta"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold hover:bg-accent"
      aria-label={signedIn ? `Your account: ${name}` : "Sign in"}
    >
      {signedIn ? <UserRound aria-hidden className="size-4" /> : <LogIn aria-hidden className="size-4" />}
      {configured && loading ? "…" : signedIn ? <span className="max-w-[9rem] truncate">{name}</span> : "Sign in"}
    </Link>
  );
}
