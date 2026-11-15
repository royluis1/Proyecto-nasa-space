"use client";

import { Info, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCampo } from "@/components/campo/campo-provider";
import { RadarCompare } from "@/components/charts/radar-compare";
import { PriorityControls } from "@/components/field/priority-controls";
import { PageHeader } from "@/components/page-header";
import { ConfidenceBadge } from "@/components/provenance/badges";
import { WarningsList } from "@/components/provenance/warnings";
import { RotationCard } from "@/components/score/rotation-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COMPONENT_ORDER, COMPONENTS, CONFIDENCE_LABELS, STRATEGY_LABELS, num } from "@/lib/format";
import { tr } from "@/lib/i18n";

export default function ComparadorPage() {
  const { fieldId, ui, setUi, compare } = useCampo();
  const { evaluations, result } = compare;
  const baseline = evaluations.find((e) => e.rotation.strategy === "actual")?.score.total ?? null;
  const wide = useMediaQuery("(min-width: 1024px)");

  const prioritiesPanel = (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2 text-lg"><SlidersHorizontal aria-hidden className="size-5" /> {tr("Tus prioridades", "Your priorities")}</CardTitle>
        <CardDescription>{tr("Movelas y el ranking se recalcula al instante.", "Move them and the ranking recalculates instantly.")}</CardDescription>
      </CardHeader>
      <CardContent>
        <PriorityControls value={ui} onChange={setUi} />
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("Comparador de rotaciones", "Rotation comparison")}
        description={tr("Al menos tres opciones para tu campo, siempre con tu rotación actual como punto de partida. Cada puntaje va de 0 a 100.", "At least three options for your field, always with your current rotation as the starting point. Each score goes from 0 to 100.")}
      />
      {compare.error && !result && (
        <Alert tone="error" title={tr("No pudimos calcular el ranking", "We couldn't calculate the ranking")}>
          <p>{compare.error}</p>
          <Button size="sm" variant="outline" onClick={compare.reload}><RefreshCw aria-hidden /> {tr("Reintentar", "Retry")}</Button>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5 lg:order-1">
          {!result ? (
            !compare.error && (
              <div role="status" aria-busy="true" className="space-y-4">
                <span className="sr-only">{tr("Calculando las rotaciones…", "Calculating the rotations…")}</span>
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 w-full" />)}
              </div>
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                <ConfidenceBadge level={result.confidence} />
                <span className="text-sm text-muted-foreground">
                  {compare.loading ? tr("Actualizando con el servidor…", "Updating with the server…") : tr(`${evaluations.length} rotaciones comparadas`, `${evaluations.length} rotations compared`)}
                </span>
              </div>
              {result.confidence_reasons.length > 0 && (
                <details className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <summary className="flex cursor-pointer items-center gap-2 font-medium"><Info aria-hidden className="size-4" /> {tr("Por qué la confianza es", "Why confidence is")} {CONFIDENCE_LABELS[result.confidence].split(" ").pop()}</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {result.confidence_reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </details>
              )}
              <WarningsList warnings={compare.warnings} />
              <ol className="space-y-5" aria-label={tr("Rotaciones ordenadas de la mejor a la peor", "Rotations sorted from best to worst")}>
                {evaluations.map((ev) => (
                  <li key={ev.rotation.id}>
                    <RotationCard ev={ev} fieldId={fieldId} baseline={baseline} total={evaluations.length} />
                  </li>
                ))}
              </ol>
              <Card>
                <CardHeader><CardTitle as="h2">{tr("Para mirarlas juntas", "To look at them together")}</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <RadarCompare evaluations={evaluations} />
                  <Table scrollLabel={tr("Puntajes de todas las rotaciones: desplazá para ver todo", "Scores for all rotations: scroll to see everything")}>
                    <TableCaption>{tr("Puntaje de cada rotación en los cinco componentes y total.", "Each rotation's score on the five components and total.")}</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tr("Puesto", "Rank")}</TableHead>
                        <TableHead>{tr("Rotación", "Rotation")}</TableHead>
                        {COMPONENT_ORDER.map((k) => <TableHead key={k} title={COMPONENTS[k].name}>{k}</TableHead>)}
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluations.map((ev) => (
                        <TableRow key={ev.rotation.id}>
                          <TableCell>{ev.score.rank}</TableCell>
                          <TableCell>{STRATEGY_LABELS[ev.rotation.strategy]}</TableCell>
                          {COMPONENT_ORDER.map((k) => <TableCell key={k} className="tabular-nums">{num(ev.score.components.find((c) => c.key === k)?.value)}</TableCell>)}
                          <TableCell className="font-bold tabular-nums">{num(ev.score.total, 1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
        <aside className="lg:order-2" aria-label={tr("Prioridades", "Priorities")}>
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            {wide ? (
              prioritiesPanel
            ) : (
              <details>
                <summary className="mb-3 flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-4 font-medium">
                  <SlidersHorizontal aria-hidden className="size-5" /> {tr("Ajustar mis prioridades", "Adjust my priorities")}
                </summary>
                {prioritiesPanel}
              </details>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
