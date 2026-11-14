import type { RotationStep } from "@/types/api";

export interface PlacedStep {
  index: number; // orden cronológico
  step: RotationStep;
  months: number[]; // índices de mes del ciclo, en orden
}

export interface CalendarModel {
  nMonths: number;
  years: number;
  steps: PlacedStep[];
  /** Índice de paso que ocupa cada mes del ciclo (null = barbecho). */
  owner: (number | null)[];
  conflicts: number[];
}

export const stepLength = (s: Pick<RotationStep, "start_month" | "end_month">): number => (((s.end_month - s.start_month) % 12) + 12) % 12 + 1;

/**
 * Misma regla que el backend: un mes puede ser el último de un cultivo y el primero del siguiente (cosecha y siembra
 * en el mismo mes): se asigna al que empieza. Cualquier otra superposición se informa en `conflicts`.
 */
export function buildCalendar(rotation: { duration_years: number; steps: RotationStep[] }): CalendarModel {
  const n = 12 * rotation.duration_years;
  const ordered = [...rotation.steps].sort((a, b) => a.year - b.year || a.start_month - b.start_month);
  const placed: PlacedStep[] = ordered.map((step, index) => {
    const start = (step.year - 1) * 12 + step.start_month - 1;
    return { index, step, months: Array.from({ length: stepLength(step) }, (_, k) => (start + k) % n) };
  });
  const claims = new Map<number, { i: number; k: number }[]>();
  placed.forEach((p, i) => p.months.forEach((m, k) => claims.set(m, [...(claims.get(m) ?? []), { i, k }])));
  const owner: (number | null)[] = Array(n).fill(null);
  const conflicts: number[] = [];
  claims.forEach((who, m) => {
    if (who.length === 1) {
      owner[m] = who[0].i;
      return;
    }
    const [a, b] = who;
    const lastA = a.k === placed[a.i].months.length - 1;
    const lastB = b.k === placed[b.i].months.length - 1;
    if (who.length === 2 && lastA && b.k === 0) owner[m] = b.i;
    else if (who.length === 2 && lastB && a.k === 0) owner[m] = a.i;
    else {
      owner[m] = a.i;
      conflicts.push(m);
    }
  });
  return { nMonths: n, years: rotation.duration_years, steps: placed, owner, conflicts };
}

/** Meses del ciclo sin cultivo. */
export const fallowMonths = (c: CalendarModel): number => c.owner.filter((o) => o === null).length;
