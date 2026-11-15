/**
 * Reporte del campo para revisar con un técnico: un modelo único (puro y testeable) que se exporta a CSV y a PDF.
 * El PDF se arma en el navegador (jsPDF), así funciona también sin conexión con el servidor.
 */
import { disclaimer } from "./content";
import { COMPONENT_ORDER, COMPONENTS, LEVEL_LABELS, SOIL_TEXTURES, STRATEGY_LABELS, num, rotationTitle } from "./format";
import { friendlyWarnings } from "./plain";
import { PRIORITY_KEYS, PRIORITY_META, type UiPriorities } from "./priorities";
import type { Resilience } from "./scenarios";
import { campaignSummary, timelineTotals } from "./timeline";
import type { CalendarTimeline, CompareResult, FieldOut, RotationEvaluation, ScenarioInput, ScoreComponentKey } from "@/types/api";
import { L, appLocale, localize, tr } from "./i18n";

const ZONES: Record<string, string> = localize({
  hiperarido: L("hiperárida", "hyper-arid"), arido: L("árida", "arid"), semiarido: L("semiárida", "semi-arid"), subhumedo_seco: L("subhúmeda seca", "dry sub-humid"), subhumedo: L("subhúmeda", "sub-humid"), humedo: L("húmeda", "humid"),
});

export interface ReportInput {
  field: FieldOut;
  ui: UiPriorities;
  weights: Record<ScoreComponentKey, number>;
  result: CompareResult;
  evaluations: RotationEvaluation[];
  origin: string;
  generatedAt: Date;
  scenario?: ScenarioInput | null;
  resilience?: Resilience[] | null;
  names?: Record<string, string>;
  timeline?: CalendarTimeline | null;
}

export type Row = (string | number | null | undefined)[];

export interface ReportModel {
  title: string;
  generated: string;
  generatedIso: string;
  origin: string;
  scenario: string;
  field: [string, string][];
  priorities: [string, string][];
  weights: string;
  climate: [string, string][];
  recommendation: { rotation: string; score: string; vsActual: string | null; why: string; benefits: string[]; risks: string[]; validate: string[]; note: string };
  ranking: { headers: string[]; rows: Row[] };
  explanations: { title: string; why: string; risks: string[] }[];
  resilience: { headers: string[]; rows: Row[] } | null;
  calendar: { title: string; campaigns: string[]; advice: string[] } | null;
  assumptions: string[];
  sources: string[];
  warnings: string[];
  disclaimer: string;
}

const fmtDate = (d: Date) => d.toLocaleDateString(appLocale(), { day: "numeric", month: "long", year: "numeric" });

