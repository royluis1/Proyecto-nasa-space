import type { RotationEvaluation, RotationScore, ScoreComponentKey } from "@/types/api";

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Recalcula el puntaje total con nuevos pesos, sin llamar al servidor:
 * total = Σ peso_k × valor_k (los valores A, S, R, I y E no dependen de las prioridades).
 * Se desplaza el rango de incertidumbre en la misma cantidad. Ante un empate queda primero la rotación actual,
 * igual que en el backend. Lo único que no se puede recalcular acá es la elección de la variante "mixta",
 * que el servidor reevalúa con cada cambio de prioridades.
 */
export function rerank(evaluations: RotationEvaluation[], weights: Record<ScoreComponentKey, number>): RotationEvaluation[] {
  const scored = evaluations.map((ev) => {
    const components = ev.score.components.map((c) => ({ ...c, weight: Math.round((weights[c.key] ?? 0) * 1000) / 1000 }));
    const total = clamp(components.reduce((acc, c) => acc + (c.value ?? 0) * (weights[c.key] ?? 0), 0));
    const delta = total - (ev.score.total ?? total);
    return {
      ev,
      total: round1(total),
      components,
      low: ev.score.uncertainty_low == null ? null : round1(clamp(ev.score.uncertainty_low + delta)),
      high: ev.score.uncertainty_high == null ? null : round1(clamp(ev.score.uncertainty_high + delta)),
    };
  });
  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return Number(a.ev.rotation.strategy !== "actual") - Number(b.ev.rotation.strategy !== "actual");
  });
  return scored.map((s, i) => ({
    ...s.ev,
    score: { ...s.ev.score, rank: i + 1, total: s.total, components: s.components, uncertainty_low: s.low, uncertainty_high: s.high },
  }));
}


/** Total de un puntaje con pesos propios (los valores A, S, R, I y E no dependen de las prioridades). */
export function weightedTotal(score: Pick<RotationScore, "components">, weights: Record<ScoreComponentKey, number>): number {
  return Math.round(score.components.reduce((acc, c) => acc + (c.value ?? 0) * (weights[c.key] ?? 0), 0) * 10) / 10;
}

export interface ScenarioCell {
  total: number;
  rank: number;
}

/** Puntaje y puesto de cada rotación dentro de un escenario, con los pesos actuales. Ante un empate gana la rotación actual. */
export function scenarioTable(
  ranking: RotationScore[],
  weights: Record<ScoreComponentKey, number>,
  actualId: string | undefined,
): Record<string, ScenarioCell> {
  const rows = ranking.map((s) => ({ id: s.rotation_id, total: weightedTotal(s, weights) }));
  rows.sort((a, b) => b.total - a.total || Number(a.id !== actualId) - Number(b.id !== actualId));
  return Object.fromEntries(rows.map((r, i) => [r.id, { total: r.total, rank: i + 1 }]));
}
