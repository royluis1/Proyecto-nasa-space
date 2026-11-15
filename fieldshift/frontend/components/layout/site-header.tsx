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
import type { T } from "@/lib/i18n";
import { useT } from "@/components/i18n/lang-provider";
import { PUBLIC_NAV_HREFS } from "@/lib/nav";
import { LangToggle } from "@/components/i18n/lang-toggle";
import { Logo } from "./logo";
import { ProfileChip } from "./profile-chip";
import { ThemeToggle } from "./theme-toggle";

// Header público (sin perfil elegido): solo "Cómo funciona" (PUBLIC_NAV_HREFS). Regiones, Mis campos y Metodología
// van en el footer mientras los menús por perfil (otros prompts) no estén; con perfil se muestra además el chip.
const LABELS: Record<(typeof PUBLIC_NAV_HREFS)[number], (t: T) => string> = {
  "/como-funciona": (t) => t("Cómo funciona", "How it works"),
};

const links = (t: T) => PUBLIC_NAV_HREFS.map((href) => ({ href, label: LABELS[href](t) }));

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Botón del header: "Registro" (/cuenta). Si la persona ya tiene sesión, no se muestra (está el AccountChip). */
function MainAction({ className }: { className?: string }) {
  const t = useT();
  const { configured, user } = useAuth();
  if (configured && user) return null;
  return (
    <Button asChild size="sm" className={cn("h-9 px-4", className)}>
      <Link href="/cuenta">{t("Registro", "Sign up")}</Link>
    </Button>
  );
}

export function SiteHeader() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const navLinks = links(t);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md print:static print:hidden">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-8 lg:flex" aria-label={t("Principal", "Main")}>
          {navLinks.map(({ href, label }) => (
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
          <LangToggle className="hidden sm:inline-flex" />
          <ThemeToggle />
          {/* Menú del celular y la tablet: panel que se abre desde la derecha */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label={t("Abrir menú", "Open menu")}>
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">{t("Menú", "Menu")}</SheetTitle>
              <nav className="mt-8 flex flex-col gap-1" aria-label={t("Menú", "Menu")}>
                {navLinks.map(({ href, label }) => (
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
                <div className="mt-3 flex flex-col items-start gap-3 border-t pt-4">
                  <ProfileChip />
                  <LangToggle className="sm:hidden" />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
