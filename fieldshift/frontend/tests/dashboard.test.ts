import { describe, expect, it } from "vitest";
import { GLOSSARY, GLOSSARY_KEYS } from "@/lib/glossary";
import { INDICATORS, contributions, describeScenario, favorAndPenalty, judge, withIrrigation } from "@/lib/dashboard";
import { demoCompare } from "@/lib/demo";
import { componentWeights, toBackendPriorities, DEFAULT_UI_PRIORITIES } from "@/lib/priorities";
import { friendlyWarning, friendlyWarnings, plain } from "@/lib/plain";
import { rerank } from "@/lib/ranking";
import { PRESET_SCENARIOS } from "@/lib/scenarios";

const W = componentWeights(toBackendPriorities(DEFAULT_UI_PRIORITIES));

async function ranked() {
  const { data } = await demoCompare("campo-este");
  const evals = rerank(data.evaluations, W);
  return { evals, actual: evals.find((e) => e.rotation.strategy === "actual")!, best: evals[0] };
}

describe("contribución de cada componente al puntaje", () => {
  it("las cinco contribuciones suman el puntaje total", async () => {
    const { evals } = await ranked();
    for (const ev of evals) {
      const total = contributions(ev, W).reduce((a, c) => a + c.points, 0);
      expect(total).toBeCloseTo(ev.score.total ?? 0, 0);
    }
  });
  it("cada contribución es valor × peso y siguen el orden A, S, R, I, E", async () => {
    const { best } = await ranked();
    const c = contributions(best, { A: 0.5, S: 0.2, R: 0.1, I: 0.1, E: 0.1 });
    expect(c.map((x) => x.key)).toEqual(["A", "S", "R", "I", "E"]);
    expect(c[0].points).toBeCloseTo(c[0].value * 0.5);
  });
});

describe("qué la favorece y qué la penaliza", () => {
  it("la recomendada frente a la actual: diferencias de puntos coherentes con los datos", async () => {
    const { best, actual } = await ranked();
    const r = favorAndPenalty(best, actual, W, 3);
    expect(r.vsActual).toBe(true);
    expect(r.favor.length).toBeGreaterThan(0);
    expect(r.favor.every((i) => i.delta > 0)).toBe(true);
    expect(r.penalize.every((i) => i.delta < 0)).toBe(true);
    const sorted = [...r.favor].sort((a, b) => b.delta - a.delta);
    expect(r.favor).toEqual(sorted);
    expect(r.favor.length).toBeLessThanOrEqual(3);
  });
  it("para la rotación actual muestra lo que suma y resta, sin compararla consigo misma", async () => {
    const { actual } = await ranked();
    const r = favorAndPenalty(actual, actual, W);
    expect(r.vsActual).toBe(false);
    expect(r.favor.length + r.penalize.length).toBeGreaterThan(0);
  });
  it("incluye factores que solo existen en una de las dos (por ejemplo, la penalización por monocultivo de la actual)", async () => {
    const { evals, actual } = await ranked();
    const other = evals.find((e) => e.rotation.id !== actual.rotation.id)!;
    const all = favorAndPenalty(other, actual, W, 50);
    expect(all.favor.length + all.penalize.length).toBeGreaterThan(3);
  });
  it("sin la rotación actual con qué comparar, usa los valores absolutos", async () => {
    const { best } = await ranked();
    expect(favorAndPenalty(best, undefined, W).vsActual).toBe(false);
  });
});

describe("indicadores comparables", () => {
  it("hay indicadores de agua, suelo, riesgo, ingreso y sostenibilidad", () => {
    const groups = new Set(INDICATORS.map((i) => i.group));
    for (const g of ["total", "agua", "suelo", "riesgo", "ingreso", "sostenibilidad"]) expect(groups.has(g as never)).toBe(true);
    expect(new Set(INDICATORS.map((i) => i.id)).size).toBe(INDICATORS.length);
  });
  it("todos se calculan y formatean para todas las rotaciones", async () => {
    const { evals } = await ranked();
    for (const ev of evals) for (const ind of INDICATORS) {
      const v = ind.value(ev);
      expect(v === null || Number.isFinite(v)).toBe(true);
      if (v !== null) expect(ind.format(v).length).toBeGreaterThan(0);
    }
  });
  it("judge respeta si más es mejor o peor, y la tolerancia", () => {
    expect(judge(70, 60, "high", 0.5)).toBe("mejor");
    expect(judge(50, 60, "high", 0.5)).toBe("peor");
    expect(judge(600, 700, "low", 15)).toBe("mejor");
    expect(judge(800, 700, "low", 15)).toBe("peor");
    expect(judge(705, 700, "low", 15)).toBe("igual");
    expect(judge(5, 3, "none", 0)).toBe("igual");
    expect(judge(null, 3, "high", 0)).toBe("sin_dato");
  });
});

