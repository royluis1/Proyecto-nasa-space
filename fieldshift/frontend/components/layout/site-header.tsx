"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { AccountChip } from "@/components/auth/account-chip";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
          {/* Menú del celular y la tablet: panel que se abre desde la derecha */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Menú</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Menú">
                {links.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(pathname, href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-lg px-3 text-base font-medium",
                      isActive(pathname, href) ? "bg-secondary text-foreground" : "text-foreground hover:bg-muted",
                    )}
                  >
                    {label}
                  </Link>
                ))}
                <div className="mt-3 border-t pt-4">
                  <ProfileChip />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
