import { ArrowDown, ArrowUp, Flag, Minus, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { RiskLevelBadge } from "@/components/provenance/badges";
import { Badge } from "@/components/ui/badge";
import { STRATEGY_LABELS, num, rotationTitle, signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RotationEvaluation } from "@/types/api";
import { tr } from "@/lib/i18n";

const first = (l: string[], n = 2) => l.slice(0, n);

/** Ranking completo: puesto, puntaje, ventajas y desventajas de cada rotación. La actual siempre está incluida. */
export function RankingList({ evaluations }: { evaluations: RotationEvaluation[] }) {
  const actual = evaluations.find((e) => e.rotation.strategy === "actual");
  const base = actual?.score.total ?? null;
  return (
    <ol className="space-y-3" aria-label={tr("Ranking de rotaciones, de la mejor a la peor", "Rotation ranking, from best to worst")}>
      {evaluations.map((ev) => {
        const isActual = ev.rotation.strategy === "actual";
        const isFirst = ev.score.rank === 1;
        const d = base == null || isActual ? null : (ev.score.total ?? 0) - base;
        const pros = isActual ? [tr("Es tu punto de partida: no requiere cambios de manejo.", "It's your starting point: no management changes needed.")] : first(ev.profile.benefits);
        const cons = first(ev.profile.risks);
        return (
          <li key={ev.rotation.id} className={cn("rounded-lg border bg-card p-4", isFirst && "border-primary ring-2 ring-primary/30")}>
            <div className="grid gap-4 md:grid-cols-[9rem_1fr_1fr]">
              <div className="flex items-center gap-3 md:flex-col md:items-start">
                <p className="text-sm font-medium text-muted-foreground">{tr("Puesto", "Rank")}</p>
                <p className="text-4xl font-bold tabular-nums">{ev.score.rank}</p>
                <div className="md:mt-1">
                  <p aria-label={tr(`Puntaje ${num(ev.score.total)} de 100`, `Score ${num(ev.score.total)} out of 100`)}><span className="text-2xl font-bold tabular-nums">{num(ev.score.total)}</span><span className="text-muted-foreground"> / 100</span></p>
                  {d !== null && (
                    <p className="flex items-center gap-1 text-sm font-medium">
                      {d > 0.4 ? <ArrowUp aria-hidden className="size-4" /> : d < -0.4 ? <ArrowDown aria-hidden className="size-4" /> : <Minus aria-hidden className="size-4" />}
                      {Math.abs(d) <= 0.4 ? tr("Igual que la actual", "Same as current") : tr(`${signed(d, 1)} vs. la actual`, `${signed(d, 1)} vs. current`)}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {isFirst && <Badge variant="default"><Trophy aria-hidden /> {tr("Recomendada", "Recommended")}</Badge>}
                  {isActual && <Badge variant="tierra"><Flag aria-hidden /> {tr("Tu rotación actual", "Your current rotation")}</Badge>}
                  <Badge variant="outline">{STRATEGY_LABELS[ev.rotation.strategy]}</Badge>
                  <RiskLevelBadge level={ev.score.risk_level} />
                </div>
                <p className="text-lg font-semibold">
                  <a href={`#rot-${ev.rotation.id}`} className="hover:underline">{rotationTitle(ev.rotation)}</a>
                </p>
                <p className="text-sm text-muted-foreground">{tr("Rango probable", "Likely range")}: {num(ev.score.uncertainty_low)} {tr("a", "to")} {num(ev.score.uncertainty_high)}</p>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><ThumbsUp aria-hidden className="size-4" /> {tr("Ventajas", "Advantages")}</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm">{pros.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              </div>
              <div className="space-y-2 md:pt-9">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><ThumbsDown aria-hidden className="size-4" /> {tr("Desventajas", "Drawbacks")}</p>
                {cons.length ? <ul className="list-disc space-y-0.5 pl-5 text-sm">{cons.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="text-sm text-muted-foreground">{tr("Sin desventajas destacadas.", "No notable drawbacks.")}</p>}
                <a href={`#rot-${ev.rotation.id}`} className="inline-block text-sm text-primary underline">{tr("Ver el análisis completo", "See the full analysis")}</a>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