describe("escenario y riego", () => {
  it("agregar riego a un escenario lo marca y lo renombra; si ya tiene riego, no cambia", () => {
    const seco = PRESET_SCENARIOS.find((p) => p.id === "seco-20")!;
    const r = withIrrigation(seco, true);
    expect(r.irrigation).toBe(true);
    expect(r.id).toBe("seco-20+riego");
    expect(r.name).toMatch(/con riego/);
    expect(withIrrigation(seco, false)).toBe(seco);
    const conRiego = PRESET_SCENARIOS.find((p) => p.id === "con-riego")!;
    expect(withIrrigation(conRiego, true)).toBe(conRiego);
  });
  it("describe el escenario en palabras", () => {
    const seco = PRESET_SCENARIOS.find((p) => p.id === "seco-20-calor-2")!;
    const t = describeScenario(seco, { rainMm: 711, scenarioRainMm: 569 })!;
    expect(t).toMatch(/llueve 20 % menos/);
    expect(t).toMatch(/2,0 °C más/);
    expect(t).toMatch(/569 mm/);
    expect(describeScenario(PRESET_SCENARIOS[0], { rainMm: 1, scenarioRainMm: 1 })).toBeNull();
  });
});

describe("modo demostración con escenario y riego", () => {
  it("un escenario predefinido cambia los puntajes y lo avisa", async () => {
    const base = (await demoCompare("campo-centro")).data;
    const seco = await demoCompare("campo-centro", PRESET_SCENARIOS.find((p) => p.id === "seco-20-calor-2"));
    const baseTotal = Object.fromEntries(base.evaluations.map((e) => [e.rotation.id, e.score.total]));
    expect(seco.data.evaluations.every((e) => (e.score.total ?? 0) < (baseTotal[e.rotation.id] ?? 0))).toBe(true);
    expect(seco.data.scenario?.id).toBe("seco-20-calor-2");
    expect(seco.meta.warnings.join(" ")).toMatch(/detalle de factores/);
    expect(seco.data.evaluations[0].score.components.every((c) => c.drivers.length > 0)).toBe(true);
  });
  it("con riego sube el puntaje de agua; una combinación sin precalcular vuelve al clima del período y avisa", async () => {
    const base = (await demoCompare("campo-centro")).data;
    const riego = (await demoCompare("campo-centro", PRESET_SCENARIOS.find((p) => p.id === "con-riego"))).data;
    const a = (r: typeof base) => r.evaluations.find((e) => e.rotation.strategy === "actual")!.score.components.find((c) => c.key === "A")!.value!;
    expect(a(riego)).toBeGreaterThan(a(base));
    const combo = await demoCompare("campo-centro", { id: "x", name: "x", rain_delta_pct: -33, temp_delta_c: 1, dry_year: false, irrigation: true });
    expect(combo.meta.warnings.join(" ")).toMatch(/solo hay escenarios predefinidos/);
    expect(combo.data.scenario).toBeNull();
  });
  it("el ranking queda ordenado por puesto", async () => {
    const r = (await demoCompare("campo-este", PRESET_SCENARIOS.find((p) => p.id === "anio-seco"))).data;
    const ranks = r.evaluations.map((e) => e.score.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe("textos en lenguaje claro", () => {
  it("traduce los avisos técnicos del servidor", () => {
    expect(friendlyWarning("NASA POWER no respondió (NASA POWER no respondió tras 4 intentos (ProxyError).).")).not.toMatch(/ProxyError/);
    expect(friendlyWarning("SMAP: Sin credenciales de AppEEARS: no se consultaron datos en vivo.")).toMatch(/Humedad del suelo \(SMAP\)/);
    expect(friendlyWarning("NDVI: Se usan DATOS DE MUESTRA SIMULADOS de NDVI del sitio 'campo-este' (-33.85, -65.2); no son observaciones.")).toMatch(/Vegetación \(NDVI\).*SIMULADOS/);
    expect(friendlyWarning("Prioridades por defecto (estimado): el productor no las cargó.")).toMatch(/Prioridades por defecto/);
  });
  it("junta avisos repetidos", () => {
    const out = friendlyWarnings(["NASA POWER no respondió (a)", "NASA POWER no respondió (b)", "otro"]);
    expect(out).toHaveLength(2);
  });
  it("no rompe la concordancia de género al traducir (\"el déficit hídrico\" queda igual)", () => {
    expect(plain("con el déficit hídrico, la biomasa")).toBe("con el déficit hídrico, la biomasa");
  });
  it("explica siglas", () => {
    expect(plain("ET0 de 1.377 mm y Kc estándar")).toBe("evapotranspiración (ET₀) de 1.377 mm y coeficiente de cultivo (Kc) estándar");
    expect(plain("SMAP L4: 14 % de los meses")).toMatch(/zona de raíces/);
  });
  it("el glosario tiene todo lo que un productor necesita traducido", () => {
    for (const k of ["ndvi", "smap", "et0", "estres"] as const) expect(GLOSSARY[k].long.length).toBeGreaterThan(40);
    for (const k of GLOSSARY_KEYS) expect(GLOSSARY[k].short.endsWith(".")).toBe(true);
  });
});
