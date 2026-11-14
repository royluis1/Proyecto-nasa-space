import { STRATEGY_LABELS } from "./format";
import { DISCLAIMER } from "./content";
import type { CompareResult, RotationEvaluation } from "@/types/api";

/** Marca de orden de bytes: hace que Excel lea el CSV como UTF-8 y respete los acentos. */
const BOM = "\uFEFF";

const esc = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV del ranking (con BOM para que Excel respete los acentos). */
export function buildCsv(fieldName: string, origin: string, result: CompareResult, evaluations: RotationEvaluation[]): string {
  const rows: unknown[][] = [
    [`# ${DISCLAIMER}`],
    [`# Origen de los datos: ${origin}`],
    ...result.warnings.map((w) => [`# ${w}`]),
    ["# Campo", fieldName],
    [],
    ["puesto", "rotacion_id", "estrategia", "rotacion", "puntaje_total", "rango_min", "rango_max", "confianza", "A_agua", "S_suelo", "R_riesgo", "I_ingreso", "E_sostenibilidad", "explicacion"],
  ];
  for (const ev of evaluations) {
    const c = Object.fromEntries(ev.score.components.map((x) => [x.key, x.value]));
    rows.push([
      ev.score.rank, ev.rotation.id, STRATEGY_LABELS[ev.rotation.strategy], ev.rotation.name, ev.score.total,
      ev.score.uncertainty_low, ev.score.uncertainty_high, ev.score.confidence, c.A, c.S, c.R, c.I, c.E, ev.recommendation.why,
    ]);
  }
  return BOM + rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

export function buildJson(fieldName: string, origin: string, result: CompareResult, evaluations: RotationEvaluation[]): string {
  return JSON.stringify(
    { campo: fieldName, origen_de_datos: origin, generado: new Date().toISOString(), advertencia: DISCLAIMER, ...result, ranking: undefined, evaluations },
    null,
    2,
  );
}

export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFilename = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase() || "campo";
