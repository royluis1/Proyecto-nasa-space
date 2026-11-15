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
    <header className="border-b bg-card print:hidden">
      <div className="container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
        <Link href="/" className="flex items-center gap-2 rounded-md text-xl font-extrabold tracking-tight">
          <Sprout aria-hidden className="size-7 text-primary" />
          <span>Field<span className="text-primary">Shift</span></span>
        </Link>
        <nav aria-label="Principal" className="order-last flex w-full flex-wrap gap-1 sm:order-none sm:w-auto">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-medium hover:bg-accent">
              <Icon aria-hidden className="size-5" />
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
