"use client";

import { useSyncExternalStore } from "react";

/** true si la pantalla cumple la consulta (por ejemplo "(min-width: 1024px)"). En el servidor es siempre false. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", notify);
      return () => m.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
