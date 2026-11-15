"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "entrar" | "registro";

export default function CuentaPage() {
  const { user, loading, configured, signIn, signUp, signOut } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Supabase todavía no configurado: la app funciona igual, solo que sin login.
  if (!configured) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader title="Cuenta" description="Para guardar tus lotes y su historial entre dispositivos." />
        <Alert tone="info" title="El login todavía no está activado">
          <p>
            AgroOrbit funciona sin cuenta: podés ver los datos de la NASA y los campos de ejemplo. El registro con correo se activa
            cuando se conecte Supabase. Mientras tanto, los campos que cargues se guardan en este navegador.
          </p>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-muted-foreground">Cargando…</p>
      </div>
    );
  }

  // Ya hay sesión iniciada.
  if (user) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader title="Tu cuenta" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound aria-hidden className="size-5" /> Sesión iniciada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Entraste como <strong>{user.email}</strong>. Tus lotes y su historial se guardan en tu cuenta.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/campos">Ir a mis campos</Link>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  router.refresh();
                }}
              >
                <LogOut aria-hidden /> Cerrar sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        else if (r.needsEmailConfirm) setOk("Te enviamos un correo para confirmar la cuenta. Revisá tu casilla y después iniciá sesión.");
        else router.push("/campos");
      }
    } catch {
      setError("No se pudo conectar. Probá de nuevo en un momento.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={mode === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
        description="Guardá tus lotes y su historial para tomar decisiones con el tiempo."
      />

      <div className="flex gap-2" role="tablist" aria-label="Entrar o registrarse">
        <Button variant={mode === "entrar" ? "default" : "outline"} role="tab" aria-selected={mode === "entrar"} onClick={() => { setMode("entrar"); setError(null); setOk(null); }}>
          Ya tengo cuenta
        </Button>
        <Button variant={mode === "registro" ? "default" : "outline"} role="tab" aria-selected={mode === "registro"} onClick={() => { setMode("registro"); setError(null); setOk(null); }}>
          Soy nuevo
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={submit} className="space-y-4">
            {mode === "registro" && (
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Tu nombre (opcional)</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" placeholder="Roy" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="vos@correo.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {error && <Alert tone="error">{error}</Alert>}
            {ok && <Alert tone="success">{ok}</Alert>}

            <Button type="submit" size="lg" disabled={busy} className="w-full">
              {busy ? "Un momento…" : mode === "entrar" ? "Entrar" : "Crear cuenta"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "entrar" ? (
          <>¿No tenés cuenta? <button type="button" className="font-medium text-primary underline" onClick={() => setMode("registro")}>Creá una</button></>
        ) : (
          <>¿Ya tenés cuenta? <button type="button" className="font-medium text-primary underline" onClick={() => setMode("entrar")}>Iniciá sesión</button></>
        )}
      </p>
    </div>
  );
}
