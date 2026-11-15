import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { appLocale } from "./i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Número con coma decimal (es-AR). */
export function num(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(appLocale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
