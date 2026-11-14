"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

/**
 * Palabra técnica con su explicación a un toque (o con Enter): "NDVI", "evapotranspiración", "estrés hídrico"...
 * Funciona con teclado y en pantallas táctiles; se cierra con Escape o tocando afuera.
 */
export function Term({ k, children }: { k: GlossaryKey; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const entry = GLOSSARY[k];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className="rounded-sm underline decoration-dotted decoration-2 underline-offset-4 hover:bg-accent"
      >
        {children ?? entry.term}
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute left-0 top-full z-30 mt-1 block w-72 max-w-[80vw] rounded-md border bg-popover p-3 text-left text-sm font-normal text-popover-foreground shadow-lg print:hidden"
        >
          <strong className="block">{entry.term}</strong>
          {entry.long}
        </span>
      )}
    </span>
  );
}
