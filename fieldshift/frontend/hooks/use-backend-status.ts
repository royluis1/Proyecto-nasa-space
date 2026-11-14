"use client";

import { useSyncExternalStore } from "react";
import { getBackendState, subscribeBackend } from "@/lib/api";

const server = { demo: false, lastError: null as string | null };

/** `demo` es true si alguna llamada tuvo que usar datos de ejemplo porque el servidor no respondió. */
export function useBackendStatus() {
  return useSyncExternalStore(subscribeBackend, getBackendState, () => server);
}
