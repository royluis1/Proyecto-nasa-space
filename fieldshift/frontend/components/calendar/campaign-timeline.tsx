"use client";

import { useState } from "react";
import { CircleSlash, Droplet, Layers, Leaf, Sprout, Thermometer, Wheat, type LucideIcon } from "lucide-react";
import { GROUP_INFO } from "@/components/score/rotation-calendar";
import { LEVEL_LABELS, MONTHS_LONG } from "@/lib/format";
import { COVER_LABELS, campaignSummary, cropSpans, describeMonth, stageText } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { Crop, Level, TimelineCampaign, TimelineMonth } from "@/types/api";

const FALLOW_STYLE = { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 6px, hsl(var(--border)) 6px 8px)" };
const BARE_STYLE = { backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 4px, hsl(var(--destructive) / 0.35) 4px 6px)" };
const RESIDUE_STYLE = { backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.25) 1px, transparent 1.5px)", backgroundSize: "6px 6px" };

const STAGE_ICON: Record<TimelineMonth["stage"], LucideIcon> = { siembra: Sprout, desarrollo: Leaf, cosecha: Wheat, barbecho: CircleSlash };

const LEVEL_CLS: Record<Level, string> = {
  bajo: "bg-muted text-muted-foreground",
  medio: "bg-tierra-100 text-tierra-900 dark:bg-tierra-900/60 dark:text-tierra-50",
  alto: "bg-destructive/15 text-destructive font-semibold",
};

const SEL = "ring-2 ring-inset ring-primary";

function RiskCell({ level, icon: Icon, what, selected }: { level: Level | null | undefined; icon: LucideIcon; what: string; selected?: boolean }) {
  if (!level) return <td className={cn("h-9 rounded-md text-center text-xs text-muted-foreground", selected && SEL)}><span aria-hidden>—</span><span className="sr-only">Sin cultivo: no aplica</span></td>;
  return (
    <td className={cn("h-9 rounded-md text-center text-xs", LEVEL_CLS[level], selected && SEL)} title={`Riesgo de ${what}: ${LEVEL_LABELS[level].toLowerCase()}`}>
      <span className="inline-flex items-center gap-0.5">
        {level !== "bajo" && <Icon aria-hidden className="size-3.5" />}
        {LEVEL_LABELS[level]}
      </span>
    </td>
  );
}

