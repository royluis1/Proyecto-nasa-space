export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
/** Si el backend no responde, mostrar datos de ejemplo (con aviso). */
export const DEMO_FALLBACK = process.env.NEXT_PUBLIC_DEMO_FALLBACK !== "false";
export const REQUEST_TIMEOUT_MS = 25_000;
