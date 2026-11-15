"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { LoginNotConfigured } from "@/components/auth/login-not-configured";
import { useT } from "@/components/i18n/lang-provider";
import { StartLink } from "@/components/layout/profile-chip";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Tarjeta de la portada: crear cuenta. Si el sitio no tiene Supabase configurado, el formulario se ve
 * igual pero avisa y ofrece seguir sin cuenta (la app funciona y guarda en el navegador).
 */
export function HeroAccount() {
  const t = useT();
  const { configured, user, signUp } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setError(null);
    setOk(null);
    if (!form.nombre.trim() || !form.email.includes("@") || form.password.length < 6) {
      setError(t("Completá tu nombre, un correo válido y una contraseña de 6 caracteres o más.", "Enter your name, a valid email and a password of at least 6 characters."));
      return;
    }
    setBusy(true);
    try {
      const r = await signUp(form.email, form.password, form.nombre.trim());
      if (r.error) setError(r.error);
      else if (r.needsEmailConfirm) setOk(t("Te enviamos un correo para confirmar la cuenta. Después iniciá sesión.", "We sent you an email to confirm your account. Then sign in."));
      else router.push("/ingresar");
    } catch {
      setError(t("No se pudo conectar. Probá de nuevo en un momento.", "Could not connect. Please try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  const lookLinks = (
    <p className="text-center text-sm text-muted-foreground">
      {t("¿Solo querés mirar?", "Just want to look around?")}{" "}
      <Link href="/zonas" className="font-semibold text-primary hover:underline">{t("Explorar regiones", "Explore regions")}</Link>
      {!user && (
        <>
          {" · "}
          <Link href="/cuenta" className="font-semibold text-primary hover:underline">{t("Ya tengo cuenta", "I have an account")}</Link>
        </>
      )}
    </p>
  );

  if (user) {
    return (
      <Card id="registro" className="animate-rise scroll-mt-24">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold">{t("Hola de nuevo", "Welcome back")}</h2>
            <p className="text-sm text-muted-foreground">{t("Seguí con tus campos y tu huerta.", "Continue with your fields and your garden.")}</p>
          </div>
          <Button size="lg" asChild className="w-full">
            <StartLink>{t("Empezar", "Start")} <ArrowRight aria-hidden /></StartLink>
          </Button>
          {lookLinks}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="registro" className="animate-rise scroll-mt-24">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold">{t("Creá tu cuenta", "Create your account")}</h2>
          <p className="text-sm text-muted-foreground">{t("Gratis para productores. Empezá en menos de un minuto.", "Free for farmers. Get started in under a minute.")}</p>
        </div>
        {!configured && <LoginNotConfigured />}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="hero-nombre">{t("Nombre", "Name")}</Label>
            <Input id="hero-nombre" autoComplete="name" placeholder={t("Juan Pérez", "Jane Smith")} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-email">Email</Label>
            <Input id="hero-email" type="email" autoComplete="email" placeholder={t("juan@campo.com.ar", "jane@farm.com")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-password">{t("Contraseña", "Password")}</Label>
            <Input id="hero-password" type="password" autoComplete="new-password" placeholder={t("Mínimo 6 caracteres", "At least 6 characters")} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          {ok && <Alert tone="success">{ok}</Alert>}
          <Button type="submit" size="lg" className="w-full" disabled={busy || !configured}>
            {busy ? t("Creando la cuenta…", "Creating your account…") : <>{t("Crear cuenta", "Create account")} <ArrowRight aria-hidden /></>}
          </Button>
        </form>
        {!configured && (
          <Button size="lg" variant="outline" asChild className="w-full">
            <StartLink>{t("Empezar sin cuenta", "Start without an account")} <ArrowRight aria-hidden /></StartLink>
          </Button>
        )}
        {lookLinks}
      </CardContent>
    </Card>
  );
}
