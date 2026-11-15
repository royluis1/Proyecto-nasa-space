"use client";

import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

interface AuthResult {
  error?: string;
  /** true cuando el registro deja un correo de confirmación pendiente. */
  needsEmailConfirm?: boolean;
}

interface AuthValue {
  user: User | null;
  session: Session | null;
  /** true mientras se resuelve la sesión inicial. */
  loading: boolean;
  /** true si Supabase está configurado (hay URL y clave). */
  configured: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, nombre?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthValue | null>(null);

/** Traduce los errores de Supabase a algo claro en español. */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ese correo ya tiene una cuenta. Probá iniciar sesión.";
  if (m.includes("password should be at least")) return "La contraseña es muy corta (mínimo 6 caracteres).";
  if (m.includes("email not confirmed")) return "Todavía no confirmaste el correo. Revisá tu casilla.";
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "Ese correo no parece válido.";
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = React.useCallback<AuthValue["signIn"]>(async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) return { error: "El login todavía no está configurado." };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: friendlyError(error.message) } : {};
  }, []);

  const signUp = React.useCallback<AuthValue["signUp"]>(async (email, password, nombre) => {
    const supabase = getSupabase();
    if (!supabase) return { error: "El registro todavía no está configurado." };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: nombre ? { nombre } : undefined },
    });
    if (error) return { error: friendlyError(error.message) };
    // Si Supabase pide confirmar el correo, hay usuario pero no sesión.
    return { needsEmailConfirm: Boolean(data.user) && !data.session };
  }, []);

  const signOut = React.useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    loading,
    configured: isSupabaseConfigured,
    signIn,
    signUp,
    signOut,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Estado de autenticación y acciones (login, registro, salir). */
export function useAuth(): AuthValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
