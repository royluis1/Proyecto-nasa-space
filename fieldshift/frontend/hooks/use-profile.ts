"use client";

import { useSyncExternalStore } from "react";
import { PROFILE_EVENT, readProfile, type Profile } from "@/lib/profile";

function subscribe(cb: () => void) {
  window.addEventListener(PROFILE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PROFILE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Perfil actual (null si todavía no eligió, o en el servidor). */
export function useProfile(): Profile | null {
  return useSyncExternalStore(subscribe, readProfile, () => null);
}