export function buildReportModel(i: ReportInput): ReportModel {
  const { field, result, evaluations } = i;
  const c = result.inputs.climate;
  const best = evaluations[0];
  const actual = evaluations.find((e) => e.rotation.strategy === "actual");
  const names = i.names ?? Object.fromEntries(evaluations.map((e) => [e.rotation.id, rotationTitle(e.rotation)]));
  const sm = result.inputs.soil_moisture;
  const veg = result.inputs.vegetation;
  const climate: [string, string][] = [
    [tr("Período de referencia", "Reference period"), `${c.period} (NASA POWER, ${c.origin_label})`],
    [tr("Lluvia media", "Mean rainfall"), `${num(c.annual_precip_mm)} ${tr("mm/año", "mm/yr")}`],
    [tr("Evapotranspiración de referencia (ET0)", "Reference evapotranspiration (ET0)"), `${num(c.annual_et0_mm)} ${tr("mm/año", "mm/yr")}`],
    [tr("Índice de aridez", "Aridity index"), tr(`${num(c.aridity_index, 2)} (zona ${ZONES[c.zone] ?? c.zone})`, `${num(c.aridity_index, 2)} (${ZONES[c.zone] ?? c.zone} zone)`)],
    [tr("Variabilidad de la lluvia", "Rainfall variability"), c.precip_cv_pct == null ? tr("sin dato", "no data") : `${num(c.precip_cv_pct)} % ${tr("entre años", "between years")}`],
    [tr("Días con más de 35 °C", "Days above 35 °C"), c.heat_days_per_year == null ? tr("sin dato", "no data") : `${num(c.heat_days_per_year)} ${tr("por año", "per year")}`],
  ];
  if (c.scenario) climate.push([tr("Con el escenario", "With the scenario"), tr(`${num(c.scenario_precip_mm)} mm de lluvia y ${num(c.scenario_et0_mm)} mm de ET0 al año`, `${num(c.scenario_precip_mm)} mm of rain and ${num(c.scenario_et0_mm)} mm of ET0 per year`)]);
  climate.push([tr("Humedad del suelo (SMAP)", "Soil moisture (SMAP)"), sm ? `${sm.anomaly_pct > 0 ? "+" : ""}${num(sm.anomaly_pct)} % ${tr("frente a lo normal", "vs. normal")}${sm.period ? ` (${sm.period})` : ""}` : tr("no disponible", "not available")]);
  climate.push([tr("Vegetación (MODIS NDVI)", "Vegetation (MODIS NDVI)"), veg ? `${num(veg.bare_soil_fraction * 100)} % ${tr("del tiempo con poca vegetación", "of the time with little vegetation")}${veg.period ? ` (${veg.period})` : ""}` : tr("no disponible", "not available")]);

  return {
    title: tr(`AgroOrbit · Plan de rotación: ${field.name}`, `AgroOrbit · Rotation plan: ${field.name}`),
    generated: fmtDate(i.generatedAt),
    generatedIso: i.generatedAt.toISOString(),
    origin: i.origin,
    scenario: i.scenario?.name ?? result.scenario?.name ?? tr("Año normal (clima promedio de los últimos 10 años)", "Normal year (average weather of the last 10 years)"),
    field: [
      [tr("Nombre", "Name"), field.name],
      [tr("Superficie", "Area"), `${num(field.area_ha)} ha`],
      [tr("Ubicación", "Location"), `${num(field.location.lat, 4)}, ${num(field.location.lon, 4)}`],
      [tr("Riego", "Irrigation"), field.irrigated ? tr("Sí", "Yes") : tr("No (secano)", "No (rainfed)")],
      [tr("Suelo", "Soil"), field.soil_profile?.texture ? SOIL_TEXTURES[field.soil_profile.texture] : tr("sin dato (se supuso franco arenosa)", "no data (sandy loam assumed)")],
      [tr("Cultivo actual", "Current crop"), result.inputs.current_crop ?? tr("sin dato", "no data")],
      [tr("Historial", "History"), result.inputs.history.join(" > ") || tr("sin dato", "no data")],
    ],
    priorities: PRIORITY_KEYS.map((k) => [PRIORITY_META[k].label, `${i.ui[k]}/10`]),
    weights: COMPONENT_ORDER.map((k) => `${COMPONENTS[k].name} ${num(i.weights[k] * 100)} %`).join(" · "),
    climate,
    recommendation: {
      rotation: best ? `${rotationTitle(best.rotation)} (${STRATEGY_LABELS[best.rotation.strategy]})` : "—",
      score: best ? tr(`${num(best.score.total)} de 100 puntos (rango ${num(best.score.uncertainty_low)} a ${num(best.score.uncertainty_high)})`, `${num(best.score.total)} of 100 points (range ${num(best.score.uncertainty_low)} to ${num(best.score.uncertainty_high)})`) : "—",
      vsActual: actual && best && actual.rotation.id !== best.rotation.id ? tr(`Tu rotación actual obtiene ${num(actual.score.total)} puntos.`, `Your current rotation scores ${num(actual.score.total)} points.`) : actual ? tr("Tu rotación actual ya es la mejor con estas prioridades.", "Your current rotation is already the best with these priorities.") : null,
      why: best?.recommendation.why ?? "",
      benefits: best?.recommendation.benefits ?? [],
      risks: best?.recommendation.risks ?? [],
      validate: best?.recommendation.evidence.needs_validation ?? [],
      note: best?.recommendation.validation_note ?? "",
    },
    ranking: {
      headers: [tr("Puesto", "Rank"), tr("Rotación", "Rotation"), "Total", tr("Rango", "Range"), ...COMPONENT_ORDER.map((k) => COMPONENTS[k].short), tr("Riesgo", "Risk")],
      rows: evaluations.map((e) => [
        e.score.rank,
        `${STRATEGY_LABELS[e.rotation.strategy]}: ${rotationTitle(e.rotation)}`,
        num(e.score.total, 1),
        `${num(e.score.uncertainty_low)}–${num(e.score.uncertainty_high)}`,
        ...COMPONENT_ORDER.map((k) => num(e.score.components.find((x) => x.key === k)?.value)),
        e.score.risk_level ? LEVEL_LABELS[e.score.risk_level] : "—",
      ]),
    },
    explanations: evaluations.map((e) => ({ title: `${e.score.rank}. ${STRATEGY_LABELS[e.rotation.strategy]}: ${rotationTitle(e.rotation)}`, why: e.recommendation.why, risks: e.recommendation.risks })),
    resilience: i.resilience?.length
      ? {
          headers: [tr("Rotación", "Rotation"), tr("Promedio", "Average"), tr("Peor puntaje", "Worst score"), tr("Peor escenario", "Worst scenario"), tr("Peor puesto", "Worst rank"), tr("Escenarios que gana", "Scenarios won"), tr("Mayor caída", "Largest drop")],
          rows: i.resilience.map((r) => [names[r.id] ?? r.id, num(r.mean, 1), num(r.worst, 1), r.worstScenario, r.worstRank, r.wins, num(r.maxDrop, 1)]),
        }
      : null,
    calendar: i.timeline
      ? {
          title: tr(`${rotationTitle(i.timeline.rotation)}, ${i.timeline.campaigns.length} campañas (${timelineTotals(i.timeline).bare} meses de suelo desnudo en total)`, `${rotationTitle(i.timeline.rotation)}, ${i.timeline.campaigns.length} seasons (${timelineTotals(i.timeline).bare} months of bare soil in total)`),
          campaigns: i.timeline.campaigns.map((c) => `${c.label}: ${c.months.filter((m) => m.stage === "siembra").map((m) => tr(`${m.crop_name} se siembra en ${m.label}`, `${m.crop_name} is planted in ${m.label}`)).join("; ") || tr("sin siembras", "no plantings")}. ${campaignSummary(c)}.`),
          advice: i.timeline.advice.map((a) => a.text),
        }
      : null,
    assumptions: result.assumptions.map((a) => `${a.text}${a.source ? ` (${a.source})` : ""}${!a.validated && !a.source ? tr(" — a validar", " — to be validated") : ""}`),
    sources: result.sources.map((s) => `${s.name} — ${s.provider}. ${s.spatial_resolution}, ${s.temporal_resolution}. ${s.citation}`),
    warnings: friendlyWarnings(result.warnings),
    disclaimer: disclaimer(),
  };
}

