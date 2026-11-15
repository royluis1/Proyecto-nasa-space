"use client";

import { MapPin } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { NearestLocality } from "@/types/api";

/** Dónde queda el campo o la huerta: "En Justo Daract, San Luis". Si no se puede resolver, no muestra nada. */
export function LocalityLine({ lat, lon, className, live = false, prefix }: { lat: number; lon: number; className?: string; live?: boolean; prefix?: string }) {
  const state = useAsync<NearestLocality>((signal) => api.nearestLocality(lat, lon, { signal }), [lat, lon]);
  const loc = state.data?.locality;
  if (!loc) return live ? <p aria-live="polite" className="sr-only" /> : null;
  return (
    <p aria-live={live ? "polite" : undefined} className={cn("flex items-center gap-1.5 text-muted-foreground", className)}>
      <MapPin aria-hidden className="size-4 shrink-0" />
      <span>{prefix}{state.data?.text}</span>
    </p>
  );
}
