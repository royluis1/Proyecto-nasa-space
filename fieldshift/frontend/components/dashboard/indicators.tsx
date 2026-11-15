import { ArrowDown, ArrowUp, Equal, HelpCircle } from "lucide-react";
import { SeverityBadge, flagIcon } from "@/components/provenance/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUP_LABELS, INDICATORS, VERDICT_TEXT, judge, type IndicatorGroup, type Verdict } from "@/lib/dashboard";
import { STRATEGY_LABELS, rotationTitle } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RotationEvaluation } from "@/types/api";
import { tr } from "@/lib/i18n";

const VERDICT_ICON: Record<Verdict, typeof ArrowUp> = { mejor: ArrowUp, peor: ArrowDown, igual: Equal, sin_dato: HelpCircle };
const VERDICT_CLS: Record<Verdict, string> = {
  mejor: "border-cultivo-500/50 bg-cultivo-50 text-cultivo-900 dark:bg-cultivo-900/40 dark:text-cultivo-50",
  peor: "border-destructive/50 bg-destructive/10 text-foreground",
  igual: "border-border bg-muted text-foreground",
  sin_dato: "border-border bg-muted text-muted-foreground",
};

/** Veredicto con flecha y palabra: nunca solo color. */
function VerdictPill({ v }: { v: Verdict }) {
  const Icon = VERDICT_ICON[v];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium", VERDICT_CLS[v])}>
      <Icon aria-hidden className="size-4" /> {VERDICT_TEXT[v]}
    </span>
  );
}

const GROUPS: IndicatorGroup[] = ["total", "agua", "suelo", "riesgo", "ingreso", "sostenibilidad"];
const title = (e: RotationEvaluation) => `${STRATEGY_LABELS[e.rotation.strategy]}: ${rotationTitle(e.rotation)}`;

/** Indicadores de agua, suelo, riesgo, ingreso y sostenibilidad de dos rotaciones, con el veredicto de la segunda frente a la primera. */
export function IndicatorGrid({ a, b }: { a: RotationEvaluation; b: RotationEvaluation }) {
  const same = a.rotation.id === b.rotation.id;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {GROUPS.map((g) => {
        const rows = INDICATORS.filter((i) => i.group === g);
        return (
          <Card key={g} className={cn(g === "total" && "md:col-span-2")}>
            <CardHeader className="pb-1">
              <CardTitle as="h3" className="text-lg">{GROUP_LABELS[g]}</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <caption className="sr-only">{tr(`Indicadores de ${GROUP_LABELS[g]}: ${title(a)} contra ${title(b)}.`, `${GROUP_LABELS[g]} indicators: ${title(a)} vs. ${title(b)}.`)}</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th scope="col" className="py-1.5 pr-2 font-medium">{tr("Indicador", "Indicator")}</th>
                    <th scope="col" className="px-2 font-medium">{STRATEGY_LABELS[a.rotation.strategy]}</th>
                    <th scope="col" className="px-2 font-medium">{STRATEGY_LABELS[b.rotation.strategy]}</th>
                    <th scope="col" className="pl-2 font-medium">{same ? "" : tr("La segunda es…", "The second one is…")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ind) => {
                    const va = ind.value(a);
                    const vb = ind.value(b);
                    const verdict = same ? "igual" : judge(vb, va, ind.better, ind.tolerance);
                    return (
                      <tr key={ind.id} className="border-t align-top">
                        <th scope="row" className="py-2 pr-2 text-left font-medium">
                          {ind.label}
                          <span className="block text-xs font-normal text-muted-foreground">{ind.hint}</span>
                        </th>
                        <td className="px-2 py-2 tabular-nums">{va == null ? "—" : ind.format(va)}</td>
                        <td className="px-2 py-2 font-semibold tabular-nums">{vb == null ? "—" : ind.format(vb)}</td>
                        <td className="py-2 pl-2">{ind.better === "none" ? <span className="text-muted-foreground">—</span> : <VerdictPill v={verdict} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {g === "riesgo" && (
                <ul className="mt-3 space-y-2 border-t pt-3">
                  {b.risk_flags.length === 0 && <li className="text-sm text-muted-foreground">{tr(`Sin riesgos destacados en ${STRATEGY_LABELS[b.rotation.strategy].toLowerCase()}.`, `No notable risks in ${STRATEGY_LABELS[b.rotation.strategy].toLowerCase()}.`)}</li>}
                  {b.risk_flags.map((f) => {
                    const Icon = flagIcon(f.icon);
                    return (
                      <li key={f.id} className="flex gap-2 text-sm">
                        <Icon aria-hidden className="mt-1 size-4 shrink-0" />
                        <span>
                          <SeverityBadge severity={f.severity} /> {f.message}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
