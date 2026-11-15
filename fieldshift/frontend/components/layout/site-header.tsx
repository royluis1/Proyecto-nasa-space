import Link from "next/link";
import { BookOpen, Home, Map, MapPinned, Sprout } from "lucide-react";
import { AccountChip } from "@/components/auth/account-chip";
import { ProfileChip } from "./profile-chip";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/campos", label: "Mis campos", icon: MapPinned },
  { href: "/zonas", label: "Mapa de zonas", icon: Map },
  { href: "/metodologia", label: "Metodología y fuentes", icon: BookOpen },
];

export function SiteHeader() {
  return (
    <header className="relative z-40 border-b sm:sticky sm:top-0 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 print:static print:hidden">
      <div className="container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg font-display text-xl font-bold tracking-tight">
          <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
            <Sprout className="size-5" />
          </span>
          <span>Field<span className="text-primary">Shift</span></span>
        </Link>
        <nav aria-label="Principal" className="order-last flex w-full flex-wrap gap-1 sm:order-none sm:w-auto">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-[0.95rem] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Icon aria-hidden className="size-[18px]" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <AccountChip />
          <ProfileChip />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
