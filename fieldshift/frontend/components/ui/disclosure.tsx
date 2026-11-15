"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclosureProps {
  /** Texto del botón. Por defecto "Quiero más información". */
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
}

/**
 * Bloque "quiero más información": un botón que muestra u oculta contenido.
 * Accesible: el botón dice si está abierto (aria-expanded) y apunta a la región (aria-controls);
 * la región se anuncia con su etiqueta. Funciona con teclado (es un <button> nativo).
 */
export function Disclosure({
  label = "Quiero más información",
  openLabel,
  children,
  defaultOpen = false,
  className,
  contentClassName,
  variant = "plain",
}: DisclosureProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();
  const regionId = `${id}-region`;
  const labelText = typeof label === "string" ? label : "más información";

  return (
    <div className={cn(variant === "card" && "rounded-lg border bg-card", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={regionId}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-primary transition-colors hover:text-primary/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
          variant === "card" && "p-4",
        )}
      >
        <span>{open && openLabel ? openLabel : label}</span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <div
        id={regionId}
        role="region"
        aria-label={typeof labelText === "string" ? labelText : undefined}
        hidden={!open}
        className={cn(
          "text-sm text-muted-foreground",
          variant === "card" ? "px-4 pb-4" : "pt-2",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
