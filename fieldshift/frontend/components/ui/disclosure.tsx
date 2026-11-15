"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/lang-provider";

interface DisclosureProps {
  /** Texto del botón. Por defecto "Quiero más información" / "Tell me more". */
  label?: React.ReactNode;
  /** Texto cuando está abierto (si se quiere distinto). */
  openLabel?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** Clase del contenido desplegado. */
  contentClassName?: string;
  /** "card" lo encierra en un recuadro; "plain" solo el botón y el texto. */
  variant?: "card" | "plain";
  /** Ancla: si la dirección termina en #id, se abre solo y se muestra. */
  id?: string;
}

/**
 * Bloque "quiero más información": un botón que muestra u oculta contenido.
 * Accesible: el botón dice si está abierto (aria-expanded) y apunta a la región (aria-controls).
 * El contenido se monta recién al abrir: los gráficos escondidos no se dibujan ni pesan.
 */
export function Disclosure({
  label,
  openLabel,
  children,
  defaultOpen = false,
  className,
  contentClassName,
  variant = "plain",
  id: anchor,
}: DisclosureProps) {
  const t = useT();
  label ??= t("Quiero más información", "Tell me more");
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  const regionId = `${id}-region`;
  const buttonId = `${id}-button`;

  // Un enlace a #ancla abre el desplegable y lleva hasta él.
  React.useEffect(() => {
    if (!anchor) return;
    const check = () => {
      if (window.location.hash === `#${anchor}`) {
        setOpen(true);
        document.getElementById(buttonId)?.focus();
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [anchor, buttonId]);

  return (
    <div id={anchor} className={cn("scroll-mt-24", variant === "card" && "rounded-lg border bg-card", className)}>
      <button
        id={buttonId}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={regionId}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left font-medium text-primary underline-offset-4 hover:underline",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          variant === "card" ? "px-4 py-3" : "text-sm",
        )}
      >
        <span>{open && openLabel ? openLabel : label}</span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <div
        id={regionId}
        hidden={!open}
        className={cn(variant === "card" ? "px-4 pb-4" : "pt-3", contentClassName)}
      >
        {open && children}
      </div>
    </div>
  );
}

/**
 * Sección con título que se despliega al tocarlo (el título es el botón).
 * Mantiene el encabezado (h2/h3) para la navegación con lector de pantalla.
 */
export function CollapsibleSection({
  title,
  summary,
  children,
  defaultOpen = false,
  as: Heading = "h2",
  className,
}: {
  title: React.ReactNode;
  /** Una línea corta debajo del título, visible siempre. */
  summary?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  as?: "h2" | "h3";
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  const regionId = `${id}-region`;
  const buttonId = `${id}-button`;
  return (
    <section className={cn("rounded-lg border bg-card", className)} aria-labelledby={buttonId}>
      <Heading className="text-xl font-semibold">
        <button
          id={buttonId}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={regionId}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-5 py-3 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>{title}</span>
          <ChevronDown aria-hidden className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </Heading>
      {summary && !open && <p className="-mt-1 px-5 pb-4 text-sm text-muted-foreground">{summary}</p>}
      <div id={regionId} hidden={!open} className="space-y-3 px-5 pb-5">
        {open && children}
      </div>
    </section>
  );
}
