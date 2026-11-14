import { ArrowDown, ArrowUp, Flag, Minus, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { RiskLevelBadge } from "@/components/provenance/badges";
import { Badge } from "@/components/ui/badge";
import { STRATEGY_LABELS, num, rotationTitle, signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RotationEvaluation } from "@/types/api";

const first = (l: string[], n = 2) => l.slice(0, n);

/** Ranking completo: puesto, puntaje, ventajas y desventajas de cada rotación. La actual siempre está incluida. */
export function RankingList({ evaluations }: { evaluations: RotationEvaluation[] }) {
  const actual = evaluations.find((e) => e.rotation.strategy === "actual");
  const base = actual?.score.total ?? null;
  return (
    <ol className="space-y-3" aria-label="Ranking de rotaciones, de la mejor a la peor">
      {evaluations.map((ev) => {
        const isActual = ev.rotation.strategy === "actual";
        const isFirst = ev.score.rank === 1;
        const d = base == null || isActual ? null : (ev.score.total ?? 0) - base;
        const pros = isActual ? ["Es tu punto de partida: no requiere cambios de manejo."] : first(ev.profile.benefits);
        const cons = first(ev.profile.risks);
        return (
          <li key={ev.rotation.id} className={cn("rounded-lg border bg-card p-4", isFirst && "border-primary ring-2 ring-primary/30")}>
            <div className="grid gap-4 md:grid-cols-[9rem_1fr_1fr]">
              <div className="flex items-center gap-3 md:flex-col md:items-start">
                <p className="text-sm font-medium text-muted-foreground">Puesto</p>
                <p className="text-4xl font-bold tabular-nums">{ev.score.rank}</p>
                <div className="md:mt-1">
                  <p aria-label={`Puntaje ${num(ev.score.total)} de 100`}><span className="text-2xl font-bold tabular-nums">{num(ev.score.total)}</span><span className="text-muted-foreground"> / 100</span></p>
                  {d !== null && (
                    <p className="flex items-center gap-1 text-sm font-medium">
                      {d > 0.4 ? <ArrowUp aria-hidden className="size-4" /> : d < -0.4 ? <ArrowDown aria-hidden className="size-4" /> : <Minus aria-hidden className="size-4" />}
                      {Math.abs(d) <= 0.4 ? "Igual que la actual" : `${signed(d, 1)} vs. la actual`}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {isFirst && <Badge variant="default"><Trophy aria-hidden /> Recomendada</Badge>}
                  {isActual && <Badge variant="tierra"><Flag aria-hidden /> Tu rotación actual</Badge>}
                  <Badge variant="outline">{STRATEGY_LABELS[ev.rotation.strategy]}</Badge>
                  <RiskLevelBadge level={ev.score.risk_level} />
                </div>
                <p className="text-lg font-semibold">
                  <a href={`#rot-${ev.rotation.id}`} className="hover:underline">{rotationTitle(ev.rotation)}</a>
                </p>
                <p className="text-sm text-muted-foreground">Rango probable: {num(ev.score.uncertainty_low)} a {num(ev.score.uncertainty_high)}</p>
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><ThumbsUp aria-hidden className="size-4" /> Ventajas</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm">{pros.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
              </div>
              <div className="space-y-2 md:pt-9">
                <p className="flex items-center gap-1.5 text-sm font-semibold"><ThumbsDown aria-hidden className="size-4" /> Desventajas</p>
                {cons.length ? <ul className="list-disc space-y-0.5 pl-5 text-sm">{cons.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-sm text-muted-foreground">Sin desventajas destacadas.</p>}
                <a href={`#rot-${ev.rotation.id}`} className="inline-block text-sm text-primary underline">Ver el análisis completo</a>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
