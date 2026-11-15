import Link from "next/link";
import { ArrowRight, CalendarDays, CircleCheck, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { ConfidenceBadge, RiskLevelBadge } from "@/components/provenance/badges";
import { Term } from "@/components/glossary/term";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { favorAndPenalty, type Weights } from "@/lib/dashboard";
import { STRATEGY_LABELS, num, rotationTitle, signed } from "@/lib/format";
import { plain } from "@/lib/plain";
import type { RotationEvaluation } from "@/types/api";
import { ImpactList } from "./impact-list";
import { tr } from "@/lib/i18n";

interface Props {
  best: RotationEvaluation;
  actual: RotationEvaluation | undefined;
  weights: Weights;
  fieldId: string;
  scenarioText: string | null;
}

/** La respuesta a "¿qué conviene?": la rotación recomendada, por qué, qué la favorece, qué la penaliza y qué validar. */
export function FinalRecommendation({ best, actual, weights, fieldId, scenarioText }: Props) {
  const isActualBest = actual?.rotation.id === best.rotation.id;
  const diff = actual && !isActualBest ? (best.score.total ?? 0) - (actual.score.total ?? 0) : null;
  const { favor, penalize, vsActual } = favorAndPenalty(best, actual, weights, 3);
  const rec = best.recommendation;
  return (
    <Card className="border-2 border-primary bg-primary/5">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default"><Trophy aria-hidden /> {tr("Recomendación final", "Final recommendation")}</Badge>
          <Badge variant="outline">{STRATEGY_LABELS[best.rotation.strategy]}</Badge>
          <RiskLevelBadge level={best.score.risk_level} />
          <ConfidenceBadge level={best.confidence} />
        </div>
        <CardTitle as="h2" className="text-2xl">{rotationTitle(best.rotation)}</CardTitle>
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span><span className="text-5xl font-bold tabular-nums">{num(best.score.total)}</span><span className="text-lg text-muted-foreground"> / 100</span></span>
          <span className="text-sm text-muted-foreground">
            <Term k="rango">{tr("Rango probable", "Likely range")}</Term>: {num(best.score.uncertainty_low)} {tr("a", "to")} {num(best.score.uncertainty_high)}
          </span>
          {diff !== null && <span className="font-medium">{signed(diff, 1)} puntos frente a tu rotación actual ({num(actual!.score.total)})</span>}
        </p>
        {scenarioText && <p className="rounded-md bg-agua-50 px-3 py-2 text-sm text-agua-900 dark:bg-agua-900/40 dark:text-agua-50">{tr("Escenario", "Scenario")}: {scenarioText}.</p>}
      </CardHeader>
      <CardContent className="space-y-5">
        {isActualBest ? (
          <p className="flex gap-2 text-lg">
            <CircleCheck aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
            <span>{tr(<>Con estas prioridades y este escenario, <strong>tu rotación actual sigue siendo la mejor opción</strong>. Las alternativas no la superan.</>, <>With these priorities and this scenario, <strong>your current rotation is still the best option</strong>. The alternatives do not beat it.</>)}</span>
          </p>
        ) : null}
        <p className="text-lg">{plain(rec.why)}</p>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <h3 id="fav" className="flex items-center gap-2 text-lg font-semibold"><ThumbsUp aria-hidden className="size-5" /> {tr("Qué datos la favorecen", "What data favors it")}</h3>
            <ImpactList impacts={favor} vsActual={vsActual} empty={tr("Ningún factor la favorece de forma clara.", "No factor clearly favors it.")} />
          </div>
          <div className="space-y-2">
            <h3 id="pen" className="flex items-center gap-2 text-lg font-semibold"><ThumbsDown aria-hidden className="size-5" /> {tr("Qué datos la penalizan", "What data penalizes it")}</h3>
            <ImpactList impacts={penalize} vsActual={vsActual} empty={tr("Ningún factor la penaliza de forma clara.", "No factor clearly penalizes it.")} />
          </div>
        </div>
        <div className="space-y-1 rounded-lg border bg-card p-4">
          <h3 id="val" className="font-semibold">{tr("Antes de decidir, validá con un ingeniero agrónomo de tu zona:", "Before deciding, check with an agronomist in your area:")}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {rec.evidence.needs_validation.slice(0, 4).map((t) => <li key={t}>{plain(t)}</li>)}
          </ul>
          <p className="pt-1 text-sm text-muted-foreground">{rec.disclaimer}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href={`/campo/${fieldId}/rotacion/${best.rotation.id}`}>{tr("Ver el detalle completo", "See full details")} <ArrowRight aria-hidden /></Link></Button>
          <Button variant="outline" asChild><Link href={`/campo/${fieldId}/calendario?rotacion=${encodeURIComponent(best.rotation.id)}`}><CalendarDays aria-hidden /> {tr("Calendario de siembra", "Planting calendar")}</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
