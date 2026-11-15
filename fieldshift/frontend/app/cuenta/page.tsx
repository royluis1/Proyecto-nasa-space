"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { LoginNotConfigured } from "@/components/auth/login-not-configured";
import { useT } from "@/components/i18n/lang-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "entrar" | "registro";

export default function CuentaPage() {
  const t = useT();
  const { user, loading, configured, signIn, signUp, signOut } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (configured && loading) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-muted-foreground">{t("Cargando…", "Loading…")}</p>
      </div>
    );
  }

  // Ya hay sesión iniciada.
  if (user) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader title={t("Tu cuenta", "Your account")} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound aria-hidden className="size-5" /> {t("Sesión iniciada", "Signed in")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              {t("Entraste como", "Signed in as")} <strong>{user.email}</strong>.{" "}
              {t("Tus lotes y su historial se guardan en tu cuenta.", "Your fields and their history are saved to your account.")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/campos">{t("Ir a mis campos", "Go to my fields")}</Link>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  router.refresh();
                }}
              >
                <LogOut aria-hidden /> {t("Cerrar sesión", "Sign out")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setOk(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) return;
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      if (mode === "entrar") {
        const r = await signIn(email, password);
        if (r.error) setError(r.error);
        else router.push("/campos");
      } else {
        const r = await signUp(email, password, nombre || undefined);
        if (r.error) setError(r.error);
        else if (r.needsEmailConfirm)
          setOk(t("Te enviamos un correo para confirmar la cuenta. Revisá tu casilla y después iniciá sesión.", "We sent you an email to confirm your account. Check your inbox and then sign in."));
        else router.push("/campos");
      }
    } catch {
      setError(t("No se pudo conectar. Probá de nuevo en un momento.", "Could not connect. Please try again in a moment."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={mode === "entrar" ? t("Iniciar sesión", "Sign in") : t("Crear cuenta", "Create account")}
        description={t("Guardá tus lotes y su historial para tomar decisiones con el tiempo.", "Save your fields and their history to make decisions over time.")}
      />

      {!configured && <LoginNotConfigured />}

      <div className="flex gap-2" role="tablist" aria-label={t("Entrar o registrarse", "Sign in or sign up")}>
        <Button variant={mode === "entrar" ? "default" : "outline"} role="tab" aria-selected={mode === "entrar"} onClick={() => switchMode("entrar")}>
          {t("Ya tengo cuenta", "I have an account")}
        </Button>
        <Button variant={mode === "registro" ? "default" : "outline"} role="tab" aria-selected={mode === "registro"} onClick={() => switchMode("registro")}>
          {t("Soy nuevo", "I'm new")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={submit} className="space-y-4">
            {mode === "registro" && (
              <div className="space-y-1.5">
                <Label htmlFor="nombre">{t("Tu nombre (opcional)", "Your name (optional)")}</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" placeholder="Roy" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("Correo", "Email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder={t("vos@correo.com", "you@email.com")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("Contraseña", "Password")}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                placeholder={t("Mínimo 6 caracteres", "At least 6 characters")}
              />
            </div>

            {error && <Alert tone="error">{error}</Alert>}
            {ok && <Alert tone="success">{ok}</Alert>}

            <Button type="submit" size="lg" disabled={busy || !configured} className="w-full">
              {busy ? t("Un momento…", "One moment…") : mode === "entrar" ? t("Entrar", "Sign in") : t("Crear cuenta", "Create account")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "entrar" ? (
          <>{t("¿No tenés cuenta?", "Don't have an account?")} <button type="button" className="font-medium text-primary underline" onClick={() => switchMode("registro")}>{t("Creá una", "Create one")}</button></>
        ) : (
          <>{t("¿Ya tenés cuenta?", "Already have an account?")} <button type="button" className="font-medium text-primary underline" onClick={() => switchMode("entrar")}>{t("Iniciá sesión", "Sign in")}</button></>
        )}
      </p>
    </div>
  );
}