/** Una campaña (julio a junio) como tabla: columnas = meses; filas = cultivo, etapa, suelo, calor y agua. */
export function CampaignTimeline({ campaign, crops, rotationName }: { campaign: TimelineCampaign; crops: Record<string, Crop>; rotationName?: string }) {
  const name = `${rotationName ? `${rotationName}, c` : "C"}ampaña ${campaign.label}`;
  const months = campaign.months;
  const spans = cropSpans(months);
  const [sel, setSel] = useState<number | null>(null);
  const selMonth = months.find((m) => m.index === sel) ?? null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">Campaña {campaign.label}</h3>
        <p className="text-sm text-muted-foreground">{campaignSummary(campaign)}</p>
      </div>
      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={`${name}: desplazá para ver todos los meses`}>
        <table className="w-full min-w-[46rem] border-separate border-spacing-0.5 text-sm">
          <caption className="sr-only">
            Campaña {campaign.label}, de julio a junio: cultivo, etapa, estado del suelo y riesgos de cada mes. {campaignSummary(campaign)}.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-20 text-left text-xs font-medium text-muted-foreground"><span className="sr-only">Dato</span></th>
              {months.map((m) => (
                <th key={m.index} scope="col" abbr={`${MONTHS_LONG[m.month - 1]} ${m.year}`} className="p-0 text-center text-xs font-medium text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setSel(sel === m.index ? null : m.index)}
                    aria-pressed={sel === m.index}
                    className={cn("w-full rounded-md px-0.5 py-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", sel === m.index && "bg-primary text-primary-foreground hover:bg-primary")}
                  >
                    <span className="sr-only">Ver qué pasa en </span>
                    {m.label.split(" ")[0]}
                    <span className="block text-[10px] font-normal">{m.year}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="text-left text-xs font-medium">Cultivo</th>
              {spans.map((s) => {
                if (!s.cropId) {
                  return (
                    <td key={s.start} colSpan={s.length} style={FALLOW_STYLE} className="h-11 rounded-md border border-dashed text-center text-xs text-muted-foreground">
                      Barbecho
                    </td>
                  );
                }
                const crop = crops[s.cropId];
                const info = crop ? GROUP_INFO[crop.group] : undefined;
                const Icon = s.isCover ? Layers : (info?.icon ?? Leaf);
                return (
                  <td key={s.start} colSpan={s.length} className={cn("h-11 rounded-md px-1 text-center text-xs font-medium", info?.cls ?? "bg-muted")}>
                    <span className="inline-flex items-center gap-1"><Icon aria-hidden className="size-4 shrink-0" /><span className="truncate">{s.cropName}</span></span>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className="text-left text-xs font-medium">Etapa</th>
              {months.map((m) => {
                const Icon = STAGE_ICON[m.stage];
                return (
                  <td key={m.index} className={cn("h-9 rounded-md text-center text-[11px] leading-tight", sel === m.index && SEL)} title={describeMonth(m)}>
                    <Icon aria-hidden className={cn("mx-auto size-4", m.stage === "barbecho" && "text-muted-foreground")} />
                    <span className={cn(m.stage === "barbecho" && "text-muted-foreground")}>{m.stage === "barbecho" ? "—" : stageText(m).split(" ")[0]}</span>
                    {m.harvest_of && <span className="sr-only"> (cosecha de {m.harvest_of})</span>}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className="text-left text-xs font-medium">Suelo</th>
              {months.map((m) => (
                <td
                  key={m.index}
                  style={m.cover === "desnudo" ? BARE_STYLE : m.cover === "rastrojo" ? RESIDUE_STYLE : undefined}
                  className={cn(
                    "h-9 rounded-md text-center text-[11px] leading-tight",
                    m.cover === "cultivo" || m.cover === "cobertura" ? "bg-cultivo-100 text-cultivo-900 dark:bg-cultivo-900/60 dark:text-cultivo-50" : "border",
                    m.cover === "desnudo" && "font-semibold",
                    sel === m.index && SEL,
                  )}
                >
                  {m.cover === "cultivo" || m.cover === "cobertura" ? "Vivo" : m.cover === "rastrojo" ? "Rastrojo" : "Desnudo"}
                  <span className="sr-only"> ({COVER_LABELS[m.cover]})</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="text-left text-xs font-medium"><span className="inline-flex items-center gap-1"><Thermometer aria-hidden className="size-3.5" />Calor</span></th>
              {months.map((m) => <RiskCell key={m.index} level={m.heat_risk} icon={Thermometer} what="golpe de calor" selected={sel === m.index} />)}
            </tr>
            <tr>
              <th scope="row" className="text-left text-xs font-medium"><span className="inline-flex items-center gap-1"><Droplet aria-hidden className="size-3.5" />Agua</span></th>
              {months.map((m) => <RiskCell key={m.index} level={m.water_risk} icon={Droplet} what="falta de agua" selected={sel === m.index} />)}
            </tr>
          </tbody>
        </table>
      </div>
      <p aria-live="polite" className={cn("rounded-md px-3 py-2 text-sm", selMonth ? "bg-secondary text-secondary-foreground" : "text-muted-foreground")}>
        {selMonth ? (
          <><strong>{MONTHS_LONG[selMonth.month - 1]} {selMonth.year}:</strong> {describeMonth(selMonth)}.</>
        ) : (
          "Tocá un mes para ver qué pasa en el lote."
        )}
      </p>
    </div>
  );
}

/** Referencias de la tabla de campañas. */
export function TimelineLegend() {
  const item = "inline-flex items-center gap-2";
  const box = "inline-block size-5 rounded border";
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Referencias del calendario">
      <li className={item}><Sprout aria-hidden className="size-4" /> Siembra</li>
      <li className={item}><Leaf aria-hidden className="size-4" /> Desarrollo</li>
      <li className={item}><Wheat aria-hidden className="size-4" /> Cosecha</li>
      <li className={item}><span aria-hidden className={cn(box, "bg-cultivo-100 dark:bg-cultivo-900/60")} /> Suelo con cultivo vivo</li>
      <li className={item}><span aria-hidden className={box} style={RESIDUE_STYLE} /> Rastrojo (protege el suelo)</li>
      <li className={item}><span aria-hidden className={box} style={BARE_STYLE} /> Suelo desnudo</li>
      <li className={item}><Thermometer aria-hidden className="size-4" /> Riesgo de golpe de calor</li>
      <li className={item}><Droplet aria-hidden className="size-4" /> Riesgo de falta de agua</li>
    </ul>
  );
}
