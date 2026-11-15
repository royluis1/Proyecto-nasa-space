/** Lógica pura del calendario por campañas (línea de tiempo del backend): tramos, textos y resúmenes. */
import type { CalendarTimeline, Level, TimelineAdvice, TimelineCampaign, TimelineMonth } from "@/types/api";
import { L, localize, tr } from "./i18n";
import { LEVEL_LABELS } from "./format";

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

export const STAGE_LABELS: Record<TimelineMonth["stage"], string> = localize({
  siembra: L("Siembra", "Planting"),
  desarrollo: L("Desarrollo", "Growth"),
  cosecha: L("Cosecha", "Harvest"),
  barbecho: L("Barbecho", "Fallow"),
});

/** Etapa en palabras (la cobertura no se cosecha: se seca o se corta). */
export function stageText(m: TimelineMonth): string {
  if (m.stage === "cosecha" && m.is_cover_crop) return tr("Fin de la cobertura", "End of cover crop");
  return STAGE_LABELS[m.stage];
}

export const COVER_LABELS: Record<TimelineMonth["cover"], string> = localize({
  cultivo: L("Cultivo vivo", "Living crop"),
  cobertura: L("Cobertura viva", "Living cover"),
  rastrojo: L("Rastrojo", "Residue"),
  desnudo: L("Suelo desnudo", "Bare soil"),
});

/** Descripción completa de un mes, para lectores de pantalla y tablas. */
export function describeMonth(m: TimelineMonth): string {
  const parts = [m.crop_name ? `${m.crop_name}: ${stageText(m).toLowerCase()}` : tr("Barbecho", "Fallow")];
  if (m.harvest_of) parts.push(tr(`cosecha de ${m.harvest_of}`, `harvest of ${m.harvest_of}`));
  parts.push(COVER_LABELS[m.cover].toLowerCase());
  if (m.heat_risk) parts.push(tr(`riesgo de calor ${LEVEL_LABELS[m.heat_risk].toLowerCase()}`, `${LEVEL_LABELS[m.heat_risk].toLowerCase()} heat risk`));
  if (m.water_risk) parts.push(tr(`riesgo de falta de agua ${LEVEL_LABELS[m.water_risk].toLowerCase()}`, `${LEVEL_LABELS[m.water_risk].toLowerCase()} water-shortage risk`));
  return parts.join(", ");
}

/** Resumen de una campaña en una frase. */
export function campaignSummary(c: TimelineCampaign): string {
  const p = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    p(c.covered_months, tr("mes con cultivo vivo", "month with a living crop"), tr("meses con cultivo vivo", "months with a living crop")),
    p(c.bare_months, tr("mes de suelo desnudo", "month of bare soil"), tr("meses de suelo desnudo", "months of bare soil")),
    p(c.heat_risk_months, tr("mes con riesgo alto de calor", "month with high heat risk"), tr("meses con riesgo alto de calor", "months with high heat risk")),
    p(c.water_risk_months, tr("mes con riesgo alto de falta de agua", "month with high water-shortage risk"), tr("meses con riesgo alto de falta de agua", "months with high water-shortage risk")),
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
