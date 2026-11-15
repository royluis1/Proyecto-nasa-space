"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { AccountChip } from "@/components/auth/account-chip";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ProfileChip, StartLink } from "./profile-chip";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/zonas", label: "Regiones" },
  { href: "/campos", label: "Mis campos" },
  { href: "/metodologia", label: "Metodología" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Botón principal: registrarse si hay cuentas; si no, empezar sin cuenta. */
function MainAction({ className }: { className?: string }) {
  const { configured, user } = useAuth();
  if (configured && !user) {
    return (
      <Button asChild size="sm" className={cn("h-9 px-4", className)}>
        <Link href="/#registro">Registrarse</Link>
      </Button>
    );
  }
  if (configured && user) return null;
  return (
    <Button asChild size="sm" className={cn("h-9 px-4", className)}>
      <StartLink>Empezar</StartLink>
    </Button>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  // Cerrar el menú del celular al cambiar de página o con Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md print:static print:hidden">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                isActive(pathname, href) ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            <ProfileChip />
          </div>
          <AccountChip />
          <MainAction />
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden /> : <Menu aria-hidden />}
          </Button>
        </div>
      </div>

      {/* Menú del celular */}
      <div id={menuId} hidden={!open} className="border-t border-border/60 bg-background lg:hidden">
        <nav className="container flex flex-col gap-1 py-4" aria-label="Menú">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-lg px-3 text-base font-medium",
                isActive(pathname, href) ? "bg-secondary text-foreground" : "text-foreground hover:bg-muted",
              )}
            >
              {label}
            </Link>
          ))}
          <div className="mt-2 border-t pt-3">
            <ProfileChip />
          </div>
        </nav>
      </div>
    </header>
  );
}
