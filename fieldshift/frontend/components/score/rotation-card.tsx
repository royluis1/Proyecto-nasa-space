import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Droplets, Flag, Minus, Trophy } from "lucide-react";
import { ConfidenceBadge, RiskLevelBadge } from "@/components/provenance/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STRATEGY_LABELS, num, rotationTitle, signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RotationEvaluation } from "@/types/api";
import { ScoreBars } from "./score-bars";
import { tr } from "@/lib/i18n";

const firstSentences = (text: string, n = 2) => (text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]).slice(0, n).join("").trim();

interface Props {
  ev: RotationEvaluation;
  fieldId: string;
  /** Puntaje de la rotación actual, para mostrar la diferencia. */
  baseline: number | null;
  total: number;
}

export function RotationCard({ ev, fieldId, baseline, total }: Props) {
  const { rotation: r, score, profile, recommendation } = ev;
  const isActual = r.strategy === "actual";
  const isFirst = score.rank === 1;
  const diff = baseline == null || isActual ? null : (score.total ?? 0) - baseline;
  return (
    <Card className={cn(isFirst && "border-primary ring-2 ring-primary/40")}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-base">Puesto {score.rank} de {total}</Badge>
          {isFirst && (
            <Badge variant="default">
              <Trophy aria-hidden /> Recomendada con tus prioridades
            </Badge>
          )}
          {isActual && (
            <Badge variant="tierra">
              <Flag aria-hidden /> {tr("Tu rotación actual", "Your current rotation")}
            </Badge>
          )}
          <Badge variant="outline">{STRATEGY_LABELS[r.strategy]}</Badge>
        </div>
        <CardTitle as="h2" className="text-xl">{rotationTitle(r)}</CardTitle>
        <ul className="flex flex-wrap gap-1.5" aria-label={tr("Secuencia de cultivos", "Crop sequence")}>
          {profile.sequence.map((s) => (
            <li key={s} className="rounded-md bg-muted px-2 py-0.5 text-sm">{s}</li>
          ))}
        </ul>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <p aria-label={tr(`Puntaje ${num(score.total)} de 100`, `Score ${num(score.total)} out of 100`)}>
            <span className="text-5xl font-bold tabular-nums">{num(score.total)}</span>
            <span className="text-lg text-muted-foreground"> / 100</span>
          </p>
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <p>{tr("Rango probable", "Likely range")}: {num(score.uncertainty_low)} {tr("a", "to")} {num(score.uncertainty_high)}</p>
            {diff !== null && (
              <p className="flex items-center gap-1 font-medium text-foreground">
                {diff > 0.4 ? <ArrowUp aria-hidden className="size-4" /> : diff < -0.4 ? <ArrowDown aria-hidden className="size-4" /> : <Minus aria-hidden className="size-4" />}
                {Math.abs(diff) <= 0.4 ? tr("Igual que la actual", "Same as current") : tr(`${signed(diff, 1)} puntos frente a la actual`, `${signed(diff, 1)} points vs. current`)}
              </p>
            )}
          </div>
        </div>
        <ScoreBars components={score.components} />
        <div className="flex flex-wrap items-center gap-2">
          <RiskLevelBadge level={score.risk_level} />
          <ConfidenceBadge level={score.confidence} />
          <Badge variant="agua" title={tr("Demanda de agua estimada de los cultivos (Kc × ET₀)", "Estimated crop water demand (Kc × ET₀)")}>
            <Droplets aria-hidden /> {num(profile.water_demand_mm_year)} {tr("mm/año", "mm/yr")}
            {profile.relative_water_demand != null && !isActual && <> ({num(profile.relative_water_demand * 100)} % {tr("de la actual", "of current")})</>}
          </Badge>
        </div>
        <p className="text-base">{firstSentences(recommendation.why)}</p>
        <Button asChild variant={isFirst ? "default" : "outline"}>
          <Link href={`/campo/${fieldId}/rotacion/${r.id}`}>
            {tr("Ver detalle y por qué", "See details and why")} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
