"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { StartLink } from "@/components/layout/profile-chip";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Tarjeta de la portada. Con Supabase configurado: crear cuenta de verdad.
 * Sin Supabase: entrar sin cuenta (la app funciona igual y guarda en el navegador).
 */
export function HeroAccount() {
  const { configured, user, signUp } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!form.nombre.trim() || !form.email.includes("@") || form.password.length < 6) {
      setError("Completá tu nombre, un correo válido y una contraseña de 6 caracteres o más.");
      return;
    }
    setBusy(true);
    try {
      const r = await signUp(form.email, form.password, form.nombre.trim());
      if (r.error) setError(r.error);
      else if (r.needsEmailConfirm) setOk("Te enviamos un correo para confirmar la cuenta. Después iniciá sesión.");
      else router.push("/ingresar");
    } catch {
      setError("No se pudo conectar. Probá de nuevo en un momento.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured || user) {
    return (
      <Card id="registro" className="animate-rise scroll-mt-24">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold">{user ? "Hola de nuevo" : "Empezá ahora"}</h2>
            <p className="text-sm text-muted-foreground">
              {user ? "Seguí con tus campos y tu huerta." : "Gratis para productores. Elegí si tenés un campo o una huerta y listo."}
            </p>
          </div>
          <Button size="lg" asChild className="w-full">
            <StartLink>Empezar <ArrowRight aria-hidden /></StartLink>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Solo querés mirar?{" "}
            <Link href="/zonas" className="font-semibold text-primary hover:underline">Explorar regiones</Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="registro" className="animate-rise scroll-mt-24">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold">Creá tu cuenta</h2>
          <p className="text-sm text-muted-foreground">Gratis para productores. Empezá en menos de un minuto.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="hero-nombre">Nombre</Label>
            <Input id="hero-nombre" autoComplete="name" placeholder="Juan Pérez" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-email">Email</Label>
            <Input id="hero-email" type="email" autoComplete="email" placeholder="juan@campo.com.ar" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-password">Contraseña</Label>
            <Input id="hero-password" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          {ok && <Alert tone="success">{ok}</Alert>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Creando la cuenta…" : <>Crear cuenta <ArrowRight aria-hidden /></>}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          ¿Solo querés mirar?{" "}
          <Link href="/zonas" className="font-semibold text-primary hover:underline">Explorar regiones</Link>
          {" · "}
          <Link href="/cuenta" className="font-semibold text-primary hover:underline">Ya tengo cuenta</Link>
        </p>
      </CardContent>
    </Card>
  );
}
