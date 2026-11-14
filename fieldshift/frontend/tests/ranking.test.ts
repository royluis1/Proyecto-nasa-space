import { describe, expect, it } from "vitest";
import { demoCompare } from "@/lib/demo";
import { rerank, scenarioTable, weightedTotal } from "@/lib/ranking";
import type { RotationEvaluation, ScoreComponentKey } from "@/types/api";

const W = (a: number, s: number, r: number, i: number, e: number): Record<ScoreComponentKey, number> => ({ A: a, S: s, R: r, I: i, E: e });
const EQUAL = W(0.2, 0.2, 0.2, 0.2, 0.2);

async function evals(): Promise<RotationEvaluation[]> {
  return (await demoCompare("campo-este")).data.evaluations;
}

describe("re-ranking con nuevos pesos", () => {
  it("con los pesos del cálculo original reproduce los totales del servidor", async () => {
    const original = await evals();
    const again = rerank(original, EQUAL);
    for (const ev of again) {
      const before = original.find((o) => o.rotation.id === ev.rotation.id)!;
      expect(Math.abs((ev.score.total ?? 0) - (before.score.total ?? 0))).toBeLessThanOrEqual(0.15);
    }
  });

  it("ordena por total, numera los puestos y mantiene todas las rotaciones", async () => {
    const out = rerank(await evals(), W(1, 0, 0, 0, 0));
    expect(out.map((e) => e.score.rank)).toEqual(out.map((_, i) => i + 1));
    const totals = out.map((e) => e.score.total ?? 0);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.some((e) => e.rotation.strategy === "actual")).toBe(true);
  });

  it("cambiar las prioridades cambia la rotación recomendada", async () => {
    const original = await evals();
    const agua = rerank(original, W(1, 0, 0, 0, 0))[0].rotation.id;
    const suelo = rerank(original, W(0, 1, 0, 0, 0))[0].rotation.id;
    expect(agua).not.toBe(suelo);
  });

  it("el total de cada rotación es la suma ponderada de sus componentes", async () => {
    const [ev] = rerank(await evals(), W(0.5, 0.1, 0.1, 0.2, 0.1));
    const manual = ev.score.components.reduce((a, c) => a + (c.value ?? 0) * { A: 0.5, S: 0.1, R: 0.1, I: 0.2, E: 0.1 }[c.key], 0);
    expect(ev.score.total).toBeCloseTo(manual, 1);
    expect(ev.score.components.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 2);
  });

  it("no modifica los datos originales y mantiene el rango dentro de 0-100", async () => {
    const original = await evals();
    const snapshot = JSON.stringify(original);
    const out = rerank(original, W(0, 0, 0, 1, 0));
    expect(JSON.stringify(original)).toBe(snapshot);
    for (const e of out) {
      expect(e.score.uncertainty_low!).toBeGreaterThanOrEqual(0);
      expect(e.score.uncertainty_high!).toBeLessThanOrEqual(100);
      expect(e.score.uncertainty_low!).toBeLessThanOrEqual(e.score.total!);
    }
  });

  it("ante un empate queda primera la rotación actual", async () => {
    const [a, b] = await evals();
    const flat = (ev: RotationEvaluation, id: string, strategy: RotationEvaluation["rotation"]["strategy"]): RotationEvaluation => ({
      ...ev,
      rotation: { ...ev.rotation, id, strategy },
      score: { ...ev.score, components: ev.score.components.map((c) => ({ ...c, value: 50 })) },
    });
    const out = rerank([flat(b, "x", "agua"), flat(a, "y", "actual")], EQUAL);
    expect(out[0].rotation.id).toBe("y");
  });
});

describe("escenarios", () => {
  it("scenarioTable recalcula total y puesto con los pesos del usuario", async () => {
    const ranking = (await evals()).map((e) => e.score);
    const t = scenarioTable(ranking, W(0, 0, 0, 1, 0), undefined);
    const best = Object.entries(t).find(([, c]) => c.rank === 1)![0];
    const incomeOf = (id: string) => ranking.find((s) => s.rotation_id === id)!.components.find((c) => c.key === "I")!.value!;
    expect(incomeOf(best)).toBe(Math.max(...ranking.map((s) => s.components.find((c) => c.key === "I")!.value!)));
    expect(weightedTotal(ranking[0], EQUAL)).toBeCloseTo(ranking[0].total!, 0);
  });
});