/* ---------------------------------- CSV ---------------------------------- */

const esc = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV por secciones (seccion, dato, valor), con BOM para que Excel respete los acentos. */
export function reportCsv(m: ReportModel): string {
  const rows: Row[] = [
    [`# ${m.title}`],
    [`# ${m.disclaimer}`],
    [tr("# Generado", "# Generated"), m.generatedIso],
    [tr("# Origen de los datos", "# Data origin"), m.origin],
    [tr("# Escenario", "# Scenario"), m.scenario],
    [],
    ["seccion", "dato", "valor"],
    ...m.field.map(([k, v]) => ["campo", k, v]),
    ...m.priorities.map(([k, v]) => ["prioridades", k, v]),
    ["prioridades", tr("Peso de cada componente", "Weight of each component"), m.weights],
    ...m.climate.map(([k, v]) => ["clima", k, v]),
    ["recomendacion", tr("Rotación", "Rotation"), m.recommendation.rotation],
    ["recomendacion", tr("Puntaje", "Score"), m.recommendation.score],
    ...(m.recommendation.vsActual ? [["recomendacion", tr("Frente a la actual", "Vs. current"), m.recommendation.vsActual]] : []),
    ["recomendacion", tr("Por qué", "Why"), m.recommendation.why],
    ...m.recommendation.risks.map((r) => ["recomendacion", tr("Riesgo", "Risk"), r]),
    ...m.recommendation.validate.map((r) => ["recomendacion", tr("A validar con el técnico", "To validate with your agronomist"), r]),
    [],
    m.ranking.headers,
    ...m.ranking.rows,
  ];
  if (m.resilience) rows.push([], [tr("# Resistencia a los escenarios", "# Resilience to scenarios")], m.resilience.headers, ...m.resilience.rows);
  if (m.calendar) rows.push([], ["calendario", tr("Rotación", "Rotation"), m.calendar.title], ...m.calendar.campaigns.map((c) => ["calendario", tr("Campaña", "Season"), c]), ...m.calendar.advice.map((a) => ["calendario", tr("Recomendación", "Recommendation"), a]));
  rows.push(
    [],
    ...m.assumptions.map((a) => ["supuesto", a, ""]),
    ...m.sources.map((s) => ["fuente", s, ""]),
    ...m.warnings.map((w) => ["advertencia", w, ""]),
    ["advertencia", m.disclaimer, ""],
  );
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

/* ---------------------------------- PDF ---------------------------------- */

/**
 * Las fuentes estándar del PDF solo tienen caracteres latinos (Windows-1252): los demás se cambian por equivalentes
 * para que no salgan símbolos raros. Acentos, ñ, °, ± y comillas latinas se mantienen.
 */
export function pdfSafe(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[→⇒]/g, "->")
    .replace(/[←]/g, "<-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/×/g, "x")
    .replace(/[−–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/Σ/g, "Suma")
    .replace(/ | /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, "");
}

type JsPdf = import("jspdf").jsPDF;

/** Arma el PDF (carga jsPDF bajo demanda para no inflar la página). */
export async function reportPdf(m: ReportModel): Promise<JsPdf> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15;
  const green: [number, number, number] = [46, 104, 58];
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - 18) {
      doc.addPage();
      y = M;
    }
  };
  const para = (text: string, size = 10, style: "normal" | "bold" = "normal", gap = 1.5) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(pdfSafe(text), W - 2 * M) as string[];
    const lh = size * 0.42;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, M, y);
      y += lh;
    }
    y += gap;
  };
  const heading = (text: string) => {
    ensure(14);
    y += 2;
    doc.setTextColor(...green);
    para(text, 13, "bold", 1);
    doc.setTextColor(0, 0, 0);
  };
  const bullets = (items: string[], size = 9.5) => items.forEach((t) => para(`-  ${t}`, size, "normal", 0.6));
  const table = (head: string[], body: Row[], opts: { first?: number } = {}) => {
    autoTable(doc, {
      startY: y,
      head: [head.map(pdfSafe)],
      body: body.map((r) => r.map((v) => pdfSafe(v === null || v === undefined ? "" : String(v)))),
      margin: { left: M, right: M, bottom: 18 },
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.6, overflow: "linebreak" },
      headStyles: { fillColor: green, textColor: 255 },
      alternateRowStyles: { fillColor: [244, 247, 244] },
      columnStyles: opts.first ? { 0: { cellWidth: opts.first } } : undefined,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  };
  const kv = (rows: [string, string][]) => table([tr("Dato", "Item"), tr("Valor", "Value")], rows, { first: 55 });

  // Portada / encabezado
  doc.setTextColor(...green);
  para(m.title, 17, "bold", 1);
  doc.setTextColor(90, 90, 90);
  para(tr(`Generado el ${m.generated} · Origen de los datos: ${m.origin}`, `Generated on ${m.generated} · Data origin: ${m.origin}`), 9, "normal", 0.5);
  para(`${tr("Escenario", "Scenario")}: ${m.scenario}`, 9, "normal", 2);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(180, 120, 40);
  doc.setFillColor(253, 246, 232);
  const disc = doc.splitTextToSize(pdfSafe(`${tr("Importante", "Important")}: ${m.disclaimer}`), W - 2 * M - 6) as string[];
  const boxH = disc.length * 4 + 5;
  doc.roundedRect(M, y, W - 2 * M, boxH, 2, 2, "FD");
  doc.setFontSize(9);
  doc.text(disc, M + 3, y + 5);
  y += boxH + 4;

  heading(tr("Recomendación", "Recommendation"));
  para(m.recommendation.rotation, 11.5, "bold", 0.8);
  para(m.recommendation.score, 10);
  if (m.recommendation.vsActual) para(m.recommendation.vsActual, 10);
  para(m.recommendation.why, 10);
  if (m.recommendation.benefits.length) {
    para(tr("Ventajas", "Advantages"), 10, "bold", 0.5);
    bullets(m.recommendation.benefits);
  }
  if (m.recommendation.risks.length) {
    para(tr("Riesgos", "Risks"), 10, "bold", 0.5);
    bullets(m.recommendation.risks);
  }
  if (m.recommendation.validate.length) {
    para(tr("Para revisar con el técnico", "To review with your agronomist"), 10, "bold", 0.5);
    bullets(m.recommendation.validate);
  }
  if (m.recommendation.note) para(m.recommendation.note, 9);

  heading(tr("Datos del campo", "Field data"));
  kv(m.field);
  heading(tr("Prioridades del productor", "Farmer priorities"));
  table([tr("Prioridad", "Priority"), tr("Valor", "Value")], m.priorities, { first: 120 });
  para(`${tr("Peso de cada componente", "Weight of each component")}: ${m.weights}`, 9);
  heading(tr("Resumen climático", "Climate summary"));
  kv(m.climate);
  heading(tr("Rotaciones comparadas y puntajes", "Rotations compared and scores"));
  table(m.ranking.headers, m.ranking.rows, { first: 12 });
  para(COMPONENT_ORDER.map((k) => `${COMPONENTS[k].short} = ${COMPONENTS[k].name}`).join(" · "), 8.5);
  heading(tr("Por qué cada una", "Why each one"));
  for (const e of m.explanations) {
    para(e.title, 10, "bold", 0.5);
    para(e.why, 9.5, "normal", 0.5);
    if (e.risks.length) para(`${tr("Riesgos", "Risks")}: ${e.risks.join(" ")}`, 9, "normal", 2);
  }
  if (m.resilience) {
    heading(tr("Resistencia a los escenarios climáticos", "Resilience to climate scenarios"));
    table(m.resilience.headers, m.resilience.rows, { first: 60 });
  }
  if (m.calendar) {
    heading(tr("Calendario del plan", "Plan calendar"));
    para(m.calendar.title, 10, "bold");
    bullets(m.calendar.campaigns);
    if (m.calendar.advice.length) {
      para(tr("Recomendaciones del calendario", "Calendar recommendations"), 10, "bold", 0.5);
      bullets(m.calendar.advice);
    }
  }
  heading(tr("Supuestos", "Assumptions"));
  bullets(m.assumptions, 9);
  heading(tr("Fuentes", "Sources"));
  bullets(m.sources, 9);
  heading(tr("Advertencias", "Warnings"));
  bullets([...m.warnings, m.disclaimer], 9);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(pdfSafe(tr(`AgroOrbit · ${m.generated} · Herramienta de apoyo: no reemplaza a un ingeniero agrónomo`, `AgroOrbit · ${m.generated} · Support tool: does not replace an agronomist`)), M, H - 8);
    doc.text(`${p} / ${pages}`, W - M, H - 8, { align: "right" });
  }
  return doc;
}
