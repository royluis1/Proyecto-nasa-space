import type { FieldOut } from "@/types/api";
import { readJson, writeJson } from "./storage";

const KEY = "fieldshift:local-fields";
export const LOCAL_PREFIX = "local-";

/** Campos guardados solo en este navegador (se crean cuando el servidor no responde). */
export const isLocalId = (id: string): boolean => id.startsWith(LOCAL_PREFIX);

export const listLocalFields = (): FieldOut[] => readJson<FieldOut[]>(KEY, []);

export const getLocalField = (id: string): FieldOut | undefined => listLocalFields().find((f) => f.id === id);

export function saveLocalField(field: FieldOut): void {
  const rest = listLocalFields().filter((f) => f.id !== field.id);
  writeJson(KEY, [...rest, field]);
}

export function newLocalId(): string {
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${LOCAL_PREFIX}${rnd}`;
}

export function deleteLocalField(id: string): void {
  writeJson(KEY, listLocalFields().filter((f) => f.id !== id));
}

/* ---- campos de ejemplo ocultos en este navegador ---- */

const HIDDEN_KEY = "fieldshift:ejemplos-ocultos";

/**
 * Los campos de ejemplo no se borran del servidor (la página es pública: desaparecerían para todos).
 * La papelera los oculta solo en este navegador, y se pueden volver a mostrar.
 */
export const listHiddenExamples = (): string[] => readJson<string[]>(HIDDEN_KEY, []);

export function hideExample(id: string): void {
  writeJson(HIDDEN_KEY, [...new Set([...listHiddenExamples(), id])]);
}

export function showAllExamples(): void {
  writeJson(HIDDEN_KEY, []);
}
