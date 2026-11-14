import Link from "next/link";
import { BookOpen, Home, MapPinned, Sprout } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/campos", label: "Mis campos", icon: MapPinned },
  { href: "/metodologia", label: "Metodología y fuentes", icon: BookOpen },
];

export function SiteHeader() {
  return (
    <header className="border-b bg-card print:hidden">
      <div className="container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
        <Link href="/" className="flex items-center gap-2 rounded-md text-xl font-bold text-primary">
          <Sprout aria-hidden className="size-7" />
          FieldShift
        </Link>
        <nav aria-label="Principal" className="order-last flex w-full flex-wrap gap-1 sm:order-none sm:w-auto">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-medium hover:bg-accent">
              <Icon aria-hidden className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
