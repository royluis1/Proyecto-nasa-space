"use client";

import * as React from "react";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { LocalityOut } from "@/types/api";

/**
 * Buscador de ciudad o pueblo: se escribe el nombre y se elige de una lista.
 * Pensado para quien no quiere (o no puede) marcar un punto en el mapa.
 * Accesible: combobox con lista, flechas para moverse, Enter para elegir y Escape para cerrar.
 */
export function LocalitySearch({
  label = "¿En qué ciudad o pueblo estás?",
  help = "Escribí el nombre y elegí de la lista. Con eso ubicamos tu huerta.",
  onSelect,
  id = "localidad",
}: {
  label?: string;
  help?: string;
  onSelect: (loc: LocalityOut) => void;
  id?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<LocalityOut[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);
  // Al elegir una ciudad ponemos su nombre en el campo; eso no debe disparar una búsqueda nueva.
  const justChose = React.useRef(false);
  const listId = `${id}-lista`;
  const listOpen = open && results.length > 0;

  // Busca mientras se escribe, esperando a que la persona frene (y cancelando lo anterior).
  React.useEffect(() => {
    if (justChose.current) {
      justChose.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.searchLocalities(q, { signal: ctrl.signal });
        setResults(r.results);
        setActive(0);
        setOpen(true);
        setError(r.results.length ? null : "No encontramos esa ciudad o pueblo. Probá con otro nombre.");
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
          setError("No pudimos buscar ciudades ahora. Probá de nuevo en un momento.");
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  // Cerrar la lista al tocar fuera.
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (loc: LocalityOut) => {
    justChose.current = true;
    onSelect(loc);
    setQuery(loc.label);
    setOpen(false);
    setResults([]);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!listOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-1.5" ref={boxRef}>
      <Label htmlFor={id}>{label}</Label>
      {help && <p id={`${id}-ayuda`} className="text-sm text-muted-foreground">{help}</p>}
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="text"
          className="pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Por ejemplo: Justo Daract"
          autoComplete="off"
          role="combobox"
          aria-expanded={listOpen}
          {...(listOpen ? { "aria-controls": listId } : {})}
          aria-describedby={help ? `${id}-ayuda` : undefined}
          aria-autocomplete="list"
          aria-activedescendant={listOpen ? `${id}-op-${active}` : undefined}
        />
        {listOpen && (
          <ul id={listId} role="listbox" aria-label="Ciudades encontradas" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-card shadow-lg">
            {results.map((loc, i) => (
              <li
                key={`${loc.nombre}-${loc.provincia}-${loc.departamento}`}
                id={`${id}-op-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(loc)}
                className={cn("flex cursor-pointer items-center gap-2 px-3 py-2.5", i === active && "bg-accent")}
              >
                <MapPin aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">{loc.nombre}</span>
                  <span className="block text-sm text-muted-foreground">{loc.departamento ? `${loc.departamento}, ` : ""}{loc.provincia}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {loading ? "Buscando…" : error ?? ""}
      </p>
    </div>
  );
}
