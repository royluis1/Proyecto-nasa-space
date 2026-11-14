/** Lógica pura del calendario por campañas (línea de tiempo del backend): tramos, textos y resúmenes. */
import type { CalendarTimeline, Level, TimelineAdvice, TimelineCampaign, TimelineMonth } from "@/types/api";

export interface Span {
  start: number; // posición dentro de la campaña (0 = julio)
  length: number;
  cropId: string | null;
  cropName: string | null;
  isCover: boolean;
}

/** Junta meses seguidos con el mismo cultivo (o barbecho) para dibujar barras. */
export function cropSpans(months: TimelineMonth[]): Span[] {
  const out: Span[] = [];
  months.forEach((m, i) => {
    const last = out[out.length - 1];
    if (last && last.cropId === m.crop_id && m.stage !== "siembra") last.length += 1;
    else out.push({ start: i, length: 1, cropId: m.crop_id, cropName: m.crop_name, isCover: m.is_cover_crop });
  });
  return out;
}

export const STAGE_LABELS: Record<TimelineMonth["stage"], string> = {
  siembra: "Siembra",
  desarrollo: "Desarrollo",
  cosecha: "Cosecha",
  barbecho: "Barbecho",
};

/** Etapa en palabras (la cobertura no se cosecha: se seca o se corta). */
export function stageText(m: TimelineMonth): string {
  if (m.stage === "cosecha" && m.is_cover_crop) return "Fin de la cobertura";
  return STAGE_LABELS[m.stage];
}

export const COVER_LABELS: Record<TimelineMonth["cover"], string> = {
  cultivo: "Cultivo vivo",
  cobertura: "Cobertura viva",
  rastrojo: "Rastrojo",
  desnudo: "Suelo desnudo",
};

/** Descripción completa de un mes, para lectores de pantalla y tablas. */
export function describeMonth(m: TimelineMonth): string {
  const parts = [m.crop_name ? `${m.crop_name}: ${stageText(m).toLowerCase()}` : "Barbecho"];
  if (m.harvest_of) parts.push(`cosecha de ${m.harvest_of}`);
  parts.push(COVER_LABELS[m.cover].toLowerCase());
  if (m.heat_risk) parts.push(`riesgo de calor ${m.heat_risk}`);
  if (m.water_risk) parts.push(`riesgo de falta de agua ${m.water_risk}`);
  return parts.join(", ");
}

/** Resumen de una campaña en una frase. */
export function campaignSummary(c: TimelineCampaign): string {
  const p = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    p(c.covered_months, "mes con cultivo vivo", "meses con cultivo vivo"),
    p(c.bare_months, "mes de suelo desnudo", "meses de suelo desnudo"),
    p(c.heat_risk_months, "mes con riesgo alto de calor", "meses con riesgo alto de calor"),
    p(c.water_risk_months, "mes con riesgo alto de falta de agua", "meses con riesgo alto de falta de agua"),
  ].join(" · ");
}

const LEVEL_ORDER: Record<Level, number> = { bajo: 0, medio: 1, alto: 2 };

/** Peor nivel de una lista (null si no hay ninguno). */
export function worstLevel(levels: (Level | null | undefined)[]): Level | null {
  return levels.reduce<Level | null>((w, l) => (l && (!w || LEVEL_ORDER[l] > LEVEL_ORDER[w]) ? l : w), null);
}

/** Consejos que aplican a una campaña. */
export const adviceFor = (advice: TimelineAdvice[], campaign: number) => advice.filter((a) => a.campaigns.includes(campaign));

/** Totales de toda la línea de tiempo (para el reporte y para comparar dos rotaciones). */
export function timelineTotals(tl: CalendarTimeline) {
  const sum = (f: (c: TimelineCampaign) => number) => tl.campaigns.reduce((a, c) => a + f(c), 0);
  return {
    campaigns: tl.campaigns.length,
    covered: sum((c) => c.covered_months),
    bare: sum((c) => c.bare_months),
    heat: sum((c) => c.heat_risk_months),
    water: sum((c) => c.water_risk_months),
  };
}
